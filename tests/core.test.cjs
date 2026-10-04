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
assert.equal(ctx.previewApplications(5,{startSeconds:start,endSeconds:end}).hasMore,true);
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
assert.equal(ctx.parse_(zh).Company,'Example Company');
assert.throws(()=>ctx.parse_({...sample,subject:'Your application was viewed'}));
assert.throws(()=>ctx.applicationDate_('Date applied: 01/02/2020'));
assert.throws(()=>ctx.applicationDate_('Applied on: February 30, 2020'));
assert.equal(ctx.applicationDate_('Application date: 2 Jan 2020'),'2020-01-02');
assert(ctx.searchQuery_().includes('subject:"Your application was sent to"'));
assert(ctx.searchQuery_().includes('subject:"您的申请已发送至"'));
console.log('Chinese/English confirmation, explicit dates, recommendation exclusion and cross-language deduplication passed.');
