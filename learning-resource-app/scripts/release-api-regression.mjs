import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// Call only against an isolated QA instance. Deletes only entities created here.
export async function runReleaseApiRegression(origin, record = console.log) {
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  const failures = [];
  const check = async (name, fn) => {
    try { await fn(); record(`${name}: PASS`); }
    catch (error) { failures.push(`${name}: ${error.message}`); record(`${name}: FAIL ${error.message}`); }
  };
  const json = async (route, options, expected) => {
    const response = await fetch(origin + route, {signal:AbortSignal.timeout(30000), ...options});
    assert.equal(response.status, expected);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    return response.json();
  };
  const post = (body) => ({method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
  await check('Malformed search is JSON 400', () => json('/api/search', {...post(null),body:'{'},400));
  await check('Empty search is JSON 400', () => json('/api/search',post({query:''}),400));
  await check('Malformed multipart upload is JSON 400', () => json('/api/documents/upload',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=broken'},body:'broken'},400));
  for (const [name, data, status] of [['unsupported.txt','text',415],['empty.pdf','',413],['fake.pdf','not a pdf',415],['too-large.pdf',Buffer.alloc(26*1024*1024),413]]) {
    await check(`Reject ${name} before storage`,async()=>{
      const form = new FormData();form.append('file',new Blob([data]),name);
      await json('/api/documents/upload',{method:'POST',body:form},status);
    });
  }
  let responseMode='ok';
  const server=createServer(async(req,res)=>{
    for await (const chunk of req) { void chunk; }
    const status=responseMode==='unauthorized'?401:responseMode==='limited'?429:200;
    res.writeHead(status,{'content-type':responseMode==='html'?'text/html':'application/json'});
    res.end(responseMode==='html'?'<html>Wrong endpoint</html>':JSON.stringify(responseMode==='empty'?{}:{choices:[{message:{content:'OK'}}]}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let providerId;
  try {
    const config={type:'CUSTOM',displayName:'QA regression temporary',baseUrl:`http://127.0.0.1:${server.address().port}/v1`,apiKey:'qa-dummy-not-a-secret',defaultChatModel:'fixture',isActive:false};
    await check('Custom API create/edit preserves key and never returns key',async()=>{
      const created=await json('/api/ai-providers',post(config),201);providerId=created.provider.id;
      assert.ok(created.provider.hasApiKey);assert.equal(created.provider.apiKeyEncrypted,undefined);
      const updated=await json(`/api/ai-providers/${providerId}`,{...post({...config,apiKey:'',displayName:'QA edited'}),method:'PATCH'},200);
      assert.ok(updated.provider.hasApiKey);
      const list=await json('/api/ai-providers',{},200);
      assert.ok(list.providers.some(p=>p.id===providerId&&p.hasApiKey&&p.displayName==='QA edited'));
      assert.ok(!JSON.stringify(list).includes(config.apiKey));
    });
    if(providerId) for(const [mode,expected] of [['ok',200],['html',502],['empty',502],['unauthorized',502],['limited',502]]) {
      responseMode=mode;
      await check(`AI connection ${mode}`,async()=>{const r=await json(`/api/ai-providers/${providerId}/test`,{method:'POST'},expected);assert.equal(typeof r.message,'string');assert.ok(!r.message.includes('<html>'));});
    }
  } finally {
    if(providerId) await json(`/api/ai-providers/${providerId}`,{method:'DELETE'},200);
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
  let tagId;
  const name=`QA temporary ${Date.now()}`;
  try {
    await check('Subject create/edit/duplicate',async()=>{
      // First real BGE inference on a cold CPU can exceed the HTTP-only 30s budget.
      // Keep a finite limit and report timing; do not replace inference with a mock.
      const started=Date.now();
      const created=await json('/api/tags',{...post({name,description:'Môn học kiểm thử'}),signal:AbortSignal.timeout(240000)},201);tagId=created.tag.id;
      await json('/api/tags',post({name}),409);
      await json(`/api/tags/${tagId}`,{...post({name:name+' renamed'}),method:'PATCH',signal:AbortSignal.timeout(240000)},200);
      record(`Subject real embedding create/edit elapsed: ${Date.now()-started}ms`);
    });
  } finally {
    if(tagId) await check('Delete only test subject',()=>json(`/api/tags/${tagId}`,{method:'DELETE'},200));
  }
  assert.deepEqual(failures,[], 'API regression failures');
}
