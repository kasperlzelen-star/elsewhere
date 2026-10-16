const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'dist/a-way-through-v01.html'),'utf8');
test('built document is standalone with exact runtime/style CSP hashes',()=>{
  const styles=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(x=>x[1]);
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
  assert.equal(styles.length,1);assert.equal(scripts.length,2);
  [...styles,...scripts].forEach(s=>assert.ok(html.includes("'sha256-"+crypto.createHash('sha256').update(s).digest('base64')+"'")));
  assert.ok(html.includes("connect-src 'none'"));assert.ok(html.includes("form-action 'none'"));
  assert.doesNotMatch(html,/\son(?:click|input|load|error)\s*=/i);
  assert.doesNotMatch(html,/<(?:script|iframe|audio|video|img)[^>]+\bsrc\s*=/i);
});
test('user-facing output uses text nodes and no persistent/network APIs',()=>{
  const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
  assert.doesNotMatch(app,/\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval|Function|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/);
  assert.ok(app.includes('textContent'));assert.ok(app.includes('MAX_FILE_BYTES'));
});
test('form ids are unique and input labels target existing controls',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,new Set(ids).size);
  [...html.matchAll(/\bfor="([^"]+)"/g)].forEach(x=>assert.ok(ids.includes(x[1]),x[1]));
  assert.doesNotMatch(html,/<input[^>]+type="checkbox"[^>]+\bchecked\b/i);
});
test('starting edition is valid and has no fabricated shared encounter',()=>{
  const C=require('../src/core.js');
  const seed=JSON.parse(html.match(/<script type="application\/json" id="starting-edition">([\s\S]*?)<\/script>/)[1]);
  assert.equal(C.validateEdition(seed).ok,true);assert.equal(seed.history.length,0);assert.equal(seed.selectedMaterial.length,0);
});
