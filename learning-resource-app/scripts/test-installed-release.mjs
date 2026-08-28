// Intentionally CI-only: never opens or installs an app on the developer's desktop.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { _electron } from 'playwright';
import { runReleaseApiRegression } from './release-api-regression.mjs';
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Run this UI/install test on GitHub Actions, not the user desktop');
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted', 'Requires an isolated GitHub-hosted runner');
assert.equal(process.platform, 'win32');
const version = JSON.parse(await readFile('package.json','utf8')).version;
const qa = await mkdtemp(path.join(process.env.RUNNER_TEMP,'scholarflow-installed-'));
const installDir = path.join(qa,'app');
const dataDir = path.join(qa,'profile');
const reportDir = path.resolve('release-test-results');
await mkdir(reportDir,{recursive:true});
await mkdir(dataDir,{recursive:true});
const records=[];
const errors=[];
let app, page, db;
const record=(name,detail='PASS')=>{ records.push({name,detail}); console.log(`${name}: ${detail}`); };
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn, timeout=120000) {
  const end=Date.now()+timeout; let value;
  while(Date.now()<end) { value=await fn(); if(value) return value; await pause(500); }
  throw new Error('Timed out waiting for installed app condition');
}
async function launch() {
  const env={...process.env,SCHOLARFLOW_USER_DATA_ROOT:dataDir};
  delete env.ELECTRON_RUN_AS_NODE; delete env.SCHOLARFLOW_EMBEDDING_MOCK;
  app=await _electron.launch({executablePath:path.join(installDir,'ScholarFlow.exe'),args:['--in-process-gpu'],env,timeout:180000});
  page=await app.firstWindow({timeout:180000});
  page.setDefaultTimeout(45000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.waitForURL(/127\.0\.0\.1/, {timeout:180000});
  await page.waitForFunction(()=>Boolean(window.scholarFlowDesktop));
  return new URL(page.url()).origin;
}
async function upload(origin,file) {
  record(`Start ${path.basename(file)}`);
  const form=new FormData(); form.append('file',new Blob([await readFile(file)]),path.basename(file));
  const res=await fetch(`${origin}/api/documents/upload`,{method:'POST',body:form});
  assert.equal(res.status,202,await res.clone().text());
  const {documentId}=await res.json();
  try { await until(()=>{
    const jobs=db.prepare('SELECT type,status,errorMessage FROM AnalysisJob WHERE documentId=?').all(documentId).filter(j=>j.type!=='ANALYZE_DOCUMENT');
    const failed=jobs.find(j=>j.status==='FAILED'); if(failed) throw new Error(`${path.basename(file)}: ${failed.errorMessage}`);
    return jobs.length>=3 && jobs.every(j=>j.status==='COMPLETED');
  },240000); } catch(error) {
    // Report only fixture name and job metadata, never application logs or document contents.
    const states=db.prepare('SELECT type,status,progress FROM AnalysisJob WHERE documentId=?').all(documentId);
    throw new Error(`${path.basename(file)}: ${error.message}; jobs=${JSON.stringify(states)}`);
  }
  const doc=db.prepare('SELECT textContent FROM Document WHERE id=?').get(documentId);
  assert.ok(doc.textContent.length>20);
  const vectors=db.prepare('SELECT length(embedding) AS bytes FROM DocumentChunk WHERE documentId=?').all(documentId);
  assert.ok(vectors.length && vectors.every(v=>v.bytes===4096));
  const resSearch=await fetch(`${origin}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:doc.textContent.slice(0,300),documentId})});
  assert.equal(resSearch.status,200);
  assert.ok((await resSearch.json()).results.some(r=>r.documentId===documentId));
  record(path.basename(file),`PASS extraction, ${vectors.length} real 1024-d vectors, search`);
  return documentId;
}
async function selectRect(rect) {
  await page.getByRole('button',{name:'Chọn vùng',exact:true}).click();
  await page.mouse.move(rect.x+2,rect.y+2); await page.mouse.down();
  await page.mouse.move(rect.x+rect.width-2,rect.y+rect.height-2,{steps:10}); await page.mouse.up();
}
async function revealInViewer(locator) {
  const rect=await locator.boundingBox(); const viewer=page.locator('.visual-viewer'); const view=await viewer.boundingBox();
  assert.ok(rect && view);
  await viewer.evaluate((el,{dx,dy})=>{el.scrollLeft+=dx;el.scrollTop+=dy;},{dx:rect.x-view.x-30,dy:rect.y-view.y-80});
  await pause(250); return locator.boundingBox();
}
try {
  const installer=path.resolve(`dist-electron/ScholarFlow-Setup-${version}.exe`);
  const installed=spawnSync(installer,['/S',`/D=${installDir}`],{windowsHide:true,timeout:180000,encoding:'utf8'});
  assert.equal(installed.status,0,`Installer failed: ${installed.stderr}`);
  await until(async()=>readFile(path.join(installDir,'ScholarFlow.exe')).then(()=>true,()=>false),60000);
  record('Silent NSIS installation');
  let origin=await launch();
  assert.equal(await app.evaluate(({app})=>app.getVersion()),version);
  assert.ok(await app.evaluate(({app})=>app.isPackaged));
  const initial=await page.evaluate(()=>window.scholarFlowDesktop.getComponentStatus());
  assert.ok(initial.components.some(c=>!c.optional&&c.status!=='ready'));
  record('Fresh installed EXE starts without models');
  await app.context().tracing.start({screenshots:true,snapshots:true});
  // Exercise the installed component manager/download/checksums, not source copies or mocks.
  for(const id of ['docling','bge-m3','whisper']) {
    console.log(`Installing real component ${id} on GitHub runner...`);
    const status=await page.evaluate(id=>window.scholarFlowDesktop.installComponent(id),id);
    assert.equal(status.status,'ready',JSON.stringify(status)); record(`Install ${id}`);
  }
  await page.goto(`${origin}/dashboard`);
  assert.ok((await page.locator('footer').textContent()).includes(`v${version}`), 'Footer must match installed EXE version');
  const logPath=path.join(dataDir,'logs/desktop.log');
  const log=await readFile(logPath,'utf8');
  const embedOrigin=[...log.matchAll(/local BGE-M3 tại (http:\/\/127\.0\.0\.1:\d+)/g)].at(-1)?.[1];
  assert.ok(embedOrigin);
  await until(async()=>{const r=await fetch(`${embedOrigin}/health`).catch(()=>null);return r?.ok && (await r.json()).status==='ready';},180000);
  db=new Database(path.join(dataDir,'data/scholarflow.db'),{readonly:true});
  const fixtures=path.resolve('test-fixtures/scholarflow');
  const files=[...(await readdir(path.join(fixtures,'01_library'))).filter(n=>/\.(pdf|docx|pptx|epub)$/.test(n)).map(n=>path.join(fixtures,'01_library',n)),
    ...['04_mindmap_text.pdf','05_mindmap_scan.pdf','06_mindmap_hien_dai.xmind','07_mindmap_legacy.xmind','09_xmind_anh_nhung.xmind','10_xmind_anh_nhung_legacy.xmind','02_audio_tieng_viet.mp3','03_audio_tieng_anh.wav'].map(n=>path.join(fixtures,'06_mindmap_audio',n))];
  const ids=[];
  for(const file of files) ids.push(await upload(origin,file));
  const imageDoc=ids[files.findIndex(f=>f.endsWith('09_xmind_anh_nhung.xmind'))];
  const imageText=db.prepare('SELECT textContent FROM Document WHERE id=?').get(imageDoc).textContent;
  assert.match(imageText,/Database transactions/);assert.match(imageText,/OSPF/);assert.match(imageText,/log V/);
  const englishChunk=db.prepare("SELECT id,pageNumber FROM DocumentChunk WHERE documentId=? AND sourceLabel LIKE '%Ảnh tiếng Anh%OCR%' LIMIT 1").get(imageDoc);
  assert.ok(englishChunk);
  await page.goto(`${origin}/documents/${imageDoc}?chunk=${englishChunk.id}&from=search&mode=visual#matched-chunk`);
  const sourceBranch=page.frameLocator('iframe').locator('#matched-preview');
  await sourceBranch.waitFor();
  assert.ok((await sourceBranch.getAttribute('data-path')).endsWith('Ảnh tiếng Anh'));
  await sourceBranch.locator('img.mindmap-image').waitFor();
  record('Open related OCR result selects exact English image branch, not similar Vietnamese branch');
  const reextract=await fetch(`${origin}/api/documents/${imageDoc}/reextract`,{method:'POST'});
  assert.ok(reextract.ok,await reextract.text());
  await until(()=>{
    const jobs=db.prepare("SELECT status,errorMessage FROM AnalysisJob WHERE documentId=? AND type != 'ANALYZE_DOCUMENT'").all(imageDoc);
    assert.ok(!jobs.some(j=>j.status==='FAILED'),JSON.stringify(jobs));
    return jobs.length>=3 && jobs.every(j=>j.status==='COMPLETED');
  },240000);
  assert.match(db.prepare('SELECT textContent FROM Document WHERE id=?').get(imageDoc).textContent,/Database transactions/);
  record('Reextract embedded image document');
  await page.goto(`${origin}/settings/ai-providers`);
  await page.getByRole('button',{name:'Thêm kết nối',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:/Custom API/}).click();
  await dialog.getByLabel('Tên hiển thị',{exact:true}).fill('Release QA Custom');
  await dialog.getByLabel('Base URL',{exact:false}).fill('http://127.0.0.1:39999/v1');
  await dialog.locator('input[type=password]').fill('test-only');
  await dialog.getByLabel('Chat model',{exact:true}).fill('test');
  await dialog.getByRole('button',{name:'Lưu kết nối',exact:true}).click();
  await page.getByText('Release QA Custom',{exact:true}).first().waitFor();
  await page.reload(); await page.getByText('Release QA Custom',{exact:true}).first().waitFor();
  const providers=await (await fetch(`${origin}/api/ai-providers`)).json();
  assert.ok(providers.providers.some(p=>p.displayName==='Release QA Custom'&&p.hasApiKey));
  record('Custom API settings saved through UI and persisted');
  await runReleaseApiRegression(origin, name => record(name));
  await page.goto(`${origin}/search?mode=visual`);
  await page.locator('.visual-search-shell input[type=file]').setInputFiles(path.join(fixtures,'06_mindmap_audio/09_xmind_anh_nhung.xmind'));
  const picture=page.frameLocator('.visual-canvas iframe').locator('img.mindmap-image').first();
  await picture.waitFor(); await page.locator('.visual-viewer').scrollIntoViewIfNeeded();
  for(let i=0;i<5;i++) await page.getByRole('button',{name:'Phóng to',exact:true}).click();
  await selectRect(await revealInViewer(picture));
  const query=page.locator('.visual-query-form textarea');
  await until(async()=>/OSPF/.test(await query.inputValue()),120000);
  await page.locator('.visual-result-list a').first().waitFor({timeout:120000});
  const before={query:await query.inputValue(),scroll:await page.locator('.visual-viewer').evaluate(el=>[el.scrollLeft,el.scrollTop]),selection:await page.locator('.visual-selection').getAttribute('style')};
  await page.screenshot({path:path.join(reportDir,'xmind-image-search.png')});
  await page.locator('.visual-result-list a').first().click();
  await page.getByRole('link',{name:'Quay lại kết quả tìm kiếm'}).click();
  await page.frameLocator('.visual-canvas iframe').locator('img.mindmap-image').first().waitFor();
  await pause(1000);
  assert.equal(await query.inputValue(),before.query);
  assert.equal(await page.locator('.visual-selection').getAttribute('style'),before.selection);
  const after=await page.locator('.visual-viewer').evaluate(el=>[el.scrollLeft,el.scrollTop]);
  assert.ok(after.every((v,i)=>Math.abs(v-before.scroll[i])<=2));
  record('Installed XMind image selection OCR + 150% zoom + Back viewport/query preservation');
  await page.getByRole('button',{name:'Mục sau',exact:true}).click();
  await until(async()=>await query.inputValue()==='');
  await page.frameLocator('.visual-canvas iframe').getByText('Ảnh Việt được dùng lại',{exact:true}).waitFor();
  record('Change XMind sheet clears old OCR');
  await page.locator('.visual-search-shell input[type=file]').setInputFiles(path.join(fixtures,'06_mindmap_audio/04_mindmap_text.pdf'));
  await page.locator('.visual-canvas > img').waitFor();
  await page.getByRole('button',{name:'Mục sau',exact:true}).click();
  await page.locator('.visual-page-controls summary').filter({hasText:'Trang 2/2'}).waitFor();
  await page.getByRole('button',{name:'Phóng to',exact:true}).click();
  await page.getByRole('button',{name:'Kéo để xem',exact:true}).click();
  const view=await page.locator('.visual-viewer').boundingBox();
  await page.mouse.move(view.x+view.width/2,view.y+view.height*.7);await page.mouse.down();await page.mouse.move(view.x+view.width/2-40,view.y+view.height*.3,{steps:8});await page.mouse.up();
  assert.ok(await page.locator('.visual-viewer').evaluate(el=>el.scrollTop>0||el.scrollLeft>0));
  await page.screenshot({path:path.join(reportDir,'pdf-page-2-pan.png')});record('Installed PDF worker, page 2, zoom and drag');
  assert.deepEqual(errors,[],'Renderer must not emit unexpected JavaScript exceptions');
  await app.context().tracing.stop({path:path.join(reportDir,'installed-ui-trace.zip')});
  await app.close();app=null;
  origin=await launch(); await page.goto(`${origin}/settings/ai-providers`);await page.getByText('Release QA Custom',{exact:true}).first().waitFor();
  const statuses=await page.evaluate(()=>window.scholarFlowDesktop.getComponentStatus());
  assert.ok(statuses.components.every(c=>c.status==='ready'));record('Restart installed EXE keeps settings, models and documents');
  assert.deepEqual(errors,[]);
} catch(error) {
  record('FAIL',error.stack||String(error));
  console.log(`::error::${String(error.stack||error).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')}`);
  if(page) await page.screenshot({path:path.join(reportDir,'failure.png')}).catch(()=>{});
  throw error;
} finally {
  if(app) { await app.context().tracing.stop({path:path.join(reportDir,'trace-final.zip')}).catch(()=>{});await app.close().catch(()=>{}); }
  db?.close();
  await writeFile(path.join(reportDir,'report.json'),JSON.stringify({version,records,errors},null,2));
  await writeFile(path.join(reportDir,'release-report.md'),`# Installed EXE verification ${version}\n\nWindows GitHub-hosted runner; real NSIS installation, real BGE-M3/Docling/Whisper.\n\n${records.map(r=>`- ${r.name}: ${r.detail}`).join('\n')}\n\nKnown OCR limitation: Vietnamese tuyến may be read as tuyên. XMind layout is reflowed.\n`);
  const log=await readFile(path.join(dataDir,'logs/desktop.log'),'utf8').catch(()=>'');await writeFile(path.join(reportDir,'desktop.log'),log);
}
