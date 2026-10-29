import {build} from 'esbuild';
import {mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const spec=JSON.parse(await readFile('model-integrity.json','utf8'));
await mkdir('dist',{recursive:true});
let wasm;
try { const cached=await readFile('dist/model.wasm'); if(createHash('sha256').update(cached).digest('hex')===spec.sha256)wasm=cached; } catch {}
if(!wasm){const response=await fetch(spec.url);if(!response.ok)throw Error('Model runtime download failed: '+response.status);wasm=Buffer.from(await response.arrayBuffer());}
if(createHash('sha256').update(wasm).digest('hex')!==spec.sha256)throw Error('Model runtime checksum changed. Refusing to build.');
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await writeFile('dist/model.wasm',wasm);
await build({entryPoints:['runner.mjs'],outfile:'dist/runner.js',bundle:true,format:'esm',platform:'browser',target:'chrome120',legalComments:'eof'});
for(const file of ['manifest.json','review.css','background.mjs','capture.mjs','core.mjs','automation.mjs','bridge.js','setup.html','setup.mjs','runner.html'])await copyFile(file,'dist/'+file);
await copyFile('node_modules/@mlc-ai/web-llm/LICENSE','dist/WEBLLM-LICENSE');
console.log('Built extension/dist. No personal settings or model weights included.');
