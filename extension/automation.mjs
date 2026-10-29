import {publicJobUrl} from './core.mjs';
export const origins=['https://*/*','http://*/*'];
export function toolUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='script.google.com'&&/^\/macros\/s\/[^/]+\/(?:dev|exec)$/.test(u.pathname);}catch{return false;}}
export function toolFrame(value){try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='script.google.com'||/^[a-z0-9-]+-script\.googleusercontent\.com$/.test(u.hostname)||u.hostname==='script.googleusercontent.com');}catch{return false;}}
export function sameJob(requested,actual){
 const a=new URL(publicJobUrl(requested)),b=new URL(publicJobUrl(actual));
 const ignored=/^(?:utm_.+|ref|jr_id|source|gh_src)$/i;
 const identity=u=>JSON.stringify([u.hostname,u.pathname.replace(/\/$/,''),u.hash,[...u.searchParams].filter(([k])=>!ignored.test(k)).sort()]);
 return identity(a)===identity(b);
}
export function cleanReply(value,url){
 if(!value||typeof value!=='object'||value.Website!==url||value.format!=='job-notion-browser-v1')throw Error('Invalid local extraction result.');
 const result={format:value.format,Website:url};
 for(const field of ['Company','Position','Location','Salary Range']){if(typeof value[field]!=='string'||value[field].length>1000)throw Error('Invalid local extraction field.');result[field]=value[field];}
 if(!['Company','Position','Location','Salary Range'].some(k=>result[k].trim()))throw Error('No supported job fields found. Review this page manually.');
 return result;
}
