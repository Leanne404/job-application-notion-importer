const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source='1'.repeat(32),id='2'.repeat(32),url='https://careers.example.com/jobs/42';
function setup(){
 const c={};vm.createContext(c);for(const f of ['Code.gs','Website.gs','BrowserFallback.gs'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
 const text=(v,type='rich_text')=>({type,[type]:[{plain_text:v,text:{content:v}}]});
 const page={id,last_edited_time:'before',parent:{data_source_id:source},properties:{Company:text('','title'),Position:text(''),Website:text(url),Location:text('Existing city'),'Salary Range':text(''),Status:{type:'select',select:null},'Apply Date':{type:'date',date:null}}};
 const cache=new Map(),writes=[];let pages=[page];
 c.dataSource_=()=>source;c.checkSchema_=()=>{};c.websitePages_=()=>pages;c.Utilities={getUuid:()=> 'ticket'};c.CacheService={getUserCache:()=>({put:(k,v)=>cache.set(k,v),get:k=>cache.get(k),remove:k=>cache.delete(k)})};c.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
 c.notion_=(path,method,body)=>{assert.equal(path,'pages/'+id);if(method){assert.equal(method,'patch');writes.push(body);}return page;};
 c.websiteRead_=()=>{throw Error('Must not fetch website');};c.UrlFetchApp={fetch:()=>{throw Error('No external fetch allowed');}};
 const payload=JSON.stringify({format:'job-notion-browser-v1',Website:url,Company:'Example',Position:'Engineer',Location:'New city','Salary Range':''});
 return {c,page,writes,payload,setPages:p=>pages=p};
}
{
 const {c,payload,writes}=setup(),p=c.previewBrowserFallback(payload,null);assert.equal(writes.length,0);assert.equal(p.result.Location,'Existing city');assert.equal(p.result['Apply Date'],'Today when confirmed');
 const r=c.fillBrowserFallback(p.ticket,'2026-10-28');assert.equal(r.result.state,'filled');assert.equal(writes.length,1);assert.equal(writes[0].properties['Apply Date'].date.start,'2026-10-28');assert.equal(writes[0].properties.Status.select.name,'Applied');assert(!('Website' in writes[0].properties));assert(!('Location' in writes[0].properties));assert.throws(()=>c.fillBrowserFallback(p.ticket,'2026-10-28'),/expired/);
}
{
 const {c,payload,writes}=setup();const p=c.previewBrowserFallback(payload,'2026-10-01');c.fillBrowserFallback(p.ticket,'2026-10-28');assert.equal(writes[0].properties['Apply Date'].date.start,'2026-10-01');
}
for(const mode of ['stale','archived','moved','connection','duplicate','removed']){
 const {c,payload,page,writes,setPages}=setup(),p=c.previewBrowserFallback(payload,null);
 if(mode==='stale')page.last_edited_time='after';if(mode==='archived')page.archived=true;if(mode==='moved')page.parent.data_source_id='other';if(mode==='connection')c.dataSource_=()=> 'other';if(mode==='duplicate')setPages([page,{...page,id:'3'.repeat(32)}]);if(mode==='removed')setPages([]);
 assert.throws(()=>c.fillBrowserFallback(p.ticket,'2026-10-28'),undefined,mode);assert.equal(writes.length,0);
}
{
 const {c,payload,setPages,page}=setup();setPages([]);assert.throws(()=>c.previewBrowserFallback(payload,null),/No matching/);setPages([page,{...page,id:'3'.repeat(32)}]);assert.throws(()=>c.previewBrowserFallback(payload,null),/duplicate/);
 for(const raw of ['null','[]','{}','x',JSON.stringify({...JSON.parse(payload),secret:'disallowed'}),JSON.stringify({...JSON.parse(payload),Company:'x'.repeat(1001)})])assert.throws(()=>c.browserPayload_(raw));
}
// Both inline UI scripts must parse without executing browser code.
for(const script of fs.readFileSync('Index.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
console.log('Browser fallback: preview-only, one-use confirmation, dates, preserved fields, stale rows, duplicates and payload validation passed.');
// Automatic fallback is eligible only after a real page-read failure, never a duplicate or unsafe host.
{
 const {c,page}=setup();c.websiteSnapshotRemove_=()=>{};
 assert.equal(c.previewWebsiteRows().results[0].fallbackEligible,true);
 c.websiteRead_=()=>{throw Error('The website must resolve to a public internet address.');};assert.equal(c.previewWebsiteRows().results[0].fallbackEligible,false);
 page.properties.Website.rich_text=[];assert.equal(c.previewWebsiteRows().results.length,0);
}
{
 const {c,payload,writes}=setup();assert.throws(()=>c.previewBrowserFallback(payload,null,'wrong-row'),/matching row changed/);
 const p=c.previewBrowserFallback(payload,'2026-10-01');c.fillBrowserFallback(p.ticket,'2026-10-28','2026-10-02');assert.equal(writes[0].properties['Apply Date'].date.start,'2026-10-02');
}
console.log('Automatic backend eligibility, expected-row validation and date changes passed.');
