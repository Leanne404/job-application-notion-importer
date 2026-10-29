import {capturePage} from './capture.mjs';
import {publicJobUrl} from './core.mjs';
import {origins,toolUrl,toolFrame,sameJob,cleanReply} from './automation.mjs';
let runner=null,runnerTab=null,opening=null,current=null;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const internal=(sender,path)=>sender.id===chrome.runtime.id&&sender.url===chrome.runtime.getURL(path);
chrome.action.onClicked.addListener(async tab=>{
 await chrome.tabs.create({url:chrome.runtime.getURL('setup.html')+'?tab='+tab.id});
});
async function paired(sender){
 const pair=(await chrome.storage.session.get('pair')).pair;
 if(!pair||sender.tab?.id!==pair.tabId||!toolFrame(sender.url))return false;
 const tab=await chrome.tabs.get(pair.tabId);return tab.url===pair.url&&toolUrl(tab.url);
}
async function closeJob(request){if(request.jobTab!=null){await chrome.tabs.remove(request.jobTab).catch(()=>{});request.jobTab=null;}}
function finish(request,value){
 if(current!==request)return;clearTimeout(request.timer);current=null;closeJob(request);
 try{request.port.postMessage(value);}catch{}request.port.disconnect();
}
async function ensureRunner(){
 if(runner)return;
 if(!opening)opening=(async()=>{
  const tab=await chrome.tabs.create({url:chrome.runtime.getURL('runner.html'),active:false});runnerTab=tab.id;
  for(let i=0;i<100&&!runner;i++)await pause(100);
  if(!runner)throw Error('Local AI window could not start. Reload the extension.');
 })().finally(()=>{opening=null;});
 await opening;
}
async function capture(request){
 const url=publicJobUrl(request.url);
 if(!await chrome.permissions.contains({origins}))throw Error('Enable website access in the extension setup first.');
 const tab=await chrome.tabs.create({url,active:false});request.jobTab=tab.id;
 let previous='',stable=0;
 for(let i=0;i<25;i++){
  await pause(1000);if(current!==request)throw Error('Preview cancelled.');
  const state=await chrome.tabs.get(tab.id);if(state.status!=='complete')continue;
  if(!sameJob(url,state.url))throw Error('The page redirected to a different address or login. Open it manually and review the link.');
  const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:capturePage});const data=results[0]?.result;
  if(!data||!sameJob(url,data.url))throw Error('The job page changed while reading. Preview again.');
  const text=data.text||'';stable=text===previous?stable+1:0;previous=text;
  if(text.length>=80&&stable>=2)return {text,blocks:data.blocks};
 }
 throw Error('The page did not provide readable text in time. Login, CAPTCHA or page loading may need attention.');
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{
 if(!internal(sender,'setup.html')&&!sender.url?.startsWith(chrome.runtime.getURL('setup.html')+'?'))return;
 if(sender.id!==chrome.runtime.id)return;
 (async()=>{
  if(m.type==='disable'){await chrome.storage.session.remove('pair');if(current)finish(current,{error:'Automatic fallback disabled.'});await chrome.permissions.remove({origins});return {ok:true};}
  if(m.type!=='pair'||!Number.isInteger(m.tabId))throw Error('Invalid setup request.');
  const tab=await chrome.tabs.get(m.tabId);
  if(!toolUrl(tab.url))throw Error('Open your private Apps Script /dev or /exec tool, then click this extension icon there.');
  if(!await chrome.permissions.contains({origins}))throw Error('Website access was not granted.');
  await chrome.storage.session.set({pair:{tabId:tab.id,url:tab.url}});
  await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},files:['bridge.js']});
  return {ok:true};
 })().then(respond,e=>respond({error:e.message}));return true;
});
chrome.runtime.onConnect.addListener(port=>{
 if(port.name==='local-runner'){
  if(!internal(port.sender,'runner.html')||runner){port.disconnect();return;}
  runner=port;
  port.onDisconnect.addListener(()=>{if(runner===port){runner=null;runnerTab=null;if(current)finish(current,{error:'Local AI window closed. Preview again.'});}});
  port.onMessage.addListener(async m=>{
   const r=current;if(!r||m.id!==r.id)return;
   try{
    if(m.type==='capture'){const data=await capture(r);if(current===r)port.postMessage({type:'capture',id:r.id,data});}
    else if(m.type==='progress'){r.port.postMessage({progress:String(m.text||'').slice(0,500)});}
    else if(m.type==='result')finish(r,{payload:cleanReply(m.payload,r.url),notice:String(m.notice||'').slice(0,300)});
    else if(m.type==='error')finish(r,{error:String(m.error||'Local extraction failed.').slice(0,500)});
   }catch(e){if(current===r){port.postMessage({type:'cancel',id:r.id});finish(r,{error:e.message});}}
  });return;
 }
 if(port.name!=='website-fallback'){port.disconnect();return;}
 let started=false;
 port.onMessage.addListener(async m=>{
  if(m.type==='ping'||started)return;started=true;
  try{
   if(!await paired(port.sender))throw Error('Pair this tool tab first: click the extension icon, then Enable automatic fallback.');
   if(m.type==='status'){port.postMessage({ready:await chrome.permissions.contains({origins})});port.disconnect();return;}
   if(m.type!=='extract')throw Error('Unsupported request.');
   if(current)throw Error('Another local extraction is running. Wait and preview again.');
   const url=publicJobUrl(m.url),r={id:crypto.randomUUID(),url,port,jobTab:null};current=r;
   r.timer=setTimeout(()=>{if(current===r){runner?.postMessage({type:'cancel',id:r.id});finish(r,{error:'Local fallback timed out. Check the AI window and preview again.'});}},480000);
   port.onDisconnect.addListener(()=>{if(current===r){runner?.postMessage({type:'cancel',id:r.id});finish(r,{error:'Tool tab disconnected.'});}});
   await ensureRunner();if(current===r)runner.postMessage({type:'extract',id:r.id,url});
  }catch(e){if(current?.port===port)finish(current,{error:e.message});else{try{port.postMessage({error:e.message});}catch{}port.disconnect();}}
 });
});
chrome.tabs.onRemoved.addListener(async id=>{const pair=(await chrome.storage.session.get('pair')).pair;if(pair?.tabId===id){await chrome.storage.session.remove('pair');if(current)finish(current,{error:'Tool tab closed.'});}});
