// Independent Website workflow. Gmail import remains in Code.gs.
function websiteUrl_(value, base) {
  let url=String(value||'').trim().replace(/&amp;/g,'&');
  if(base && !/^https?:\/\//i.test(url)) {
    const parent=websiteUrl_(base);
    if(url.startsWith('//')) url='https:'+url;
    else if(url.startsWith('/')) url='https://'+parent.host+url;
    else if(url.startsWith('?')) url='https://'+parent.host+parent.path+url;
    else if(url && !/^[a-z][a-z\d+.-]*:/i.test(url)) url='https://'+parent.host+parent.path.replace(/[^/]*$/,'')+url;
  }
  const match=url.match(/^https?:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(?:#.*)?$/i);
  if(!match || /[\s\\<>\x00-\x1f]/.test(url) || url.length>2000) throw Error('Website must contain a public HTTP or HTTPS job URL.');
  const host=match[1].toLowerCase().replace(/:443$/,'');
  if(!/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}$/.test(host) || /(?:^|\.)(?:localhost|local|internal|lan|test|invalid|example|onion)$/.test(host)) throw Error('Private addresses, credentials, and custom ports are not supported.');
  const parts=[];
  for(const piece of (match[2]||'/').slice(1).split('/')) {if(piece==='..')parts.pop();else if(piece!=='.')parts.push(piece);}
  const path='/'+parts.join('/'),query=match[3]||'';
  return {host,path,query,url:'https://'+host+path+query};
}
function websiteKey_(value) {
  const u=websiteUrl_(value), gh=u.host.match(/^(?:boards|job-boards)\.greenhouse\.io$/), m=u.path.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/);
  if(gh&&m)return 'greenhouse:'+m[1].toLowerCase()+':'+m[2];
  if(/^jobs(?:\.eu)?\.lever\.co$/.test(u.host)) {
    const lever=u.path.match(/^\/([^/]+)\/([a-f\d-]+)(?:\/apply)?\/?$/i);
    if(lever)return u.host+':'+lever[1].toLowerCase()+':'+lever[2].toLowerCase();
  }
  const li=u.host.match(/(?:^|\.)linkedin\.com$/)&&u.path.match(/\/(?:comm\/)?jobs\/view\/(?:[^/]*-)?(\d+)\/?$/);
  if(li)return 'linkedin:'+li[1];
  const params=u.query.slice(1).split('&').filter(Boolean).filter(p=>! /^(?:utm_[^=]*|gclid|fbclid|msclkid|mc_cid|mc_eid)=/i.test(p)).sort();
  return u.host+u.path.replace(/\/$/,'')+(params.length?'?'+params.join('&'):'');
}
function websiteLinks_(value) {
  const links=String(value||'').match(/https?:\/\/[^\s<>"\u0000-\u001f]+/gi)||[];
  const byKey=new Map();
  for(const link of links) {const u=websiteUrl_(link);byKey.set(websiteKey_(u.url),u.url);}
  return [...byKey.values()];
}
function websitePublicIp_(ip) {
  if(/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const p=ip.split('.').map(Number);if(p.some(n=>n>255))return false;
    const [a,b]=p;
    return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51)||a===203&&b===0);
  }
  // Only global unicast IPv6; reject documentation, Teredo, and 6to4 addresses.
  return /^[23][a-f\d]{3}:/i.test(ip)&&!/^2001:(?:0*:|db8:)|^2002:/i.test(ip);
}
function websiteCheckHost_(host) {
  const addresses=[];
  for(const type of ['A','AAAA']) {
    let response;
    try {response=UrlFetchApp.fetch('https://dns.google/resolve?name='+encodeURIComponent(host)+'&type='+type,{muteHttpExceptions:true,followRedirects:false});}
    catch(e){throw Error('The website address could not be verified. Try again later.');}
    if(response.getResponseCode()!==200)throw Error('The website address could not be verified.');
    const data=JSON.parse(response.getContentText());
    if(data.Status!==0)throw Error('The website address could not be resolved.');
    for(const answer of data.Answer||[])if(answer.type===1||answer.type===28)addresses.push(answer.data);
  }
  if(!addresses.length || addresses.some(ip=>!websitePublicIp_(ip)))throw Error('The website must resolve to a public internet address.');
}
function websiteFetch_(value) {
  let url=websiteUrl_(value).url;const seen=new Set(),urls=[];
  for(let hop=0;hop<5;hop++) {
    if(seen.has(url))throw Error('The website has a redirect loop.');seen.add(url);urls.push(url);
    websiteCheckHost_(websiteUrl_(url).host);
    let response;
    // No Notion/Gmail tokens, cookies, or authorization headers go to job websites.
    try {response=UrlFetchApp.fetch(url,{method:'get',muteHttpExceptions:true,followRedirects:false});}
    catch(e){throw Error('The job website could not be reached. Try again later.');}
    const status=response.getResponseCode();
    if([301,302,303,307,308].includes(status)) {
      const headers=response.getAllHeaders(),key=Object.keys(headers).find(k=>k.toLowerCase()==='location');
      if(!key)throw Error('The website redirect has no destination.');
      url=websiteUrl_(String(headers[key]),url).url;continue;
    }
    if(status!==200)throw Error('The job website returned '+status+'. It may be unavailable or require login.');
    const body=response.getContentText();
    if(body.length>3000000)throw Error('The job page is too large. Review it manually.');
    return {url,urls,body};
  }
  throw Error('The website redirects too many times.');
}
function websiteText_(value) {
  if(typeof value!=='string')return '';
  const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(all,key)=>{
    if(key[0]!=='#')return named[key.toLowerCase()];
    const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
    return n>0&&n<=0x10ffff?String.fromCodePoint(n):all;
  }).replace(/\s+/g,' ').trim();
}
function websiteDetails_(company,position,url) {
  company=websiteText_(company);position=websiteText_(position);
  if(!company||!position||company.length>2000||position.length>2000||/[<>\x00-\x1f]/.test(company+position))throw Error('The page does not provide a readable company and job title. Review it manually.');
  return {Company:company,Position:position,Website:url,Status:'Applied'};
}
function websiteParse_(html,url) {
  const jobs=[];
  const visit=(node,depth)=>{
    if(!node||typeof node!=='object'||depth>12)return;
    if(Array.isArray(node)){node.forEach(x=>visit(x,depth+1));return;}
    if([].concat(node['@type']||[]).some(t=>t==='JobPosting'||/\/JobPosting$/.test(t)))jobs.push(node);
    if(node['@graph'])visit(node['@graph'],depth+1);
    if(node.mainEntity)visit(node.mainEntity,depth+1);
  };
  for(const script of html.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try{visit(JSON.parse(script[1]),0);}catch(e){}
  }
  const exact=jobs.filter(j=>{try{return j.url&&websiteKey_(websiteUrl_(j.url,url).url)===websiteKey_(url);}catch(e){return false;}});
  const candidates=exact.length?exact:jobs;
  if(candidates.length!==1)throw Error('This page has no single readable job posting. Login-only, JavaScript-only, or job-list pages may need manual review.');
  const job=candidates[0];
  return websiteDetails_(job.hiringOrganization&&job.hiringOrganization.name,job.title,url);
}
function websiteRead_(value) {
  const u=websiteUrl_(value),match=u.path.match(/^\/([a-z\d_-]+)\/jobs\/(\d+)\/?$/i);
  // Greenhouse exposes published job details without an API key.
  if(/^(?:boards|job-boards)\.greenhouse\.io$/.test(u.host)&&match) {
    const response=websiteFetch_('https://boards-api.greenhouse.io/v1/boards/'+match[1]+'/jobs/'+match[2]);
    const job=JSON.parse(response.body);
    if(String(job.id)!==match[2])throw Error('The job website returned a different job.');
    const details=websiteDetails_(job.company_name,job.title,u.url);
    return Object.assign(details,{keys:[websiteKey_(u.url)]});
  }
  const response=websiteFetch_(u.url),details=websiteParse_(response.body,response.url);
  return Object.assign(details,{keys:[...new Set(response.urls.map(websiteKey_))]});
}
function websiteDate_(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Enter a valid application date.');
  const date=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw Error('Enter a valid application date.');
  return value;
}
function websiteRow_(page) {
  const p=page.properties;
  return {pageId:page.id,Company:text_(p.Company),Position:text_(p.Position),Website:text_(p.Website,true),Status:p.Status.select?p.Status.select.name:'','Apply Date':p['Apply Date'].date?p['Apply Date'].date.start.slice(0,10):''};
}
function websitePages_() {
  const pages=[],seen=new Set();let cursor;
  do {
    const response=notion_('data_sources/'+dataSource_()+'/query','post',{page_size:100,...(cursor?{start_cursor:cursor}:{})});
    pages.push(...response.results);cursor=response.has_more?response.next_cursor:null;
    if(response.has_more&&(!cursor||seen.has(cursor)))throw Error('Notion pagination is incomplete. Preview again.');
    if(cursor)seen.add(cursor);
  }while(cursor);
  return pages;
}
function websiteDuplicate_(page,pages,keys,details) {
  const score=p=>{const r=websiteRow_(p);return ['Company','Position','Apply Date','Status'].filter(k=>norm_(r[k])).length;};
  const candidates=pages.filter(p=>{
    try{return p.id===page.id||websiteLinks_(websiteRow_(p).Website).some(url=>keys.includes(websiteKey_(url)));}catch(e){return p.id===page.id;}
  });
  candidates.sort((a,b)=>score(b)-score(a)||String(a.created_time||'').localeCompare(String(b.created_time||''))||a.id.localeCompare(b.id));
  if(candidates[0]&&candidates[0].id!==page.id)return {state:'duplicate',reason:'Same job link already exists. This duplicate row is skipped, not deleted.'};
  if(details&&pages.some(p=>!candidates.some(c=>c.id===p.id)&&norm_(websiteRow_(p).Company)===norm_(details.Company)&&norm_(websiteRow_(p).Position)===norm_(details.Position)))return {state:'review',reason:'Another row has the same company and position. Review this possible duplicate before filling.'};
  return null;
}
function websiteProposal_(row,details,date) {
  for(const field of ['Company','Position'])if(norm_(row[field])&&norm_(row[field])!==norm_(details[field]))return Object.assign({},row,{state:'review',reason:'Existing '+field+' differs from the website. Review manually.'});
  const values=Object.assign({},details,{'Apply Date':date||'Today when confirmed'}),fields=['Company','Position','Status','Apply Date'].filter(k=>!norm_(row[k]));
  return Object.assign({},values,row,...fields.map(k=>({[k]:values[k]})),{Website:details.Website,fields,state:fields.length?'ready':'complete',reason:fields.length?'Fill: '+fields.join(', ')+'. Keep the original Website link.':'All fields already have values.'});
}
function previewWebsiteRows(cursor,date) {
  if(date)websiteDate_(date);
  const offset=cursor==null?0:Number(cursor);
  if(!Number.isSafeInteger(offset)||offset<0)throw Error('Invalid preview cursor.');
  checkSchema_();
  const source=dataSource_(),pages=websitePages_().sort((a,b)=>a.id.localeCompare(b.id)),results=[],entries=[],resolved=[];
  for(const page of pages.slice(offset,offset+5)) {
    const row=websiteRow_(page);if(!norm_(row.Website))continue;
    if(['Company','Position','Status','Apply Date'].every(k=>norm_(row[k])))continue;
    let display=Object.assign({},row,{Website:''});
    try {
      const urls=websiteLinks_(row.Website);
      if(urls.length!==1)throw Error('Website must contain exactly one public job link.');
      display.Website=urls[0];
      let duplicate=websiteDuplicate_(page,pages,[websiteKey_(urls[0])]);
      if(duplicate){results.push(Object.assign({},display,duplicate));continue;}
      const details=websiteRead_(urls[0]);
      duplicate=websiteDuplicate_(page,pages,details.keys,details);
      if(!duplicate&&resolved.some(x=>x.keys.some(k=>details.keys.includes(k))))duplicate={state:'duplicate',reason:'This job already appears in this preview batch.'};
      if(duplicate){results.push(Object.assign({},display,duplicate));continue;}
      const proposal=websiteProposal_(display,details,date);results.push(proposal);
      if(proposal.state==='ready') {
        resolved.push(details);
        entries.push({pageId:page.id,edited:page.last_edited_time,url:urls[0],Company:details.Company,Position:details.Position,keys:details.keys});
      }
    }catch(e){results.push(Object.assign({},display,{state:'review',reason:e.message}));}
  }
  const ticket=Utilities.getUuid();
  CacheService.getUserCache().put('website:'+ticket,JSON.stringify({source,date:date||null,entries}),1800);
  return {ticket,results,nextCursor:offset+5<pages.length?String(offset+5):null};
}
function fillWebsiteRows(ticket,today) {
  websiteDate_(today);
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Another operation is running. Try again shortly.');
  try {
    const cache=CacheService.getUserCache(),key='website:'+String(ticket),raw=cache.get(key);
    if(!raw)throw Error('This preview expired or was already used. Preview again.');cache.remove(key);
    const preview=JSON.parse(raw),source=dataSource_();
    if(preview.source!==source)throw Error('The Notion connection changed. Preview again.');checkSchema_();
    const results=[],pages=websitePages_();
    for(const entry of preview.entries) {
      let display={};
      try {
        const page=notion_('pages/'+entry.pageId),row=websiteRow_(page);
        const parent=page.parent&&page.parent.data_source_id;
        if(page.archived||page.in_trash||String(parent||'').replace(/-/g,'')!==source.replace(/-/g,''))throw Error('The row is no longer in the connected database.');
        display=Object.assign({},row,{Website:entry.url});
        const urls=websiteLinks_(row.Website);
        if(page.last_edited_time!==entry.edited||urls.length!==1||urls[0]!==entry.url){results.push(Object.assign({},display,{state:'review',reason:'The row changed after preview. Preview again.'}));continue;}
        const details=websiteRead_(entry.url);
        if(norm_(details.Company)!==norm_(entry.Company)||norm_(details.Position)!==norm_(entry.Position)){results.push(Object.assign({},display,{state:'review',reason:'Job details changed after preview. Preview again.'}));continue;}
        const duplicate=websiteDuplicate_(page,pages,details.keys,details);
        if(duplicate){results.push(Object.assign({},display,duplicate));continue;}
        const proposal=websiteProposal_(display,details,preview.date||today);
        if(proposal.state!=='ready'){results.push(proposal);continue;}
        const properties={},rt=value=>[{type:'text',text:{content:value}}];
        for(const field of proposal.fields)properties[field]=field==='Company'?{title:rt(proposal[field])}:field==='Position'?{rich_text:rt(proposal[field])}:field==='Status'?{select:{name:'Applied'}}:{date:{start:proposal[field]}};
        // Update only blanks. Website already supplied by the user stays intact.
        notion_('pages/'+entry.pageId,'patch',{properties});
        Object.assign(page.properties,properties);
        // Preserve Notion property types for the following duplicate checks.
        for(const field of Object.keys(properties))page.properties[field].type=field==='Company'?'title':field==='Position'?'rich_text':field==='Status'?'select':'date';
        const index=pages.findIndex(p=>p.id===page.id);if(index>=0)pages[index]=page;
        results.push(Object.assign({},proposal,{state:'filled',reason:'Blank fields filled. Original Website link preserved.'}));
      }catch(e){results.push(Object.assign({},display,{state:'error',reason:e.message}));break;}
    }
    return {results};
  }finally{lock.releaseLock();}
}
