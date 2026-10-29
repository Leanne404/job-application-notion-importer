import {origins} from './automation.mjs';
const message=document.getElementById('message');
document.getElementById('enable').onclick=async()=>{
 try{if(!await chrome.permissions.request({origins}))throw Error('Website access was not granted. Automatic fallback remains unavailable.');
 const result=await chrome.runtime.sendMessage({type:'pair',tabId:Number(new URL(location.href).searchParams.get('tab'))});if(result.error)throw Error(result.error);
 message.textContent='Paired. Return to your tool and click Preview websites. Failed pages will use local fallback automatically, then wait for your confirmation.';
 }catch(e){message.textContent=e.message;}
};
document.getElementById('disable').onclick=async()=>{try{const r=await chrome.runtime.sendMessage({type:'disable'});if(r.error)throw Error(r.error);message.textContent='Pairing and website access removed.';}catch(e){message.textContent=e.message;}};
