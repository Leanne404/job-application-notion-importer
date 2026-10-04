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
