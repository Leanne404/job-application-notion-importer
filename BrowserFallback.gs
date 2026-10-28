// Independent, explicitly reviewed browser capture. Never fetches a job page or Gmail.
function browserPayload_(raw) {
  if(typeof raw!=='string'||raw.length>12000)throw Error('Paste reviewed browser data (maximum 12,000 characters).');
  let data;try{data=JSON.parse(raw);}catch(e){throw Error('Browser data is not valid JSON.');}
  const fields=['Company','Position','Location','Salary Range'],allowed=['format','Website'].concat(fields);
  if(!data||Array.isArray(data)||data.format!=='job-notion-browser-v1'||Object.keys(data).some(k=>!allowed.includes(k)))throw Error('Unsupported browser data format.');
  for(const key of ['Website'].concat(fields))if(typeof data[key]!=='string'||data[key].length>(key==='Website'?4000:1000))throw Error('Invalid browser field: '+key+'.');
  const links=websiteLinks_(data.Website);
  if(links.length!==1||!fields.some(k=>data[k].trim()))throw Error('Provide one public job URL and at least one reviewed field.');
  return Object.assign({},data,{Website:links[0],Status:'Applied'});
}
function browserMatch_(pages,details) {
  const key=websiteKey_(details.Website),matches=pages.filter(p=>websiteLinks_(websiteRow_(p).Website).some(u=>websiteKey_(u)===key));
  if(matches.length!==1)throw Error(matches.length?'More than one Notion row has this job URL. Resolve duplicate rows first.':'No matching Notion row. Paste this job URL into its Website field first.');
  const page=matches[0];
  if(websiteLinks_(websiteRow_(page).Website).length!==1)throw Error('The matching row must contain exactly one Website link.');
  const duplicate=websiteDuplicate_(page,pages,[key],details);if(duplicate)throw Error(duplicate.reason);
  return page;
}
function previewBrowserFallback(raw,date) {
  if(date)websiteDate_(date);
  const details=browserPayload_(raw),source=dataSource_();checkSchema_();
  const page=browserMatch_(websitePages_(),details),row=websiteRow_(page);
  const proposal=websiteProposal_(row,details,date,websiteFields_(page));
  if(proposal.state!=='ready')return {result:proposal,ticket:null};
  const ticket=Utilities.getUuid();
  CacheService.getUserCache().put('browser:'+ticket,JSON.stringify({source,pageId:page.id,edited:page.last_edited_time,url:row.Website,details,fields:proposal.fields,date:date||null}),1800);
  return {result:proposal,ticket};
}
function fillBrowserFallback(ticket,today) {
  websiteDate_(today);
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Another operation is running. Try again shortly.');
  try {
    const cache=CacheService.getUserCache(),key='browser:'+String(ticket),raw=cache.get(key);
    if(!raw)throw Error('This preview expired or was already used. Preview again.');
    cache.remove(key); // A failed or uncertain write must be reviewed again, never replayed.
    const preview=JSON.parse(raw),source=dataSource_();
    if(preview.source!==source)throw Error('The Notion connection changed. Preview again.');checkSchema_();
    const pages=websitePages_(),match=browserMatch_(pages,preview.details);
    if(match.id!==preview.pageId)throw Error('The matching row changed. Preview again.');
    const page=notion_('pages/'+preview.pageId),row=websiteRow_(page);
    if(page.archived||page.in_trash||String(page.parent&&page.parent.data_source_id||'').replace(/-/g,'')!==source.replace(/-/g,''))throw Error('The row is no longer in the connected database.');
    if(page.last_edited_time!==preview.edited||row.Website!==preview.url)throw Error('The row changed after preview. Preview again.');
    const proposal=websiteProposal_(row,preview.details,preview.date||today,websiteFields_(page).filter(k=>preview.fields.includes(k)));
    if(proposal.state!=='ready')return {result:proposal};
    const properties={},rt=value=>[{type:'text',text:{content:value}}];
    for(const field of proposal.fields)properties[field]=field==='Company'?{title:rt(proposal[field])}:['Position','Location','Salary Range'].includes(field)?{rich_text:rt(proposal[field])}:field==='Status'?{select:{name:'Applied'}}:{date:{start:proposal[field]}};
    notion_('pages/'+page.id,'patch',{properties});
    return {result:Object.assign({},proposal,{state:'filled',reason:'Reviewed blank fields filled. Existing values and Website preserved.'})};
  }finally{lock.releaseLock();}
}
