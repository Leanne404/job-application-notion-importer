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
function websiteGreenhouse_(u) {
  if(!/^(?:boards|job-boards)\.greenhouse\.io$/.test(u.host))return null;
  const match=u.path.match(/^\/([a-z\d_-]+)\/jobs\/(\d+)\/?$/i);
  if(match)return [match[1],match[2]];
  if(u.path!=='/embed/job_app')return null;
  const params={};
  for(const pair of u.query.slice(1).split('&')){const i=pair.indexOf('=');if(i>0){const k=decodeURIComponent(pair.slice(0,i));if(Object.prototype.hasOwnProperty.call(params,k))return null;params[k]=decodeURIComponent(pair.slice(i+1));}}
  return /^[a-z\d_-]+$/i.test(params.for||'')&&/^\d+$/.test(params.token||'')?[params.for,params.token]:null;
}
function websiteMeta_(html,key) {
  for(const tag of html.matchAll(/<meta\b[^>]*>/gi)){
    const attrs={};for(const a of tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g))attrs[a[1].toLowerCase()]=a[3];
    if((attrs.property||attrs.name||'').toLowerCase()===key)return websiteText_(attrs.content||'');
  }
  return '';
}
function websiteKey_(value) {
  const u=websiteUrl_(value), gh=u.host.match(/^(?:boards|job-boards)\.greenhouse\.io$/), m=u.path.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/);
  const greenhouse=websiteGreenhouse_(u);
  if(greenhouse)return 'greenhouse:'+greenhouse[0].toLowerCase()+':'+greenhouse[1];
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
function websiteValue_(value) {
  const text=websiteText_(value);
  return text&&text.length<=2000&&!/[<>\x00-\x1f]/.test(text)?text:'';
}
function websiteLocation_(job) {
  const locations=[].concat(job.jobLocation||[]).map(place=>{
    const address=place&&place.address;
    if(typeof address==='string')return websiteValue_(address);
    if(address){const country=typeof address.addressCountry==='object'?address.addressCountry.name:address.addressCountry;
      return [...new Set([address.addressLocality,address.addressRegion,country].map(websiteValue_).filter(Boolean))].join(', ');}
    return websiteValue_(place&&place.name);
  }).filter(Boolean);
  if(job.jobLocationType==='TELECOMMUTE'){
    const regions=[].concat(job.applicantLocationRequirements||[]).map(x=>websiteValue_(x&&x.name)).filter(Boolean);
    locations.unshift('Remote'+(regions.length?' ('+regions.join(', ')+')':''));
  }
  return websiteValue_([...new Set(locations)].join('; '));
}
function websiteSalary_(salary) {
  const salaries=[].concat(salary||[]).map(item=>{
    if(!item||typeof item!=='object')return '';
    const value=item.value&&typeof item.value==='object'?item.value:{value:item.value};
    const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
    const format=n=>{const [whole,fraction]=String(n).split('.');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction?'.'+fraction:'');};
    let amount='';
    if(valid(value.value))amount=format(value.value);
    else if(valid(value.minValue)&&valid(value.maxValue)&&value.minValue<=value.maxValue)amount=format(value.minValue)+'–'+format(value.maxValue);
    else if(valid(value.minValue)&&value.maxValue==null)amount='from '+format(value.minValue);
    else if(valid(value.maxValue)&&value.minValue==null)amount='up to '+format(value.maxValue);
    if(!amount)return '';
    const units={HOUR:'hour',DAY:'day',WEEK:'week',MONTH:'month',YEAR:'year'};
    const currency=typeof item.currency==='string'&&/^[A-Z]{3}$/i.test(item.currency)?item.currency.toUpperCase():'Currency unspecified';
    const unit=units[String(value.unitText||'').toUpperCase()];
    return currency+' '+amount+(unit?' / '+unit:' (period unspecified)');
  }).filter(Boolean);
  return websiteValue_([...new Set(salaries)].join('; '));
}
function websiteDetails_(company,position,url,location,salary) {
  return {Company:websiteValue_(company),Position:websiteValue_(position),Location:websiteValue_(location),'Salary Range':websiteValue_(salary),Website:url,Status:'Applied'};
}
// Use explicit employer statements only; do not infer an employer from a host or platform brand.
function websiteCompany_(job) {
  const organizations=[].concat(job.hiringOrganization||[]);
  const names=[...new Set(organizations.map(x=>websiteValue_(typeof x==='string'?x:x&&x.name)).filter(Boolean))];
  if(names.length)return names.length===1?names[0]:'';
  const description=websiteText_(String(job.description||'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ').replace(/<\/(?:p|div|li|h[1-6])\s*>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,''));
  const found=[];
  for(const match of description.matchAll(/(?:^|[.!?]\s+)([A-Z][A-Za-z0-9&’'(),.\-]*(?:\s+[A-Z0-9][A-Za-z0-9&’'(),.\-]*){0,7})\s+is\s+(?:currently\s+)?(?:seeking|hiring|recruiting|looking for)\s+(?:a|an)\s+/g)) {
    const name=websiteValue_(match[1]);
    if(name&&!/^(?:We|Who|This|It|Our|The|A|An|My|Your|Their|He|She|Someone|Everyone|Nobody)(?:\s|$)/i.test(name))found.push(name);
  }
  const unique=[...new Set(found)];
  return unique.length===1?unique[0]:'';
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
  return websiteDetails_(websiteCompany_(job),job.title,url,websiteLocation_(job),websiteSalary_(job.baseSalary));
}
function websiteRead_(value) {
  const u=websiteUrl_(value),greenhouse=websiteGreenhouse_(u),match=greenhouse&&[null,...greenhouse];
  // Greenhouse exposes published job details without an API key.
  if(/^(?:boards|job-boards)\.greenhouse\.io$/.test(u.host)&&match) {
    const response=websiteFetch_('https://boards-api.greenhouse.io/v1/boards/'+match[1]+'/jobs/'+match[2]+'?pay_transparency=true');
    const job=JSON.parse(response.body);
    if(String(job.id)!==match[2])throw Error('The job website returned a different job.');
    const salaries=(job.pay_input_ranges||[]).map(p=>({currency:p.currency_type,value:{minValue:typeof p.min_cents==='number'?p.min_cents/100:undefined,maxValue:typeof p.max_cents==='number'?p.max_cents/100:undefined}}));
    const details=websiteDetails_(job.company_name,job.title,u.url,job.location&&job.location.name,websiteSalary_(salaries));
    return Object.assign(details,{keys:[websiteKey_(u.url)]});
  }
  let response=websiteFetch_(u.url);
  if(/\.icims\.com$/.test(u.host)&&/^\/jobs\/\d+\//.test(u.path)){
    const frames=[...response.body.matchAll(/<iframe\b[^>]*>/gi)].filter(x=>/\bid=["']noscript_icims_content_iframe["']/i.test(x[0]));
    if(frames.length===1){
      const src=frames[0][0].match(/\bsrc=["']([^"']+)["']/i);
      if(src){const target=websiteUrl_(websiteText_(src[1]),response.url);
        if(target.host!==u.host||target.path!==u.path)throw Error('The embedded job page does not match the requested job.');
        const inner=websiteFetch_(target.url);response={...inner,urls:[...response.urls,...inner.urls]};
      }
    }
  }
  const final=websiteUrl_(response.url);let details;
  if(final.host==='ats.rippling.com'){
    const path=final.path.match(/^\/([^/]+)\/jobs\/([a-f\d-]+)\/?$/i);
    const script=response.body.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if(!path||!script)throw Error('This Rippling page has no readable job data.');
    const data=JSON.parse(script[1]),api=data.props&&data.props.pageProps&&data.props.pageProps.apiData;
    const job=api&&api.jobPost;
    if(!job||job.uuid!==path[2]||!api.jobBoard||api.jobBoard.slug!==path[1])throw Error('The Rippling page returned a different job.');
    const salary=(job.payRangeDetails||[]).map(p=>({currency:p.currency,value:{minValue:p.rangeStart,maxValue:p.rangeEnd,unitText:p.frequency}}));
    details=websiteDetails_(job.companyName||api.jobBoard.companyName,job.name,response.url,(job.workLocations||[]).map(websiteValue_).filter(Boolean).join('; '),websiteSalary_(salary));
  }else if(/^[a-z\d-]+\.breezy\.hr$/.test(final.host)&&/^\/p\/[a-f\d]+-[^/]+\/?$/i.test(final.path)){
    const title=websiteMeta_(response.body,'og:title');
    const heading=response.body.match(/<div\b[^>]*class=["']banner["'][^>]*>\s*<h1[^>]*>([^<]+)<\/h1>/i);
    const position=heading&&websiteText_(heading[1]);
    if(!position||!title.startsWith(position+' at '))throw Error('This Breezy page has no matching job title and employer.');
    const employer=title.slice((position+' at ').length);
    const location=websiteMeta_(response.body,'twitter:label1')==='Location'?websiteMeta_(response.body,'twitter:data1'):'';
    details=websiteDetails_(employer,position,response.url,location,'');
  }else details=websiteParse_(response.body,response.url);
  return Object.assign(details,{keys:[...new Set(response.urls.map(websiteKey_))]});
}
function websiteDate_(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Enter a valid application date.');
  const date=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw Error('Enter a valid application date.');
  return value;
}
function websiteOptional_(p) {
  if(!p)return '';
  if(p.type==='rich_text')return text_(p);
  if(p.type==='number')return p.number==null?'':String(p.number);
  if(p.type==='select')return p.select?p.select.name:'';
  if(p.type==='multi_select')return (p.multi_select||[]).map(x=>x.name).join(', ');
  return '[Not editable]';
}
// Keep rich-text link targets separate from adjacent visible text fragments.
function websiteProperty_(property) {
  if(!property)return '';
  if(property.type==='url')return property.url||'';
  const parts=property[property.type]||[];
  const values=[];let plain='';
  for(const part of parts){
    const target=part.href||(part.text&&part.text.link&&part.text.link.url);
    if(target){if(plain){values.push(plain);plain='';}values.push(target);}
    else plain+=part.plain_text||(part.text&&part.text.content)||'';
  }
  if(plain)values.push(plain);
  return [...new Set(values)].join(' ');
}
function websiteRow_(page) {
  const p=page.properties;
  return {pageId:page.id,Company:text_(p.Company),Position:text_(p.Position),Location:websiteOptional_(p.Location),'Salary Range':websiteOptional_(p['Salary Range']),Website:websiteProperty_(p.Website),Status:p.Status.select?p.Status.select.name:'','Apply Date':p['Apply Date'].date?p['Apply Date'].date.start.slice(0,10):''};
}
function websitePageId_(page) { return String(page.id||'').replace(/-/g,'').toLowerCase(); }
function websiteComplete_(row) { return ['Company','Position','Status','Apply Date'].every(k=>norm_(row[k])); }
function websitePages_() {
  const pages=new Map(),seen=new Set();let cursor;
  do {
    const response=notion_('data_sources/'+dataSource_()+'/query','post',{page_size:100,...(cursor?{start_cursor:cursor}:{})});
    for(const page of response.results){const id=websitePageId_(page);if(!id)throw Error('A Notion row has no ID. Preview again.');pages.set(id,page);}
    cursor=response.has_more?response.next_cursor:null;
    if(response.has_more&&(!cursor||seen.has(cursor)))throw Error('Notion pagination is incomplete. Preview again.');
    if(cursor)seen.add(cursor);
  }while(cursor);
  return [...pages.values()];
}
function websiteDuplicate_(page,pages,keys,details) {
  const score=p=>{const r=websiteRow_(p);return ['Company','Position','Apply Date','Status'].filter(k=>norm_(r[k])).length;};
  const candidates=pages.filter(p=>{
    try{return websitePageId_(p)===websitePageId_(page)||websiteLinks_(websiteRow_(p).Website).some(url=>keys.includes(websiteKey_(url)));}catch(e){return websitePageId_(p)===websitePageId_(page);}
  });
  candidates.sort((a,b)=>score(b)-score(a)||String(a.created_time||'').localeCompare(String(b.created_time||''))||a.id.localeCompare(b.id));
  if(candidates[0]&&websitePageId_(candidates[0])!==websitePageId_(page))return {state:'duplicate',reason:'Same job link already exists. This duplicate row is skipped, not deleted.'};
  if(details&&norm_(details.Company)&&norm_(details.Position)&&pages.some(p=>!candidates.some(c=>websitePageId_(c)===websitePageId_(p))&&norm_(websiteRow_(p).Company)===norm_(details.Company)&&norm_(websiteRow_(p).Position)===norm_(details.Position)))return {state:'review',reason:'Another row has the same company and position. Review this possible duplicate before filling.'};
  return null;
}
function websiteFields_(page) {
  return ['Company','Position','Status','Apply Date',...['Location','Salary Range'].filter(k=>page.properties[k]&&page.properties[k].type==='rich_text')];
}
function websiteProposal_(row,details,date,fields) {
  fields=fields||['Company','Position','Status','Apply Date'];
  for(const field of ['Company','Position'])if(norm_(row[field])&&norm_(details[field])&&norm_(row[field])!==norm_(details[field]))return Object.assign({},row,{state:'review',reason:'Existing '+field+' differs from the website. Review manually.'});
  const values=Object.assign({},details,{'Apply Date':date||'Today when confirmed'});
  const missing=fields.filter(k=>!norm_(row[k])),available=missing.filter(k=>norm_(values[k])),unavailable=missing.filter(k=>!norm_(values[k]));
  const reason=(available.length?'Fill: '+available.join(', ')+'. ':'No available values to fill. ')+(unavailable.length?'Not found: '+unavailable.join(', ')+'. ':'')+'Original Website and existing values are kept.';
  return Object.assign({},values,row,...available.map(k=>({[k]:values[k]})),{Website:details.Website,fields:available,state:available.length?'ready':'review',reason});
}
// Reuse a private per-preview snapshot instead of rereading Notion for every batch.
function websiteSnapshotWrite_(session,source,pages) {
  const compact=pages.map(page=>({id:page.id,created_time:page.created_time,last_edited_time:page.last_edited_time,
    properties:Object.fromEntries(['Company','Position','Website','Status','Apply Date','Location','Salary Range'].filter(k=>page.properties[k]).map(k=>[k,page.properties[k]]))}));
  const text=JSON.stringify(compact),cache=CacheService.getUserCache(),prefix='website-scan:'+session+':';
  const chunks=[];let start=0;
  while(start<text.length){let end=Math.min(start+20000,text.length);const last=text.charCodeAt(end-1);if(end<text.length&&last>=0xd800&&last<=0xdbff)end--;chunks.push(text.slice(start,end));start=end;}
  if(chunks.length>200)throw Error('This database is too large for one preview. Use a smaller tracker database.');
  // Each chunk stays below the cache byte limit, including non-ASCII text.
  chunks.forEach((chunk,i)=>cache.put(prefix+i,chunk,1800));
  cache.put(prefix+'meta',JSON.stringify({source,count:chunks.length}),1800);
}
function websiteSnapshotRead_(session,source) {
  const cache=CacheService.getUserCache(),prefix='website-scan:'+session+':',raw=cache.get(prefix+'meta');
  if(!raw)throw Error('This preview session expired. Preview again.');
  const meta=JSON.parse(raw);if(meta.source!==source)throw Error('The Notion connection changed. Preview again.');
  if(!Number.isSafeInteger(meta.count)||meta.count<1||meta.count>200)throw Error('Invalid preview session. Preview again.');
  const chunks=[];
  for(let i=0;i<meta.count;i++){const part=cache.get(prefix+i);if(part==null)throw Error('This preview session expired. Preview again.');chunks.push(part);}
  return JSON.parse(chunks.join(''));
}
function websiteSnapshotRemove_(session) {
  if(!session)return;
  const cache=CacheService.getUserCache(),prefix='website-scan:'+session+':',raw=cache.get(prefix+'meta');
  if(raw){const meta=JSON.parse(raw);for(let i=0;i<meta.count;i++)cache.remove(prefix+i);}
  cache.remove(prefix+'meta');
}
function previewWebsiteRows(cursor,date) {
  if(date)websiteDate_(date);
  const source=dataSource_();let offset=0,session=null,pages;
  if(cursor!=null){
    const match=String(cursor).match(/^([a-z\d-]{1,100}):(\d+)$/i);
    if(!match)throw Error('Invalid preview cursor. Start a new preview.');
    session=match[1];offset=Number(match[2]);
    if(!Number.isSafeInteger(offset)||offset<0)throw Error('Invalid preview cursor.');
    pages=websiteSnapshotRead_(session,source);
  }else{
    checkSchema_();pages=websitePages_().sort((a,b)=>a.id.localeCompare(b.id));
  }
  const candidates=pages.filter(page=>{const row=websiteRow_(page);return norm_(row.Website)&&!websiteComplete_(row);});
  if(offset>candidates.length)throw Error('Invalid preview cursor.');
  if(!session&&candidates.length>5){session=Utilities.getUuid();websiteSnapshotWrite_(session,source,pages);}
  const results=[],entries=[],resolved=[];
  for(const page of candidates.slice(offset,offset+5)) {
    const row=websiteRow_(page),fields=websiteFields_(page);
    let display=Object.assign({},row);
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
      const proposal=websiteProposal_(display,details,date,fields);
      const unsupported=['Location','Salary Range'].filter(k=>page.properties[k]&&page.properties[k].type!=='rich_text');
      if(unsupported.length)proposal.reason+=' Not filled: '+unsupported.join(', ')+' needs a Text property.';
      results.push(proposal);
      if(proposal.state==='ready') {
        resolved.push(details);
        entries.push({pageId:page.id,edited:page.last_edited_time,url:urls[0],values:Object.fromEntries(proposal.fields.filter(k=>k!=='Apply Date').map(k=>[k,proposal[k]])),fields:proposal.fields,keys:details.keys});
      }
    }catch(e){results.push(Object.assign({},display,{state:'review',reason:e.message}));}
  }
  const ticket=Utilities.getUuid();
  CacheService.getUserCache().put('website:'+ticket,JSON.stringify({source,date:date||null,entries}),1800);
  const nextCursor=offset+5<candidates.length?session+':'+(offset+5):null;
  if(!nextCursor)websiteSnapshotRemove_(session);
  return {ticket,results,nextCursor,checked:Math.min(offset+5,candidates.length),total:candidates.length,skipped:pages.length-candidates.length};
}
function fillWebsiteRows(ticket,today,selectedDate) {
  websiteDate_(today);
  if(selectedDate!==undefined&&selectedDate!==null)websiteDate_(selectedDate);
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
        if(websiteComplete_(row)){results.push(Object.assign({},display,{state:'complete',reason:'Company, Position, Status and Apply Date are already filled. Skipped.'}));continue;}
        const urls=websiteLinks_(row.Website);
        if(page.last_edited_time!==entry.edited||urls.length!==1||urls[0]!==entry.url){results.push(Object.assign({},display,{state:'review',reason:'The row changed after preview. Preview again.'}));continue;}
        const details=websiteRead_(entry.url);
        if(Object.entries(entry.values).some(([field,value])=>norm_(details[field])!==norm_(value))){results.push(Object.assign({},display,{state:'review',reason:'Job details changed after preview. Preview again.'}));continue;}
        const duplicate=websiteDuplicate_(page,pages,details.keys,details);
        if(duplicate){results.push(Object.assign({},display,duplicate));continue;}
        const proposal=websiteProposal_(display,details,selectedDate===undefined?(preview.date||today):(selectedDate||today),websiteFields_(page).filter(k=>entry.fields.includes(k)));
        if(proposal.state!=='ready'){results.push(proposal);continue;}
        const properties={},rt=value=>[{type:'text',text:{content:value}}];
        for(const field of proposal.fields)properties[field]=field==='Company'?{title:rt(proposal[field])}:['Position','Location','Salary Range'].includes(field)?{rich_text:rt(proposal[field])}:field==='Status'?{select:{name:'Applied'}}:{date:{start:proposal[field]}};
        // Update only blanks. Website already supplied by the user stays intact.
        notion_('pages/'+entry.pageId,'patch',{properties});
        Object.assign(page.properties,properties);
        // Preserve Notion property types for the following duplicate checks.
        for(const field of Object.keys(properties))page.properties[field].type=field==='Company'?'title':['Position','Location','Salary Range'].includes(field)?'rich_text':field==='Status'?'select':'date';
        const index=pages.findIndex(p=>websitePageId_(p)===websitePageId_(page));if(index>=0)pages[index]=page;
        results.push(Object.assign({},proposal,{state:'filled',reason:'Blank fields filled. Original Website link preserved.'}));
      }catch(e){results.push(Object.assign({},display,{state:'error',reason:e.message}));break;}
    }
    return {results};
  }finally{lock.releaseLock();}
}
