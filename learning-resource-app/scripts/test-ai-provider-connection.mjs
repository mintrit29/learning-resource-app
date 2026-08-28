import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { testProviderConnection } from '../src/lib/ai/chat-provider.ts';

let status = 200;
let body = '';
const server = createServer(async (req, res) => {
  for await (const chunk of req) { void chunk; }
  res.writeHead(status, {'content-type':'application/json'});
  res.end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const config = {type:'CUSTOM', baseUrl:`http://127.0.0.1:${server.address().port}`, apiKeyEncrypted:null, defaultChatModel:'fixture'};
try {
  for (const invalid of ['<html>Wrong URL</html>', '{}', '{"choices":[]}', '{"choices":[{"message":{"content":" "}}]}']) {
    body = invalid;
    await assert.rejects(testProviderConnection(config), undefined, `Must reject invalid successful HTTP response: ${invalid}`);
  }
  body = JSON.stringify({choices:[{message:{content:'OK'}}]});
  assert.equal(await testProviderConnection(config), 'Kết nối model thành công');
  for (const code of [401, 429, 500]) {
    status = code;
    await assert.rejects(testProviderConnection(config));
  }
  console.log('PASS AI connection: reject HTML/empty content/HTTP errors; accept actual chat response');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
