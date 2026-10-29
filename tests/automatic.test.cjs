const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const elements=new Map(),element=()=>({value:'',disabled:false,hidden:false,textContent:'',children:[],checkValidity:()=>true,append(x){this.children.push(x);},replaceChildren(){this.children=[];},setAttribute(k,v){this[k]=v;}}),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 let local=0,previews=0,writes=0,gmail=0,fail=false;
 const url='https://example.com/jobs/42';
 const rpc={connectionStatus:()=>({ready:true}),previewWebsiteRows:()=>({ticket:'normal',nextCursor:null,results:[{state:'ready',Company:'Parsed',Website:url+'/other',fields:[]},{state:'review',pageId:'row',Website:url,reason:'Unreadable',fallbackEligible:true},{state:'duplicate',Website:url+'/duplicate',reason:'Duplicate'}]}),previewBrowserFallback:(raw,date,id)=>{previews++;assert.equal(id,'row');assert.equal(JSON.parse(raw).Website,url);return {ticket:'local',result:{pageId:id,Website:url,Company:'Local',state:'ready',fields:['Company','Apply Date'],reason:'Fill'}};},fillBrowserFallback:(ticket,today,date)=>{writes++;assert.equal(ticket,'local');assert.equal(date,'2026-10-01');return {result:{state:'filled'}};},fillWebsiteRows:()=>{writes++;return {results:[{state:'filled'}]};},previewApplications:()=>{gmail++;return {ticket:'mail',nextCursor:null,results:[]};}};
 const run=(ok,bad)=>new Proxy({},{get:(_,k)=>k==='withSuccessHandler'?fn=>run(fn,bad):k==='withFailureHandler'?fn=>run(ok,fn):(...args)=>queueMicrotask(()=>{try{ok(rpc[k](...args));}catch(e){bad(e);}})});
 const c={document:{getElementById:get,createElement:element},google:{script:{run:run()}},Intl,Date,Promise,Set};vm.createContext(c);
 for(const x of fs.readFileSync('Index.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(x[1],c);
 c.localFallbackRequest=async(type,u)=>{if(fail)throw Error('Extension unavailable');if(type==='status')return {ready:true};local++;assert.equal(u,url);return {payload:{Website:url},notice:'Local AI assisted'};};
 await get('websitePreview').onclick();assert.equal(local,1);assert.equal(previews,1);assert.equal(writes,0);assert.equal(gmail,0);assert.equal(get('websiteFill').disabled,false);
 get('websiteDate').value='2026-10-01';get('websiteDate').onchange();assert.equal(local,1);await get('websiteFill').onclick();assert.equal(writes,2);
 fail=true;await get('websitePreview').onclick();assert.equal(local,1);assert.equal(previews,1);assert.equal(writes,2);assert.equal(get('websiteFill').disabled,false,'Successful original rows remain fillable');
 const rows=vm.runInContext('websiteResults',c);assert.match(rows[1].reason,/unavailable/);assert.equal(rows[2].state,'duplicate');
 await get('preview').onclick();assert.equal(gmail,1);assert.equal(local,1);
 console.log('Automatic Website UI: only failed rows, merged preview, no early writes, date changes, extension failure isolation and Gmail separation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
