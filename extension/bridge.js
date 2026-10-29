// Isolated-world bridge; only the paired tool tab is accepted by the worker.
(()=>{
 if(globalThis.__jobNotionBridge)return;globalThis.__jobNotionBridge=true;
 window.addEventListener('message',event=>{
  const m=event.data;
  if(event.source!==window||event.origin!==location.origin||!m||m.channel!=='job-notion-request'||!['status','extract'].includes(m.type)||typeof m.id!=='string'||m.id.length>100)return;
  if(!document.getElementById('websitePreview')||!document.getElementById('websitePanel'))return;
  const reply=value=>window.postMessage({channel:'job-notion-response',id:m.id,...value},location.origin);
  const port=chrome.runtime.connect({name:'website-fallback'});
  let done=false;const finish=value=>{if(done)return;done=true;clearInterval(keepalive);reply(value);port.disconnect();};
  const keepalive=setInterval(()=>{try{port.postMessage({type:'ping'});}catch{finish({error:'Extension disconnected. Reload the tool and try again.'});}},20000);
  port.onMessage.addListener(value=>{if(value.progress)reply(value);else finish(value);});
  port.onDisconnect.addListener(()=>{if(!done)finish({error:'Extension disconnected. Reload the tool and try again.'});});
  port.postMessage({type:m.type,url:m.url});
 });
})();
