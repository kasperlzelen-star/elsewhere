import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url), C=require('./src/core.js');
const read=name=>fs.readFileSync(path.join(root,'src',name),'utf8');
let edition=C.createSeedEdition();
const flag=process.argv.indexOf('--edition');
if(flag>=0) {
  if(!process.argv[flag+1]) throw new Error('--edition requires a JSON file path');
  const validation=C.validateEdition(JSON.parse(fs.readFileSync(process.argv[flag+1],'utf8')));
  if(!validation.ok) throw new C.ValidationError(validation.errors);
  edition=validation.value;
}
const style=read('style.css'), core=read('core.js'), app=read('app.js');
const hash=text=>"'sha256-"+crypto.createHash('sha256').update(text).digest('base64')+"'";
const csp="default-src 'none'; img-src data:; style-src "+hash(style)+"; script-src "+hash(core)+" "+hash(app)+"; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none';";
const parts={
  '__STYLE__':style,'__CORE__':core,'__APP__':app,
  '__EDITION__':JSON.stringify(edition).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026'),
  '__CSP__':'<meta http-equiv="Content-Security-Policy" content="'+csp+'">'
};
let html=read('index.template.html').replace(/__(?:STYLE|CORE|APP|EDITION|CSP)__/g,token=>parts[token]);
if(/__(?:STYLE|CORE|APP|EDITION|CSP)__/.test(html))throw new Error('Unfilled template marker');
const dist=path.join(root,'dist');fs.mkdirSync(dist,{recursive:true});
const file=path.join(dist,'a-way-through-v01.html');fs.writeFileSync(file,html);
fs.writeFileSync(path.join(dist,'a-way-through-edition-'+edition.id+'.json'),JSON.stringify(edition,null,2)+'\n');
fs.writeFileSync(path.join(root,'build-record.json'),JSON.stringify({
  version:require('./package.json').version,date:'2026-10-16',editionId:edition.id,editionFingerprint:C.fingerprint(edition),
  htmlSha256:crypto.createHash('sha256').update(html).digest('hex'),
  bytes:Buffer.byteLength(html),standalone:true,
  runtime:'No dependencies, external assets, network, persistent storage or connected model'
},null,2)+'\n');
console.log(JSON.stringify({file,bytes:Buffer.byteLength(html),edition:edition.id}));
