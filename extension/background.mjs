import {capturePage} from './capture.mjs';
import {publicJobUrl} from './core.mjs';
chrome.action.onClicked.addListener(async tab=>{
 let capture;
 try{publicJobUrl(tab.url);const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:capturePage});capture=results[0]?.result;if(!capture)throw Error('No readable page content.');publicJobUrl(capture.url);}
 catch(e){capture={error:e.message||'The page could not be read.'};}
 // One pending capture, kept in browser session memory only; removed on opening.
 await chrome.storage.session.set({pendingCapture:capture});
 await chrome.tabs.create({url:chrome.runtime.getURL('review.html')});
});
