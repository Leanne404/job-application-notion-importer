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
 let sequence=0;ctx.checkSchema_=()=>{};ctx.dataSource_=()=>source;ctx.Utilities={getUuid:()=> 'ticket-'+(++sequence)};
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
 const first=ctx.previewWebsiteRows();assert(first.nextCursor.endsWith(':5'));assert.equal(ctx.previewWebsiteRows(first.nextCursor).nextCursor,null);
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

// Completed rows never trigger site reads, and all preview batches share one Notion snapshot.
{
 const {ctx,page,cache}=fixture();let queries=0,reads=0;
 const pages=Array.from({length:206},(_,i)=>{
  const item=JSON.parse(JSON.stringify(page));item.id=String(i).padStart(32,'0');item.properties.Website.rich_text=[{text:{content:'https://careers.example.com/job/'+i}}];
  if(i<200){item.properties.Company.title=[{text:{content:'Company '+i}}];item.properties.Position.rich_text=[{text:{content:'Role '+i}}];item.properties.Status.select={name:'Applied'};item.properties['Apply Date'].date={start:'2020-01-01'};}
  return item;
 });
 ctx.notion_=(path,method,body)=>{queries++;const offset=Number(body.start_cursor||0);return {results:pages.slice(offset,offset+100),has_more:offset+100<pages.length,next_cursor:String(offset+100)};};
 ctx.websiteRead_=link=>{reads++;return {Company:'New Company '+reads,Position:'Engineer',Status:'Applied',Website:link,keys:[ctx.websiteKey_(link)]};};
 const first=ctx.previewWebsiteRows();assert.equal(first.total,6);assert.equal(first.skipped,200);assert.equal(first.checked,5);assert.equal(queries,3);assert.equal(reads,5);
 const last=ctx.previewWebsiteRows(first.nextCursor);assert.equal(last.checked,6);assert.equal(last.nextCursor,null);assert.equal(queries,3);assert.equal(reads,6);
 assert(![...cache.keys()].some(k=>k.startsWith('website-scan:')));
}
{
 const {ctx,page,setPages,cache}=fixture();setPages(Array.from({length:6},(_,i)=>({...page,id:String(i+2).repeat(32)})));
 const first=ctx.previewWebsiteRows(),session=first.nextCursor.split(':')[0];
 cache.delete('website-scan:'+session+':0');ctx.notion_=()=>{throw Error('Must not silently rescan after cache loss');};
 assert.throws(()=>ctx.previewWebsiteRows(first.nextCursor),/expired/);
}
console.log('206-row performance case: one three-page Notion scan, six incomplete-site reads, and safe cache expiry passed.');

{
 const {ctx,page,setPages}=fixture();setPages(Array.from({length:6},(_,i)=>({...page,id:String(i+2).repeat(32)})));
 const first=ctx.previewWebsiteRows();ctx.dataSource_=()=> '9'.repeat(32);
 assert.throws(()=>ctx.previewWebsiteRows(first.nextCursor),/connection changed/);
}
{
 const {ctx,page,cache}=fixture(),large=JSON.parse(JSON.stringify(page));large.properties.Company.title=[{text:{content:'Example '.repeat(12000)+'🚀'}}];
 ctx.websiteSnapshotWrite_('chunk-test',source,[large]);
 for(const [key,value] of cache)if(key.startsWith('website-scan:'))assert(Buffer.byteLength(value,'utf8')<100000);
 const result=ctx.websiteSnapshotRead_('chunk-test',source);assert.equal(result[0].properties.Company.title[0].text.content,large.properties.Company.title[0].text.content);
}

// Employer fallback uses explicit job-description statements, never a platform/domain guess.
{
 const parse=(description,organization={name:''})=>c.websiteParse_(html({...posting,hiringOrganization:organization,description}),url).Company;
 assert.equal(parse('Join our engineering team. ExampleCorp is seeking a Software Engineer to build tools.'),'ExampleCorp');
 assert.equal(parse('<p>Example Labs is hiring an Engineer.</p>'),'Example Labs');
 assert.equal(parse('ExampleCorp is currently looking for a developer.'),'ExampleCorp');
 assert.equal(parse('We are hiring. Experience using Microsoft products is required.'),'');
 assert.equal(parse('Our Client is seeking a developer.'),'');
 assert.equal(parse('ExampleCorp is seeking a developer. OtherCorp is hiring an engineer.'),'');
 assert.equal(parse('ExampleCorp is seeking a developer.',{name:'Explicit Employer'}),'Explicit Employer');
 assert.equal(parse('Nothing here.','String Employer'),'String Employer');
 assert.equal(parse('Nothing here.',[{name:'Array Employer'}]),'Array Employer');
 assert.equal(c.websiteCompany_({description:'<script>ExampleCorp is seeking a developer.</script>'}),'');
 assert.equal(parse('The company makes recruiting tools.'),'');
 console.log('Explicit employer description fallback and ambiguous-name safeguards passed.');
}

{
 const {ctx,page}=fixture();
 page.properties.Website.rich_text=[{plain_text:url.slice(0,30),href:url},{plain_text:url.slice(30),href:url}];
 assert.equal(ctx.previewWebsiteRows().results[0].state,'ready');
 page.properties.Website.rich_text=[{text:{content:'Job',link:{url}}}];
 assert.equal(ctx.previewWebsiteRows().results[0].state,'ready');
 page.properties.Website.rich_text=[{text:{content:'not a URL'}}];
 const bad=ctx.previewWebsiteRows().results[0];assert.equal(bad.state,'review');assert.equal(bad.Website,'not a URL');
 page.properties.Website.rich_text=[{text:{content:url+' https://careers.example.com/other'}}];
 assert.equal(ctx.previewWebsiteRows().results[0].state,'review');
 console.log('Fragmented Notion links, hidden targets, and visible invalid input passed.');
}

{
 const {ctx,page}=fixture();
 // A link label can look like a URL but differ from its actual target.
 page.properties.Website.rich_text=[{plain_text:url+'?ref=Displayed',href:url}];
 assert.equal(ctx.previewWebsiteRows().results[0].state,'ready');
 assert.equal(ctx.websiteRow_(page).Website,url);
 page.properties.Website.rich_text=[{plain_text:'Job',href:url},{plain_text:' https://careers.example.com/second'}];
 assert.equal(ctx.previewWebsiteRows().results[0].state,'review');
 page.properties.Website.rich_text=[{plain_text:'First',href:url},{plain_text:'Second',href:'https://careers.example.com/second'}];
 assert.equal(ctx.previewWebsiteRows().results[0].state,'review');
 console.log('URL-looking link labels do not count as extra links; real multiple links still require review.');
}
{
 const ctx=context(),link='https://job-boards.greenhouse.io/embed/job_app?for=example&token=42&jr_id=test';
 assert.equal(ctx.websiteKey_(link),ctx.websiteKey_('https://boards.greenhouse.io/example/jobs/42'));
 assert.equal(ctx.websiteGreenhouse_(ctx.websiteUrl_(link+'&token=43')),null);
 ctx.websiteFetch_=target=>{assert.equal(target,'https://boards-api.greenhouse.io/v1/boards/example/jobs/42?pay_transparency=true');return {body:JSON.stringify({id:42,company_name:'Example',title:'Engineer',location:{name:'City'}})};};
 assert.equal(ctx.websiteRead_(link).Company,'Example');
 const breezy='https://example.breezy.hr/p/012abc-engineer';
 ctx.websiteFetch_=()=>({url:breezy,urls:[breezy],body:'<meta property="og:title" content="Engineer at Example"><meta name="twitter:label1" content="Location"><meta name="twitter:data1" content="City, State"><div class="banner"><h1>Engineer</h1></div>'});
 const result=ctx.websiteRead_(breezy);assert.equal(result.Company,'Example');assert.equal(result.Position,'Engineer');assert.equal(result.Location,'City, State');
 ctx.websiteFetch_=()=>({url:breezy,urls:[breezy],body:'<meta property="og:title" content="Other at Example"><div class="banner"><h1>Engineer</h1></div>'});
 assert.throws(()=>ctx.websiteRead_(breezy),/matching job/);
 console.log('Greenhouse embedded URL extraction/deduplication and Breezy metadata checks passed.');
}
{
 const ctx=context(),u='https://careers.example.icims.com/jobs/42/engineer/job';let count=0;
 ctx.websiteFetch_=target=>({url:target,urls:[target],body:++count===1?'<iframe id="noscript_icims_content_iframe" src="'+u+'?in_iframe=1"></iframe>':html({...posting,url:u})});
 assert.equal(ctx.websiteRead_(u).Company,'Example & Co');assert.equal(count,2);
 ctx.websiteFetch_=target=>({url:target,urls:[target],body:'<iframe id="noscript_icims_content_iframe" src="https://other.example.com/jobs/42"></iframe>'});
 assert.throws(()=>ctx.websiteRead_(u),/does not match/);
 const r='https://ats.rippling.com/example/jobs/abc-123';
 const api={jobBoard:{slug:'example',companyName:'Example'},jobPost:{uuid:'abc-123',name:'Engineer',workLocations:['City, State'],payRangeDetails:[{currency:'USD',frequency:'YEAR',rangeStart:80000,rangeEnd:100000}]}};
 ctx.websiteFetch_=target=>({url:target,urls:[target],body:'<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{apiData:api}}})+'</script>'});
 const result=ctx.websiteRead_(r);assert.equal(result.Company,'Example');assert.equal(result.Location,'City, State');assert.equal(result['Salary Range'],'USD 80,000–100,000 / year');
 api.jobPost.uuid='wrong';assert.throws(()=>ctx.websiteRead_(r),/different job/);
 console.log('iCIMS same-job frame validation and Rippling job identity/location/salary passed.');
}
{
 const ctx=context(),u='https://jobright.ai/jobs/info/abc123';
 const data={jobResult:{jobId:'abc123',jobTitle:'Engineer',jobLocations:['Job City'],isDeleted:true},companyResult:{companyName:'Example',companyLocation:'Headquarters City'}};
 ctx.websiteFetch_=url=>({url,urls:[url],body:'<script id="jobright-helper-job-detail-info" type="application/json">'+JSON.stringify(data)+'</script>'});
 const r=ctx.websiteRead_(u);assert.equal(r.Company,'Example');assert.equal(r.Location,'Job City');assert.equal(r['Salary Range'],'');assert.match(r.notice,/removed or hidden/);
 assert.match(ctx.websiteProposal_({Company:'',Position:'',Status:'','Apply Date':''},r,null).reason,/removed or hidden/);
 data.jobResult.jobId='other';assert.throws(()=>ctx.websiteRead_(u),/different job/);
 console.log('Jobright identity, job versus headquarters location, and historical listing notice passed.');
}
{
 const ctx=context(),u='https://jobs.jobvite.com/example/job/abc123';
 ctx.websiteFetch_=target=>{assert.equal(target,u);return {url:target,urls:[target],body:'<title>Example Careers - Engineer</title><h2 class="jv-header">Engineer</h2><p class="jv-job-detail-meta">Technology<span class="jv-inline-separator"></span>City, State<span class="jv-inline-separator"></span>Remote, US</p>'};};
 const r=ctx.websiteRead_(u+'?jr_id=tracking');assert.equal(r.Company,'Example');assert.equal(r.Position,'Engineer');assert.equal(r.Location,'City, State; Remote, US');assert.equal(r['Salary Range'],'');assert(r.keys.includes(ctx.websiteKey_(u+'?jr_id=tracking')));
 ctx.websiteFetch_=target=>({url:target,urls:[target],body:'<title>Example Careers - Other</title><h2 class="jv-header">Engineer</h2>'});assert.throws(()=>ctx.websiteRead_(u),/matching employer/);
 console.log('Jobvite metadata and tracking-free fetch passed.');
}
{
 const ctx=context(),u='https://jobs.smartrecruiters.com/oneclick-ui/company/Example/publication/abc-123';
 ctx.websiteFetch_=target=>{assert.equal(target,'https://api.smartrecruiters.com/v1/companies/Example/postings/abc-123');return {body:JSON.stringify({uuid:'abc-123',name:'Engineer',company:{identifier:'Example',name:'Example Inc'},location:{fullLocation:'City'}})};};
 assert.equal(ctx.websiteRead_(u).Company,'Example Inc');
 const ea='https://jobs.ea.com/en_US/careers/JobDetail?jobId=42';
 ctx.websiteFetch_=url=>({url,urls:[url],body:'<meta property="og:title" content="Engineer"><meta property="og:site_name" content="Example"><meta property="og:url" content="https://jobs.ea.com/en_US/careers/JobDetail/Engineer/42"><strong>Locations</strong>: City<br>'});
 assert.equal(ctx.websiteRead_(ea).Location,'City');assert.throws(()=>ctx.websiteRead_(ea.replace('42','43')),/does not match/);
 console.log('SmartRecruiters API route and EA job identity tests passed.');
}
{
 const ctx=context(),u='https://tenant.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/42';
 const job={Id:'42',Title:'Engineer',PrimaryLocation:'Job City',CorporateDescriptionStr:'<p>Equal Employment Opportunity</p><p>Example, its parent, subsidiaries, and related companies (Example) provide equal employment.</p>'};
 ctx.websiteFetch_=target=>{assert(target.includes('recruitingCEJobRequisitionDetails'));assert(decodeURIComponent(target).includes('ById;Id="42",siteNumber=CX_1'));return {body:JSON.stringify({items:[job]})};};
 let r=ctx.websiteRead_(u);assert.equal(r.Company,'Example');assert.equal(r.Location,'Job City');
 job.CorporateDescriptionStr='';r=ctx.websiteRead_(u);assert.equal(r.Company,'');
 job.Id='43';assert.throws(()=>ctx.websiteRead_(u),/requested job/);
 console.log('Oracle endpoint, employer evidence, missing fields and job identity passed.');
}
