import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
import {publicJobUrl} from '../extension/core.mjs';import {origins,toolUrl,toolFrame,sameJob,cleanReply} from '../extension/automation.mjs';
const event=()=>({handlers:[],addListener(f){this.handlers.push(f);},fire(...args){for(const f of this.handlers)f(...args);}});
const ext='chrome-extension://synthetic/',tool='https://'+'script.google.com/macros/s/'+'synthetic/exec',job='https://example.com/jobs/42';
function port(name,sender){return {name,sender,messages:[],onMessage:event(),onDisconnect:event(),postMessage(m){this.messages.push(m);this.receive?.(m);},disconnect(){if(!this.closed){this.closed=true;this.onDisconnect.fire();}}};}
const session={pair:{tabId:1,url:tool}},tabs=new Map([[1,{id:1,url:tool}]]),created=[],removed=[];let next=10,modelPort,reads=0,redirect=false;
const chrome={runtime:{id:'synthetic',getURL:p=>ext+p,onConnect:event(),onMessage:event()},storage:{session:{get:async k=>({[k]:session[k]}),set:async o=>Object.assign(session,o),remove:async k=>delete session[k]}},permissions:{contains:async()=>true,remove:async()=>true},action:{onClicked:event()},scripting:{executeScript:async()=>{reads++;return [{result:{url:redirect?'https://example.com/login':job,text:'Example Engineer role '.repeat(10),blocks:[]}}];}},tabs:{onRemoved:event(),get:async id=>tabs.get(id),remove:async id=>{removed.push(id);tabs.delete(id);},create:async options=>{
 const tab={id:next++,url:options.url,status:'complete'};tabs.set(tab.id,tab);created.push(tab);
 if(options.url===ext+'runner.html')queueMicrotask(()=>{
  modelPort=port('local-runner',{id:'synthetic',url:ext+'runner.html',tab});
  modelPort.receive=m=>{if(m.type==='extract')modelPort.onMessage.fire({type:'capture',id:m.id});if(m.type==='capture')modelPort.onMessage.fire({type:'result',id:m.id,payload:{format:'job-notion-browser-v1',Website:job,Company:'Example',Position:'Engineer',Location:'','Salary Range':''}});};
  chrome.runtime.onConnect.fire(modelPort);
 });return tab;
}}};
const c={chrome,publicJobUrl,origins,toolUrl,toolFrame,sameJob,cleanReply,capturePage:()=>{},URL,crypto:webcrypto,setTimeout:(f,ms)=>setTimeout(f,ms>=480000?ms:0),clearTimeout};vm.createContext(c);vm.runInContext(fs.readFileSync('extension/background.mjs','utf8').replace(/^import .*;\n/gm,''),c);
const wait=async p=>{for(let i=0;i<200&&!p.closed;i++)await new Promise(r=>setTimeout(r,2));assert(p.closed,'Request did not finish');return p.messages.at(-1);};
const sender={id:'synthetic',url:'https://example-script.googleusercontent.com/userCodeAppPanel',tab:{id:1}};
async function request(m,s=sender){const p=port('website-fallback',s);chrome.runtime.onConnect.fire(p);p.onMessage.fire(m);return wait(p);}
assert.equal((await request({type:'status'})).ready,true);
assert.match((await request({type:'extract',url:job},{...sender,tab:{id:99}})).error,/Pair/);assert.equal(created.length,0);
assert.match((await request({type:'extract',url:'https://127.0.0.1/jobs'})).error,/public/);assert.equal(created.length,0);
const result=await request({type:'extract',url:job});assert.equal(result.payload.Company,'Example');assert.equal(reads,3);assert.equal(created.filter(t=>t.url===job).length,1);assert(removed.includes(created.find(t=>t.url===job).id));
redirect=true;assert.match((await request({type:'extract',url:job})).error,/changed/);assert.equal(created.filter(t=>t.url===ext+'runner.html').length,1,'Reuse model tab');
tabs.get(1).url='https://example.com';assert.match((await request({type:'status'})).error,/Pair/);
console.log('Extension worker: paired sender, URL rejection, automatic page capture, cleanup, model-tab reuse and navigation checks passed.');
// Run the real runner control flow with a deterministic local engine, no remote inference.
{
 const {fields,structuredFields,validatedAI,exportPayload}=await import('../extension/core.mjs');
 const p=port('local-runner',{}),elements=new Map();let loads=0,calls=0,mode='valid';
 const text='Example is hiring Engineer in Boston';
 const fakeEngine={chat:{completions:{create:async args=>{calls++;assert.equal(args.messages[1].content,text);if(mode==='failure')throw Error('GPU unavailable');return {choices:[{message:{content:JSON.stringify({Company:{value:'Example',evidence:text},Position:{value:'Engineer',evidence:text},Location:{value:'Boston',evidence:text},'Salary Range':{value:'Invented salary',evidence:text}})}}]};}}},unload:async()=>{},interruptGenerate:()=>{}};
 const r={fields,structuredFields,validatedAI,exportPayload,navigator:{gpu:{}},chrome:{runtime:{getURL:x=>ext+x,connect:()=>p}},document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);}},CreateMLCEngine:async()=>{loads++;return fakeEngine;},deleteModelAllInfoInCache:async()=>{},setInterval:()=>0,clearInterval:()=>{}};
 vm.createContext(r);vm.runInContext(fs.readFileSync('extension/runner.mjs','utf8').replace(/^import .*;\n/gm,''),r);
 const send=async m=>{for(const fn of p.onMessage.handlers)await fn(m);};
 for(const id of ['first','second']){await send({type:'extract',id,url:job});await send({type:'capture',id,data:{blocks:[],text}});const result=p.messages.at(-1);assert.equal(result.type,'result');assert.equal(result.payload.Company,'Example');assert.equal(result.payload['Salary Range'],'');}
 assert.equal(loads,1);assert.equal(calls,2);
 mode='failure';await send({type:'extract',id:'fail',url:job});await send({type:'capture',id:'fail',data:{blocks:[],text}});assert.equal(p.messages.at(-1).type,'error');
 await send({type:'extract',id:'structured',url:job});await send({type:'capture',id:'structured',data:{blocks:[JSON.stringify({'@type':'JobPosting',title:'Engineer',hiringOrganization:{name:'Example'}})],text}});assert.equal(p.messages.at(-1).type,'result');assert.equal(calls,3,'Structured data skips AI');
 assert(!p.messages.some(m=>'rawText' in m||'text' in (m.payload||{})));
 console.log('Local runner: automatic AI, grounded fields, model reuse, GPU error and structured-data fast path passed (model mocked).');
}
