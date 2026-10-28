export const fields=['Company','Position','Location','Salary Range'];
export function publicJobUrl(value){
 const u=new URL(value);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||!u.hostname.includes('.')||/^(?:\d+\.){3}\d+$/.test(u.hostname)||u.hostname.includes(':')||/(?:^|\.)(?:localhost|local|internal|lan|test|invalid|example|onion)$/.test(u.hostname))throw Error('Open a public HTTP or HTTPS job page.');
 if(/^(?:mail\.google\.com|script\.google\.com|accounts\.google\.com)$/.test(u.hostname)||/(?:^|\.)(?:notion\.so|notion\.com)$/.test(u.hostname))throw Error('Open the job website, not email, Notion, or Apps Script.');
 if([...u.searchParams.keys()].some(k=>/^(?:access_token|token|api_key|key|secret|password|authorization|code)$/i.test(k)&&!(k==='token'&&u.hostname==='job-boards.greenhouse.io'&&u.pathname==='/embed/job_app')))throw Error('This URL may contain credentials. Use the public job permalink.');
 return u.href;
}
export function clean(value){return typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/[\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().slice(0,1000):'';}
export function structuredFields(blocks){
 const jobs=[];function visit(x,depth=0){if(!x||typeof x!=='object'||depth>10)return;if(Array.isArray(x)){x.forEach(v=>visit(v,depth+1));return;}if([].concat(x['@type']||[]).some(t=>t==='JobPosting'||String(t).endsWith('/JobPosting')))jobs.push(x);if(x['@graph'])visit(x['@graph'],depth+1);if(x.mainEntity)visit(x.mainEntity,depth+1);}
 for(const block of blocks||[])try{visit(JSON.parse(block));}catch{}
 if(jobs.length!==1)return {values:{},message:jobs.length?'Multiple postings found. Enter fields manually or select one job before using AI.':'No single structured posting found. Use local AI or enter fields manually.'};
 const j=jobs[0],org=j.hiringOrganization;
 const locations=[].concat(j.jobLocation||[]).map(p=>{const a=p.address||{};return [a.addressLocality,a.addressRegion,typeof a.addressCountry==='object'?a.addressCountry.name:a.addressCountry].filter(x=>typeof x==='string').join(', ');}).filter(Boolean);
 return {values:{Company:clean(typeof org==='string'?org:org?.name),Position:clean(j.title),Location:clean((j.jobLocationType==='TELECOMMUTE'?'Remote; ':'')+locations.join('; ')),'Salary Range':''},message:'Structured fields extracted. Review against the visible job page before preparing data.'};
}
export function validatedAI(text,source){
 let obj;try{obj=JSON.parse(text);}catch{throw Error('The local model did not return valid JSON. Edit the fields manually or retry.');}
 const result={},evidence={};const normalize=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
 for(const field of fields){const item=obj[field],value=clean(item?.value),quote=clean(item?.evidence);if(value&&quote&&normalize(source).includes(normalize(quote))&&normalize(quote).includes(normalize(value))){result[field]=value;evidence[field]=quote;}else result[field]='';}
 return {values:result,evidence};
}
export function exportPayload(url,values){return {format:'job-notion-browser-v1',Website:publicJobUrl(url),...Object.fromEntries(fields.map(k=>[k,clean(values[k])]))};}
