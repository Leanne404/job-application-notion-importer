// Synthetic fixtures only. Network calls are mocked; live checks are run separately.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source='1'.repeat(32),pageId='2'.repeat(32),url='https://careers.example.com/jobs/engineer?id=42';
function context(){const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('Code.gs','utf8')+'\n'+fs.readFileSync('Website.gs','utf8'),c);return c;}
const c=context();
const posting={'@type':'JobPosting',title:'Software Engineer',hiringOrganization:{name:'Example &amp; Co'},identifier:{value:'arbitrary-external-id'},datePosted:'2010-01-01',url};
const html=data=>'<script type="application/ld+json">'+JSON.stringify(data)+'</script>';
assert.equal(c.websiteParse_(html(posting),url).Company,'Example & Co');
assert.equal(c.websiteParse_(html({'@graph':[posting]}),url).Position,'Software Engineer');
assert.equal(c.websiteParse_(html({...posting,url:undefined}),url).Website,url);
assert.throws(()=>c.websiteParse_(html([{...posting,url:undefined},{...posting,url:undefined}]),url),/single readable/);
assert.throws(()=>c.websiteParse_('<h1>Login required</h1>',url),/single readable/);
assert.equal(c.websiteKey_(url+'&utm_source=news#apply'),c.websiteKey_(url));
assert.notEqual(c.websiteKey_(url),c.websiteKey_(url.replace('42','43')));
assert.equal(c.websiteKey_('https://job-boards.greenhouse.io/example/jobs/42?gh_src=test'),c.websiteKey_('https://boards.greenhouse.io/example/jobs/42'));
assert.equal(c.websiteLinks_(url+' '+url+'#apply').length,1);
assert.equal(c.websiteUrl_('../other',url).url,'https://careers.example.com/other');
for(const bad of ['file:///etc/passwd','https://127.0.0.1/a','https://[::1]/','https://user:pass@example.com/a','https://example.com:8080/a','https://example.internal/a','https://example.com\\@localhost/a','javascript:alert(1)'])assert.throws(()=>c.websiteUrl_(bad));
for(const ip of ['127.0.0.1','10.1.1.1','172.16.1.1','192.168.1.1','169.254.169.254','100.64.0.1','::1','fc00::1','2001:db8::1'])assert.equal(c.websitePublicIp_(ip),false,ip);
assert.equal(c.websitePublicIp_('8.8.8.8'),true);
assert.equal(c.websitePublicIp_('2606:4700:4700::1111'),true);
for(const date of ['bad','2020-02-30','2020-1-1',null])assert.throws(()=>c.websiteDate_(date));
assert.equal(c.websiteDate_('2020-02-29'),'2020-02-29');
let requests=[],mode='page';
c.UrlFetchApp={fetch:(target,options)=>{
 requests.push(target);assert.equal(options.followRedirects,false);assert.equal(options.headers,undefined);assert.equal(options.payload,undefined);
 if(target.startsWith('https://dns.google/'))return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({Status:0,Answer:target.includes('AAAA')?[]:[{type:1,data:mode==='private'?'10.0.0.1':'8.8.8.8'}]})};
 return {getResponseCode:()=>mode==='blocked'?403:mode==='redirect'?302:200,getContentText:()=>html(posting),getAllHeaders:()=>({Location:'https://127.0.0.1/private'})};
}};
assert.equal(c.websiteRead_(url).Company,'Example & Co');
mode='private';requests=[];assert.throws(()=>c.websiteRead_(url),/public internet/);assert(requests.every(r=>r.startsWith('https://dns.google/')));
mode='redirect';assert.throws(()=>c.websiteRead_(url),/Private addresses/);
mode='blocked';assert.throws(()=>c.websiteRead_(url),/403/);
console.log('External structured job pages, URL normalization, redirects, public addresses and date validation passed.');
function fixture(){
 const ctx=context(),cache=new Map(),writes=[],page={id:pageId,created_time:'2020-01-01',last_edited_time:'first',parent:{data_source_id:source},properties:{Company:{type:'title',title:[]},Position:{type:'rich_text',rich_text:[]},Website:{type:'rich_text',rich_text:[{text:{content:url}}]},Status:{type:'select',select:null},'Apply Date':{type:'date',date:null}}};
 let pages=[page];
 ctx.checkSchema_=()=>{};ctx.dataSource_=()=>source;ctx.Utilities={getUuid:()=> 'ticket'};
 ctx.CacheService={getUserCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})};
 ctx.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
 ctx.Gmail=new Proxy({},{get(){throw Error('Website workflow must never use Gmail');}});
 ctx.websiteRead_=link=>({...ctx.websiteParse_(html(posting),link),keys:[ctx.websiteKey_(link)]});
 ctx.notion_=(path,method,body)=>{
  if(path.endsWith('/query'))return {results:pages,has_more:false};
  if(method==='patch'){assert.equal(path,'pages/'+page.id);writes.push(body);return page;}
  assert.equal(path,'pages/'+page.id);return page;
 };
 return {ctx,page,cache,writes,setPages:value=>{pages=value;}};
}
{
 const {ctx,page,writes}=fixture(),preview=ctx.previewWebsiteRows(null,'2020-01-02');
 assert.equal(writes.length,0);assert.equal(preview.results[0].state,'ready');
 assert.equal(ctx.fillWebsiteRows(preview.ticket,'2020-01-03').results[0].state,'filled');
 assert.deepEqual(Object.keys(writes[0].properties).sort(),['Apply Date','Company','Position','Status']);
 assert.equal(writes[0].properties['Apply Date'].date.start,'2020-01-02');
 assert.equal(page.properties.Website.rich_text[0].text.content,url);
 assert.throws(()=>ctx.fillWebsiteRows(preview.ticket,'2020-01-03'),/expired/);
 assert.equal(ctx.previewWebsiteRows().results.length,0);
}
{
 const {ctx,writes,page}=fixture();page.properties.Status.select={name:'Interviewing'};
 const preview=ctx.previewWebsiteRows();assert.equal(preview.results[0]['Apply Date'],'Today when confirmed');
 ctx.fillWebsiteRows(preview.ticket,'2020-01-04');assert.equal(writes[0].properties['Apply Date'].date.start,'2020-01-04');assert(!writes[0].properties.Status);
}
{
 const {ctx,writes,page}=fixture();page.properties['Apply Date'].date={start:'2019-01-01'};
 const preview=ctx.previewWebsiteRows(null,'2020-01-02');ctx.fillWebsiteRows(preview.ticket,'2020-01-03');assert(!writes[0].properties['Apply Date']);
}
for(const change of ['edit','parent','source','details']){
 const {ctx,page,writes}=fixture(),preview=ctx.previewWebsiteRows();
 if(change==='edit')page.last_edited_time='changed';
 if(change==='parent')page.parent.data_source_id='3'.repeat(32);
 if(change==='source')ctx.dataSource_=()=> '4'.repeat(32);
 if(change==='details')ctx.websiteRead_=()=>({Company:'Other company',Position:'Other job',Website:url,keys:[ctx.websiteKey_(url)]});
 if(change==='source')assert.throws(()=>ctx.fillWebsiteRows(preview.ticket,'2020-01-01'),/connection changed/);
 else assert(['review','error'].includes(ctx.fillWebsiteRows(preview.ticket,'2020-01-01').results[0].state));
 assert.equal(writes.length,0);
}
{
 const {ctx,page,writes,setPages}=fixture(),preview=ctx.previewWebsiteRows(),duplicate=JSON.parse(JSON.stringify(page));
 duplicate.id='0'.repeat(32);duplicate.properties.Company.title=[{text:{content:'Example & Co'}}];setPages([page,duplicate]);
 assert.equal(ctx.fillWebsiteRows(preview.ticket,'2020-01-01').results[0].state,'duplicate');assert.equal(writes.length,0);
 assert.equal(ctx.previewWebsiteRows().results.find(r=>r.pageId===page.id).state,'duplicate');
}
{
 const {ctx,page,setPages}=fixture(),other=JSON.parse(JSON.stringify(page));other.id='3'.repeat(32);
 other.properties.Website.rich_text=[{text:{content:'https://another.example.com/job/42'}}];other.properties.Company.title=[{text:{content:'Example & Co'}}];other.properties.Position.rich_text=[{text:{content:'Software Engineer'}}];setPages([page,other]);
 assert.equal(ctx.previewWebsiteRows().results.find(r=>r.pageId===page.id).state,'review');
}
{
 const {ctx,page,setPages}=fixture();const many=Array.from({length:6},(_,i)=>({...page,id:String(i+2).repeat(32)}));setPages(many);
 assert.equal(ctx.previewWebsiteRows().nextCursor,'5');assert.equal(ctx.previewWebsiteRows('5').nextCursor,null);
 ctx.notion_=()=>({results:[],has_more:true,next_cursor:'again'});assert.throws(()=>ctx.websitePages_(),/pagination/);
}
// Best-effort optional fields: partial pages still produce useful updates.
assert.equal(c.websiteParse_(html({...posting,title:undefined,jobLocation:{address:{addressLocality:'Austin',addressRegion:'TX',addressCountry:'US'}},baseSalary:{currency:'USD',value:{minValue:100000,maxValue:150000,unitText:'YEAR'}}}),url).Location,'Austin, TX, US');
assert.equal(c.websiteSalary_({currency:'USD',value:{minValue:100000,maxValue:150000,unitText:'YEAR'}}),'USD 100,000–150,000 / year');
assert.equal(c.websiteSalary_({currency:'usd',value:{value:25.1234,unitText:'hour'}}),'USD 25.1234 / hour');
assert.equal(c.websiteSalary_({currency:'USD',value:{minValue:100,maxValue:50}}),'');
assert.equal(c.websiteSalary_({currency:'USD',value:{value:100}}),'USD 100 (period unspecified)');
assert.equal(c.websiteLocation_({jobLocationType:'TELECOMMUTE',applicantLocationRequirements:[{name:'United States'}]}),'Remote (United States)');
{
 const {ctx,page,writes}=fixture();page.properties.Location={type:'rich_text',rich_text:[]};page.properties['Salary Range']={type:'rich_text',rich_text:[]};
 ctx.websiteRead_=()=>({Company:'',Position:'Engineer',Location:'Austin, TX','Salary Range':'USD 100,000–150,000 / year',Website:url,Status:'Applied',keys:[ctx.websiteKey_(url)]});
 const preview=ctx.previewWebsiteRows();assert.equal(preview.results[0].state,'ready');assert.match(preview.results[0].reason,/Not found: Company/);
 ctx.fillWebsiteRows(preview.ticket,'2020-01-01');assert(!writes[0].properties.Company);assert.equal(writes[0].properties.Location.rich_text[0].text.content,'Austin, TX');assert(writes[0].properties['Salary Range']);
}
{
 const {ctx,page,writes}=fixture();page.properties.Location={type:'rich_text',rich_text:[{text:{content:'Existing location'}}]};page.properties['Salary Range']={type:'number',number:null};
 ctx.websiteRead_=()=>({Company:'Example',Position:'Engineer',Location:'Different location','Salary Range':'USD 100–150 / hour',Website:url,Status:'Applied',keys:[ctx.websiteKey_(url)]});
 const preview=ctx.previewWebsiteRows();assert.match(preview.results[0].reason,/Salary Range needs a Text property/);
 ctx.fillWebsiteRows(preview.ticket,'2020-01-01');assert(!writes[0].properties.Location);assert(!writes[0].properties['Salary Range']);
}
{
 const {ctx,page,writes}=fixture();page.properties.Company.title=[{text:{content:'Example & Co'}}];page.properties.Position.rich_text=[{text:{content:'Software Engineer'}}];page.properties.Status.select={name:'Applied'};page.properties['Apply Date'].date={start:'2020-01-01'};page.properties.Location={type:'rich_text',rich_text:[]};
 ctx.websiteRead_=()=>({Company:'Example & Co',Position:'Software Engineer',Location:'Remote',Website:url,Status:'Applied',keys:[ctx.websiteKey_(url)]});
 let reads=0;ctx.websiteRead_=()=>{reads++;throw Error('Completed rows must not be read');};
 const preview=ctx.previewWebsiteRows();assert.equal(preview.results.length,0);assert.equal(reads,0);assert.equal(writes.length,0);
}
{
 const {ctx,page,writes}=fixture();page.properties.Location={type:'rich_text',rich_text:[]};
 const preview=ctx.previewWebsiteRows();ctx.websiteRead_=()=>({Company:'Example & Co',Position:'Software Engineer',Location:'New location after preview',Website:url,Status:'Applied',keys:[ctx.websiteKey_(url)]});
 ctx.fillWebsiteRows(preview.ticket,'2020-01-01');assert(!writes[0].properties.Location,'Only previewed available values may be written');
}
// A single Notion page is never its own duplicate, including UUID formatting variants.
{
 const {ctx,page,writes,setPages}=fixture();const copy=JSON.parse(JSON.stringify(page));
 copy.id=page.id.match(/.{8}|.{4}/g).join('-').toUpperCase();setPages([page,copy]);
 const preview=ctx.previewWebsiteRows();assert.equal(preview.results.length,1);assert.equal(preview.results[0].state,'ready');
 assert.equal(ctx.websiteDuplicate_(page,[copy],[ctx.websiteKey_(url)],{Company:'Example',Position:'Engineer'}),null);
 assert.equal(writes.length,0);
}
{
 const {ctx,page}=fixture();let calls=0;
 ctx.notion_=()=>++calls===1?{results:[page],has_more:true,next_cursor:'next'}:{results:[page],has_more:false};
 assert.equal(ctx.websitePages_().length,1);assert.equal(calls,2);
}
{
 const {ctx,page,writes}=fixture(),preview=ctx.previewWebsiteRows();
 page.properties.Company.title=[{text:{content:'Example'}}];page.properties.Position.rich_text=[{text:{content:'Engineer'}}];page.properties.Status.select={name:'Applied'};page.properties['Apply Date'].date={start:'2020-01-01'};
 ctx.websiteRead_=()=>{throw Error('Completed rows must not be read');};
 assert.equal(ctx.fillWebsiteRows(preview.ticket,'2020-01-01').results[0].state,'complete');assert.equal(writes.length,0);
}
{
 const packed={};vm.createContext(packed);vm.runInContext(fs.readFileSync('SingleFile.gs','utf8'),packed);
 for(const name of ['previewApplications','importApplications','previewWebsiteRows','fillWebsiteRows'])assert.equal(typeof packed[name],'function',name+' missing from deployment bundle');
}
console.log('Completed core fields skip optional work, self-matches are excluded, pages are unique and packaged endpoints exist.');
console.log('Partial extraction, locations, salary units, existing values, optional property types and approved-field writes passed.');
console.log('No Gmail calls, read-only previews, update-only writes, existing values, dates, duplicates, stale rows and pagination passed.');
(async()=>{
 const elements=new Map();const element=()=>({value:'',disabled:false,hidden:false,textContent:'',children:[],checkValidity:()=>true,append(x){this.children.push(x);},replaceChildren(){this.children=[];},setAttribute(k,v){this[k]=v;}});
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};let websiteReads=0,websiteWrites=0,gmailReads=0;
 const rpc={connectionStatus:()=>({ready:true}),previewWebsiteRows:()=>{websiteReads++;return {ticket:'web',nextCursor:null,results:[{Company:'Example',Position:'Engineer',Website:url,state:'ready',reason:'Fill blank fields'}]};},fillWebsiteRows:(ticket,today)=>{websiteWrites++;assert.match(today,/^\d{4}-\d{2}-\d{2}$/);return {results:[{state:'filled',reason:'Updated'}]};},previewApplications:()=>{gmailReads++;return {ticket:'gmail',nextCursor:null,results:[{state:'new'}]};}};
 const runner=(ok,fail)=>new Proxy({},{get:(_,key)=>key==='withSuccessHandler'?fn=>runner(fn,fail):key==='withFailureHandler'?fn=>runner(ok,fn):(...args)=>{queueMicrotask(()=>{try{ok(rpc[key](...args));}catch(e){fail(e);}});}});
 const browser={document:{getElementById:get,createElement:element},google:{script:{run:runner()}},Intl,Date,Promise,Set};vm.createContext(browser);
 const markup=fs.readFileSync('Index.html','utf8');vm.runInContext(markup.match(/<script>([\s\S]*?)<\/script>/)[1],browser);
 get('websiteMode').onclick();assert.equal(get('gmailPanel').hidden,true);assert.equal(get('websitePanel').hidden,false);
 await get('websitePreview').onclick();assert.equal(websiteReads,1);assert.equal(gmailReads,0);assert.equal(get('websiteFill').disabled,false);assert.equal(get('rows').children.length,0);
 await get('websiteFill').onclick();assert.equal(websiteWrites,1);
 get('gmailMode').onclick();await get('preview').onclick();assert.equal(gmailReads,1);assert.equal(get('import').disabled,false);
 get('websiteMode').onclick();await get('websitePreview').onclick();get('websiteDate').value='2020-02-03';get('websiteDate').onchange();assert.equal(get('websiteFill').disabled,false);assert.equal(get('import').disabled,false);
 rpc.previewWebsiteRows=()=>{throw Error('Website blocked');};await get('websitePreview').onclick();assert.equal(get('websitePreview').disabled,false);assert.equal(get('import').disabled,false);
 rpc.previewWebsiteRows=()=>{throw Error('Script function not found: previewWebsiteRows');};await get('websitePreview').onclick();assert.match(get('websiteMessage').textContent,/SingleFile.gs/);assert.match(get('websiteMessage').textContent,/New version/);
 assert(!/\p{Script=Han}/u.test(markup));
 console.log('Two workflow buttons, separate RPCs/results, preview invalidation and English UI passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Date is an output setting and can change after preview without reading websites again.
for(const selected of ['2020-02-03',null]){
 const {ctx,writes}=fixture(),preview=ctx.previewWebsiteRows(null,'2020-01-01');
 ctx.fillWebsiteRows(preview.ticket,'2020-03-04',selected);
 assert.equal(writes[0].properties['Apply Date'].date.start,selected||'2020-03-04');
}
