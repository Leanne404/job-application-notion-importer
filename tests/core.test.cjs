// Entirely synthetic fixtures. Never substitute real messages or accounts.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('Code.gs','utf8'),ctx);
const job='123'+'4567890';
const sample={id:'synthetic-message',sender:'LinkedIn <jobs-noreply@linkedin.com>',subject:'您的應徵資料已傳送到Example Company',body:`您的應徵資料已傳送到Example Company\n\nSoftware Engineer\nExample Company\nRemote\n查看職缺： https://www.linkedin.com/jobs/view/${job}/?tracking=example\n應徵日期：2020年1月2日\n下一步\nhttps://www.linkedin.com/jobs/view/999/`};
const a=ctx.parse_(sample);
assert.equal(a.Company,'Example Company');assert.equal(a['Apply Date'],'2020-01-02');assert.equal(a.Website,`https://www.linkedin.com/jobs/view/${job}/`);
assert.equal(ctx.decision_(a,[]).state,'new');
assert.equal(ctx.decision_(a,[a]).state,'duplicate');
assert.equal(ctx.decision_(a,[{...a,Website:a.Website+'?tracking=other',Company:'Changed name'}]).state,'duplicate');
assert.equal(ctx.decision_(a,[{...a,Company:'  EXAMPLE COMPANY ',Website:''}]).state,'duplicate');
assert.equal(ctx.decision_(a,[{...a,Website:'https://www.linkedin.com/jobs/view/999/'}]).state,'new');
assert.equal(ctx.decision_(a,[{...a,Website:'','Apply Date':'2019-01-02'}]).state,'review');
assert.throws(()=>ctx.parse_({...sample,sender:'not-a-sender'}));
assert.throws(()=>ctx.parse_({...sample,body:sample.body.replace('2020年1月2日','2020年2月31日')}));
let settings={};ctx.PropertiesService={getScriptProperties:()=>({getProperty:k=>settings[k]})};
assert.throws(()=>ctx.dataSource_());
settings.NOTION_DATA_SOURCE_ID='0'.repeat(32);assert.equal(ctx.dataSource_(),'0'.repeat(32));
console.log('Synthetic parser, duplicate checks and private configuration tests passed.');
// Search range boundaries and query injection rejection.
const start=Date.parse('2020-01-02T00:00:00Z')/1000,end=start+86400;
assert(ctx.searchQuery_({startSeconds:start,endSeconds:end}).endsWith(` after:${start-1} before:${end}`));
assert(!ctx.searchQuery_().includes(' after:'));
assert(ctx.searchQuery_({endSeconds:end}).endsWith(` before:${end}`));
assert(ctx.searchQuery_({startSeconds:start}).endsWith(` after:${start-1}`));
for(const range of [{startSeconds:'1 OR from:anyone'},{startSeconds:1.5},{startSeconds:-1},{startSeconds:end,endSeconds:start},{startSeconds:start,endSeconds:start}]) assert.throws(()=>ctx.searchQuery_(range));
// Run client date conversion in a DST-observing zone.
process.env.TZ='America/New_York';
const fields={startDate:{value:'2020-03-08',checkValidity:()=>true},endDate:{value:'2020-03-08',checkValidity:()=>true}};
const html=fs.readFileSync('Index.html','utf8');
const dateCode=html.slice(html.indexOf('function dateRange(){'),html.indexOf("$('dateHint').textContent"));
const ui={$:id=>fields[id]};vm.createContext(ui);vm.runInContext(dateCode,ui);
assert.equal(ui.dateRange().endSeconds-ui.dateRange().startSeconds,23*3600);
fields.startDate.value=fields.endDate.value='2020-11-01';
assert.equal(ui.dateRange().endSeconds-ui.dateRange().startSeconds,25*3600);
fields.startDate.value='2020-11-02';assert.throws(()=>ui.dateRange());
fields.startDate.value='';fields.endDate.value='';assert.equal(ui.dateRange().startSeconds,null);
// Verify the actual Gmail call gets the range and exposes truncation.
let captured;ctx.checkSchema_=()=>{};ctx.existing_=()=>[];
ctx.Gmail={Users:{Messages:{list:(user,args)=>{captured=args;return {messages:[],nextPageToken:'synthetic-next'};}}}};
ctx.Utilities={getUuid:()=> 'synthetic-preview'};ctx.CacheService={getUserCache:()=>({put:()=>{}})};
assert.equal(ctx.previewApplications({startSeconds:start,endSeconds:end}).nextCursor,'synthetic-next');
assert.equal(captured.q,ctx.searchQuery_({startSeconds:start,endSeconds:end}));
console.log('Date range validation, Gmail query, result cap, and 23/25-hour inclusive-day tests passed.');
for(const title of ['Your application was sent to','Your application has been sent to']) {
  for(const date of ['January 2, 2020','2 January 2020','Jan 2, 2020','2020-01-02']) {
    const en={...sample,subject:`Candidate, ${title} Example Company`,body:`${title} Example Company\nSoftware Engineer\nExample Company\nRemote\nView job: https://www.linkedin.com/comm/jobs/view/${job}/\nDate applied: ${date}\nSimilar jobs\nhttps://www.linkedin.com/jobs/view/999/`};
    assert.equal(ctx.parse_(en)['Apply Date'],'2020-01-02');
    assert.equal(ctx.parse_(en).Website,a.Website);
    assert.equal(ctx.decision_(ctx.parse_(en),[a]).state,'duplicate');
  }
}
const zh={...sample,subject:'您的申请已发送至Example Company',body:sample.body.replace('您的應徵資料已傳送到','您的申请已发送至').replace('應徵日期','申请日期')};
assert.throws(()=>ctx.parse_(zh));
assert.throws(()=>ctx.parse_({...sample,subject:'Your application was viewed'}));
assert.throws(()=>ctx.applicationDate_('Date applied: 01/02/2020'));
assert.throws(()=>ctx.applicationDate_('Applied on: February 30, 2020'));
assert.equal(ctx.applicationDate_('Application date: 2 Jan 2020'),'2020-01-02');
assert(ctx.searchQuery_().includes('subject:"Your application was sent to"'));
assert(!ctx.searchQuery_().includes('您的申请'));
console.log('Chinese/English confirmation, explicit dates, recommendation exclusion and cross-language deduplication passed.');
// Connection setup validates access/schema before saving, and never returns secrets.
const realNotion=ctx.notion_, source='1'.repeat(32), other='2'.repeat(32), database='3'.repeat(32);
const schema={Company:{type:'title'},Position:{type:'rich_text'},Website:{type:'rich_text'},'Apply Date':{type:'date'},Status:{type:'select',select:{options:[{name:'Applied'}]}}};
let saved={},unlocks=0;
ctx.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>unlocks++})};
ctx.PropertiesService={getScriptProperties:()=>({getProperty:k=>saved[k],setProperties:o=>Object.assign(saved,o),setProperty:(k,v)=>saved[k]=v})};
ctx.notion_=(path)=>path.startsWith('databases/')?{data_sources:[{id:source,name:'Example'}]}:{properties:schema};
const fakeSecret='ntn_'+'synthetic';
const setup=ctx.saveConnection(fakeSecret,'https://www.notion.so/Example-'+database+'?v=ignored');
assert.equal(setup.ready,true);assert(!JSON.stringify(setup).includes(fakeSecret));assert.equal(saved.NOTION_DATA_SOURCE_ID,source);
ctx.notion_=()=>({data_sources:[{id:source,name:'One'},{id:other,name:'Two'}]});
assert.equal(ctx.saveConnection(fakeSecret,database).sources.length,2);
assert.throws(()=>ctx.saveConnection(fakeSecret,database,'not-a-source'));
ctx.notion_=()=>{throw Error('access failure');};
assert.throws(()=>ctx.saveConnection(fakeSecret,database));assert.equal(saved.NOTION_DATA_SOURCE_ID,source);
assert.throws(()=>ctx.databaseId_('https://example.com/'+database));
// Multiple pages including >50 messages; tickets are tied to the destination.
let cache={},seq=0,existing=[];
ctx.CacheService={getUserCache:()=>({put:(k,v)=>cache[k]=v,get:k=>cache[k],remove:k=>delete cache[k]})};
ctx.Utilities={getUuid:()=>String(++seq)};
ctx.existing_=()=>existing.slice();ctx.message_=id=>({...sample,id,timestamp:start*1000});
ctx.Gmail={Users:{Messages:{list:(user,args)=>{
  const page=Number(args.pageToken||0);assert.equal(args.maxResults,20);
  return {messages:Array.from({length:20},(_,i)=>({id:'synthetic-'+(page*20+i)})),nextPageToken:page<2?String(page+1):undefined};
}}}};
const previews=[];let next=null,total=0;
do{const page=ctx.previewApplications({startSeconds:start,endSeconds:end},next);previews.push(page);total+=page.results.length;next=page.nextCursor;}while(next);
assert.equal(total,60);
let writes=0;ctx.notion_=(path,method,body)=>{if(String(path).includes('/templates'))return{templates:[],has_more:false};assert.equal(path,'pages');writes++;existing.push(a);return {id:'created',url:'https://example.com/result'};};
for(const page of previews)ctx.importApplications(page.ticket);
assert.equal(writes,1,'cross-page duplicates must only create one record');
const stale=ctx.previewApplications({},null);saved.NOTION_DATA_SOURCE_ID=other;
assert.throws(()=>ctx.importApplications(stale.ticket));saved.NOTION_DATA_SOURCE_ID=source;
assert.throws(()=>ctx.importApplications('missing-ticket'));
// Generated entrypoint serves exactly the maintained UI, no external file needed.
let served;
const single={HtmlService:{createHtmlOutput:html=>{served=html;return {setTitle:()=>true};}}};
vm.createContext(single);vm.runInContext(fs.readFileSync('SingleFile.gs','utf8'),single);single.doGet();assert.equal(served,html);
assert(!html.includes('id="limit"'));
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
console.log('Setup validation, multi-source selection, 60-message pagination, cross-page dedupe, stale tickets and single-file packaging passed.');
// Exercise browser orchestration with a small DOM/RPC substitute.
(async()=>{
  const elements=new Map();
  const element=()=>({value:'',disabled:false,hidden:false,textContent:'',children:[],checkValidity:()=>true,append(x){this.children.push(x);},replaceChildren(){this.children=[];}});
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const calls=[];let previewPage=0,imports=0;
  const rpc={connectionStatus:()=>({ready:true}),previewApplications:(range,cursor)=>{calls.push(cursor);const n=previewPage++;return {ticket:'ticket'+n,nextCursor:n<2?'page'+(n+1):null,results:[{...a,state:'new'}]};},importApplications:()=>{imports++;return {results:[{...a,state:'created'}]};}};
  const runner=(ok,fail)=>new Proxy({}, {get:(_,key)=>key==='withSuccessHandler'?fn=>runner(fn,fail):key==='withFailureHandler'?fn=>runner(ok,fn):(...args)=>{queueMicrotask(()=>{try{ok(rpc[key](...args));}catch(e){fail(e);}});}});
  const browser={document:{getElementById:get,createElement:element},google:{script:{run:runner()}},Intl,Date,Promise,Set};vm.createContext(browser);
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],browser);
  await get('preview').onclick();assert.equal(calls.length,3);assert.equal(get('import').disabled,false);
  await get('import').onclick();assert.equal(imports,3);assert.equal(get('import').disabled,true);
  previewPage=0;await get('preview').onclick();get('startDate').onchange();assert.equal(get('import').disabled,true);
  rpc.previewApplications=()=>{throw Error('synthetic preview failure');};await get('preview').onclick();assert.equal(get('import').disabled,true);assert.equal(get('preview').disabled,false);
  let fillCalls=0,fillUpdates=0;
  rpc.previewExistingRows=()=>({ticket:'fill-ticket'+fillCalls,nextCursor:++fillCalls<2?'fill-next':null,results:[{...a,state:'ready',reason:'Fill: Company'}]});
  rpc.fillExistingRows=()=>{fillUpdates++;return {results:[{...a,state:'filled'}]};};
  const originalRows=get('rows').children.length;
  await get('fillPreview').onclick();assert.equal(fillCalls,2);assert.equal(get('fillApply').disabled,false);assert.equal(get('rows').children.length,originalRows);
  await get('fillApply').onclick();assert.equal(fillUpdates,2);assert.equal(get('fillApply').disabled,true);
  rpc.previewExistingRows=()=>{throw Error('synthetic fill failure');};await get('fillPreview').onclick();assert.equal(get('fillApply').disabled,true);assert.equal(get('fillPreview').disabled,false);
  console.log('Client automatic paging, queued import, changed-filter invalidation and failure recovery passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Keep app-authored UI and error messages in English while retaining email patterns.
assert(!/\p{Script=Han}/u.test(html), 'UI text must be English');
assert(html.includes('lang="en"'));
const serverSource=fs.readFileSync('Code.gs','utf8');
for(const match of serverSource.matchAll(/(?:throw Error\(|reason:)\s*'([^']*)'/g)){
  assert(!/\p{Script=Han}/u.test(match[1]), 'Server messages must be English');
}
const errorCode=html.slice(html.indexOf('function errorMessage(e){'),html.indexOf('function error(e){'));
const errors={};vm.createContext(errors);vm.runInContext(errorCode,errors);
assert.equal(errors.errorMessage({message:'Preview expired.'}),'Preview expired.');
assert.match(errors.errorMessage({message:'服務暫時無法使用'}),/^The operation could not be completed/);
assert.match(errors.errorMessage(null),/^The operation could not be completed/);
console.log('English UI, server messages and localized service-error fallback passed.');

// Security regressions: display names cannot masquerade as the sender mailbox.
assert.throws(()=>ctx.parse_({...sample,sender:'jobs-noreply@linkedin.com <attacker@example.com>'}));
assert.throws(()=>ctx.parse_({...sample,sender:'LinkedIn <jobs-noreply@linkedin.com>, attacker@example.com'}));
assert.throws(()=>ctx.parse_({...sample,sender:'LinkedIn <jobs-noreply@linkedin.com>\r\nInjected: header'}));
assert.equal(ctx.parse_({...sample,sender:'jobs-noreply@linkedin.com'}).Company,'Example Company');
const securityContext={
  Utilities:{sleep:()=>{}},
  UrlFetchApp:{fetch:(url,options)=>{
    assert.equal(url,'https://api.notion.com/v1/pages');
    assert.equal(options.followRedirects,false);
    return {getResponseCode:()=>302,getContentText:()=>{throw Error('Redirect response must not be parsed');}};
  }}
};
vm.createContext(securityContext);vm.runInContext(serverSource,securityContext);
assert.throws(()=>securityContext.notion_('pages','post',{},'synthetic'),/302/);
const manifest=JSON.parse(fs.readFileSync('appsscript.json','utf8'));
assert.equal(manifest.webapp.access,'MYSELF');
assert.deepEqual(manifest.oauthScopes.slice().sort(),[
  'https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/script.external_request'
].sort());
assert(!/innerHTML\s*=|insertAdjacentHTML\s*\(/.test(html));
console.log('Sender mailbox, redirect refusal, read-only scopes and private deployment defaults passed.');
const emojiIcon=ctx.writableIcon_({type:'emoji',emoji:'💼'});
assert.equal(emojiIcon.type,'emoji');assert.equal(emojiIcon.emoji,'💼');
const nativeIcon=ctx.writableIcon_({type:'icon',icon:{name:'briefcase',color:'brown',extra:true}});
assert.equal(nativeIcon.type,'icon');assert.equal(nativeIcon.icon.name,'briefcase');assert.equal(nativeIcon.icon.color,'brown');
assert.deepEqual(Object.keys(nativeIcon.icon).sort(),['color','name']);
assert.equal(ctx.writableIcon_({type:'file',file:{url:'https://example.com/icon'}}),null);
assert.equal(ctx.writableIcon_({type:'external',external:{url:'http://example.com/icon'}}),null);
assert.equal(ctx.writableIcon_(null),null);
const iconCalls=[];
ctx.notion_=(path)=>{
  iconCalls.push(path);
  if(path.includes('/templates?start_cursor=next')) return {templates:[{id:'template-page',is_default:true},{id:'other-template',is_default:false}],has_more:false};
  if(path.includes('/templates')) return {templates:[{id:'ignored',is_default:false}],has_more:true,next_cursor:'next'};
  if(path==='pages/template-page') return {icon:{type:'emoji',emoji:'💼'}};
  throw Error('unexpected '+path);
};
const copied=ctx.defaultPageIcon_();
assert.equal(copied.type,'emoji');assert.equal(copied.emoji,'💼');
assert.deepEqual(iconCalls,['data_sources/'+source+'/templates','data_sources/'+source+'/templates?start_cursor=next','pages/template-page']);
ctx.notion_=()=>{throw Error('templates unavailable');};
assert.equal(ctx.defaultPageIcon_(),null);
console.log('Default template icons are copied, and unavailable templates leave the page unchanged.');

// Apps Script hands Gmail body.data over as bytes. Decoding those bytes as base64 throws "Could not decode string."
const plain='您的應徵資料已傳送到Example Company\nSoftware Engineer';
let base64Calls=0;
ctx.Utilities={
  base64DecodeWebSafe:value=>{
    if(typeof value!=='string') throw Error('Could not decode string.');
    base64Calls++;
    return Buffer.from(value,'base64url');
  },
  newBlob:value=>({getDataAsString:()=>Buffer.from(value).toString('utf8')})
};
const encoded=Buffer.from(plain,'utf8').toString('base64url');
assert.equal(ctx.body_({mimeType:'text/plain',body:{data:encoded}}),plain);
assert.equal(base64Calls,1);
const bytes=[...Buffer.from(plain,'utf8')];
assert.equal(ctx.body_({mimeType:'multipart/alternative',parts:[
  {mimeType:'text/html',body:{data:bytes}},
  {mimeType:'text/plain',body:{data:bytes}}
]}),plain);
assert.equal(base64Calls,1,'Gmail bytes from Apps Script must not be decoded as base64 again');
console.log('Gmail body decoding accepts both base64url text and Apps Script byte arrays.');

// Website-only backfill uses existing pages, never creation or job posting dates.
const fillCtx={};vm.createContext(fillCtx);vm.runInContext(fs.readFileSync('Code.gs','utf8'),fillCtx);
const fillSource='4'.repeat(32),fillPageId='5'.repeat(32),fillCache=new Map(),fillWrites=[];
const emptyRow={Company:'',Position:'',Status:'',Website:a.Website,'Apply Date':''};
assert.equal(fillCtx.fillProposal_(emptyRow,a).state,'ready');
assert.equal(fillCtx.fillProposal_({...emptyRow,Status:'Interviewing'},a).Status,'Interviewing');
assert(!fillCtx.fillProposal_({...emptyRow,Status:'Interviewing'},a).fields.includes('Status'));
assert.equal(fillCtx.fillProposal_({...emptyRow,Company:'Other'},a).state,'review');
let page={id:fillPageId,parent:{data_source_id:fillSource},last_edited_time:'synthetic-time',properties:{Company:{type:'title',title:[]},Position:{type:'rich_text',rich_text:[]},Status:{select:null},Website:{type:'rich_text',rich_text:[{text:{content:a.Website}}]},'Apply Date':{date:null}}};
fillCtx.dataSource_=()=>fillSource;fillCtx.checkSchema_=()=>{};
fillCtx.Utilities={getUuid:()=> 'synthetic-fill'};
fillCtx.CacheService={getUserCache:()=>({put:(k,v)=>fillCache.set(k,v),get:k=>fillCache.get(k),remove:k=>fillCache.delete(k)})};
fillCtx.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
fillCtx.message_=()=>sample;
fillCtx.Gmail={Users:{Messages:{list:()=>({messages:[{id:sample.id}]})}}};
fillCtx.notion_=(path,method,body)=>{
  if(path.endsWith('/query'))return {results:[page],has_more:true,next_cursor:'synthetic-next'};
  if(method==='patch'){fillWrites.push(body);return page;}
  assert.equal(path,'pages/'+fillPageId);return page;
};
let fillPreview=fillCtx.previewExistingRows();assert.equal(fillPreview.nextCursor,'synthetic-next');assert.equal(fillWrites.length,0);
assert.equal(fillPreview.results[0].state,'ready');
assert.equal(fillCtx.fillExistingRows(fillPreview.ticket).results[0].state,'filled');
assert.deepEqual(Object.keys(fillWrites[0].properties).sort(),['Apply Date','Company','Position','Status']);
assert.equal(fillWrites[0].properties.Status.select.name,'Applied');
assert.throws(()=>fillCtx.fillExistingRows(fillPreview.ticket),/expired/);
fillPreview=fillCtx.previewExistingRows();page.last_edited_time='changed';
assert.equal(fillCtx.fillExistingRows(fillPreview.ticket).results[0].state,'review');assert.equal(fillWrites.length,1);
fillPreview=fillCtx.previewExistingRows();page.parent.data_source_id='6'.repeat(32);
assert.equal(fillCtx.fillExistingRows(fillPreview.ticket).results[0].state,'error');assert.equal(fillWrites.length,1);
fillCtx.Gmail.Users.Messages.list=()=>({messages:[]});assert.throws(()=>fillCtx.fillMatch_(job),/No supported/);
fillCtx.Gmail.Users.Messages.list=()=>({messages:[],nextPageToken:'more'});assert.throws(()=>fillCtx.fillMatch_(job),/Too many/);
fillCtx.Gmail.Users.Messages.list=()=>({messages:[{id:'one'},{id:'two'}]});
fillCtx.message_=id=>({...sample,body:id==='two'?sample.body.replace('2020年1月2日','2020年1月3日'):sample.body});
assert.throws(()=>fillCtx.fillMatch_(job),/disagree/);
fillCtx.message_=()=>sample;assert.throws(()=>fillCtx.fillMatch_('999'),/No supported/);
console.log('Backfill preview, exact-job matching, conflicts, preservation, stale tickets, changed rows and update-only fillWrites passed.');
