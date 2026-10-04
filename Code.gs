function dataSource_() {
  const id = PropertiesService.getScriptProperties().getProperty('NOTION_DATA_SOURCE_ID');
  if (!id || !/^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i.test(id)) {
    throw Error('請在指令碼屬性設定有效的 NOTION_DATA_SOURCE_ID');
  }
  return id;
}
const MAIL_QUERY = 'from:jobs-noreply@linkedin.com {subject:"您的應徵資料已傳送到" subject:"Your application was sent to" subject:"Your application has been sent to"}';
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('申請紀錄小幫手');
}
function norm_(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim(); }
function ids_(s) { return [...String(s || '').matchAll(/https?:\/\/(?:[\w-]+\.)?linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)/gi)].map(m=>m[1]); }
function confirmationCompany_(line) {
  const m=String(line||'').trim().match(/^(?:您的應徵資料已傳送到|Your application (?:was|has been) sent to)\s*(.+)$/i);
  return m ? m[1].trim() : null;
}
function applicationDate_(main) {
  let m=main.match(/(?:應徵日期)\s*[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
  let y,month,day;
  if(m) { [,y,month,day]=m; }
  else {
    const dateLine=main.match(/(?:Date applied|Applied on|Application date)\s*[:：]?\s*([^\r\n]+)/i);
    if(!dateLine) throw Error('缺少明確申請日期，請手動確認');
    const value=dateLine[1].replace(/-{3,}.*$/,'').trim();
    const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    if((m=value.match(/^(\d{4})-(\d{2})-(\d{2})$/))) [,y,month,day]=m;
    else if((m=value.match(/^([A-Za-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/))) {
      month=months.indexOf(m[1].toLowerCase().slice(0,3))+1;day=m[2];y=m[3];
    } else if((m=value.match(/^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+)\.?,? (\d{4})$/))) {
      day=m[1];month=months.indexOf(m[2].toLowerCase().slice(0,3))+1;y=m[3];
    } else throw Error('申請日期格式不明確，請手動確認');
  }
  const iso=String(y)+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  const parsed=new Date(iso+'T00:00:00Z');
  if(!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==iso) throw Error('日期格式不正確');
  return iso;
}
function parse_(m) {
  if (!/(?:^|[<\s])jobs-noreply@linkedin\.com(?:>|$)/i.test(m.sender)) throw Error('不是 LinkedIn 確認信寄件者');
  if (!/(?:您的應徵資料已傳送到|Your application (?:was|has been) sent to)/i.test(m.subject)) throw Error('不是支援的申請確認信');
  const lines=String(m.body||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const header=lines.findIndex(line=>confirmationCompany_(line));
  if(header<0) throw Error('信件格式不同，請手動確認');
  const company=confirmationCompany_(lines[header]),position=lines[header+1];
  if(!position || norm_(company)!==norm_(lines[header+2])) throw Error('公司資訊不一致');
  // Bound the card at its explicit application-date line, before recommendations.
  const dateIndex=lines.findIndex((line,i)=>i>header+2 && /^(?:應徵日期|Date applied|Applied on|Application date)\s*[:：]?/i.test(line));
  if(dateIndex<0) throw Error('缺少明確申請日期，請手動確認');
  const main=lines.slice(header,dateIndex+1).join('\n');
  const ids=[...new Set(ids_(main))];
  if(ids.length!==1) throw Error('缺少或無法確認主職缺連結');
  return {Company:company,Position:position,Status:'Applied',Website:'https://www.linkedin.com/jobs/view/'+ids[0]+'/',
    'Apply Date':applicationDate_(main),messageId:m.id};
}
function decision_(a, rows) {
  const ai = ids_(a.Website);
  for (const b of rows) {
    const bi = ids_((b.Website||'')+' '+(b.Position||''));
    if (ai.some(x=>bi.includes(x))) return {state:'duplicate',reason:'相同 LinkedIn 職缺',url:b.url||''};
  }
  let uncertain;
  for (const b of rows) {
    if (norm_(a.Company)!==norm_(b.Company)) continue;
    const bi=ids_((b.Website||'')+' '+(b.Position||''));
    if (ai.length && bi.length) continue;
    const pos=norm_(a.Position)===norm_(b.Position), day=a['Apply Date']===b['Apply Date'];
    if(pos && day) return {state:'duplicate',reason:'公司、職位與日期相同',url:b.url||''};
    if(pos || (!b.Position && day)) uncertain={state:'review',reason:'可能是已有申請，請確認',url:b.url||''};
  }
  return uncertain || {state:'new',reason:'可新增',url:''};
}
function token_() {
  const t=PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN');
  if(!t) throw Error('請先在專案設定的指令碼屬性新增 NOTION_TOKEN，並將 Job Tracker 連接至該 Notion integration。');
  return t;
}
function notion_(path, method, body, secret) {
  // Never retry page creation: an ambiguous timeout may have already committed.
  Utilities.sleep(350);
  const response=UrlFetchApp.fetch('https://api.notion.com/v1/'+path,{
    method:method||'get',headers:{Authorization:'Bearer '+(secret||token_()),'Notion-Version':'2025-09-03'},
    contentType:'application/json',payload:body===undefined?undefined:JSON.stringify(body),muteHttpExceptions:true
  });
  if(response.getResponseCode()>=300) throw Error('Notion 連線失敗（'+response.getResponseCode()+'）。請檢查授權；若剛才正在匯入，重新預覽會核對已完成項目。');
  return JSON.parse(response.getContentText());
}
function validateSchema_(p) {
  for(const [name,type] of Object.entries({Company:'title',Position:'rich_text',Status:'select',Website:'rich_text','Apply Date':'date'})) {
    if(!p[name] || p[name].type!==type) throw Error('Notion 欄位 '+name+' 類型不符，請檢查資料庫。');
  }
  if(!p.Status.select.options.some(o=>o.name==='Applied')) throw Error('Status 缺少 Applied 選項');
}
function checkSchema_() { validateSchema_(notion_('data_sources/'+dataSource_()).properties); }
function connectionStatus() {
  const p=PropertiesService.getScriptProperties();
  return {ready:!!(p.getProperty('NOTION_TOKEN') && p.getProperty('NOTION_DATA_SOURCE_ID'))};
}
function databaseId_(value) {
  const input=String(value||'').trim();
  if (/^[a-f0-9-]{32,36}$/i.test(input)) return input.replace(/-/g,'');
  if (!/^https:\/\/(?:www\.|app\.)?notion\.(?:so|com)\//i.test(input)) throw Error('請貼上 Notion 原始資料庫的連結');
  const path=input.split('?')[0].split('#')[0];
  const match=path.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/?$/i);
  if(!match) throw Error('無法從連結辨識資料庫，請先將表格開啟為整頁再複製連結');
  return match[1].replace(/-/g,'');
}
function saveConnection(secret, databaseLink, selectedSource) {
  secret=String(secret||'').trim();
  if(!/^(?:ntn_|secret_)[A-Za-z0-9_-]+$/.test(secret)) throw Error('請貼上有效的 Notion 連線密鑰');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) throw Error('正在處理其他操作，請稍後再試');
  try {
    const database=notion_('databases/'+databaseId_(databaseLink),'get',undefined,secret);
    const sources=database.data_sources||[];
    if(!sources.length) throw Error('此連結沒有資料來源，請使用原始資料庫連結');
    if(sources.length>1 && !selectedSource) return {ready:false,sources:sources.map(x=>({id:x.id,name:x.name}))};
    const source=selectedSource?sources.find(x=>x.id===selectedSource):sources[0];
    if(!source) throw Error('請選擇這個資料庫中的資料來源');
    validateSchema_(notion_('data_sources/'+source.id,'get',undefined,secret).properties);
    // Save only after both access and schema validation pass; never return the secret.
    PropertiesService.getScriptProperties().setProperties({NOTION_TOKEN:secret,NOTION_DATA_SOURCE_ID:source.id});
    return {ready:true};
  } finally {lock.releaseLock();}
}
function text_(p, links) {
  if(!p) return '';
  if(p.type==='url') return p.url||'';
  return (p[p.type]||[]).map(x=>(x.plain_text || (x.text&&x.text.content) || '')+(links&&x.href?' '+x.href:'')).join('');
}
function existing_() {
  let cursor, rows=[];
  do {
    const body={page_size:100}; if(cursor) body.start_cursor=cursor;
    const page=notion_('data_sources/'+dataSource_()+'/query','post',body);
    rows.push(...page.results.map(r=>{
      const p=r.properties;
      return {url:r.url,Company:text_(p.Company),Position:text_(p.Position),Website:text_(p.Website,true),
        'Apply Date':p['Apply Date']&&p['Apply Date'].date?p['Apply Date'].date.start.slice(0,10):''};
    }));
    if(page.has_more && !page.next_cursor) throw Error('Notion 分頁不完整，已停止匯入');
    cursor=page.has_more?page.next_cursor:null;
  } while(cursor);
  return rows;
}
function body_(p) {
  if(p.mimeType==='text/plain' && p.body && p.body.data) return Utilities.newBlob(Utilities.base64DecodeWebSafe(p.body.data)).getDataAsString('UTF-8');
  return (p.parts||[]).map(body_).filter(Boolean).join('\n');
}
function message_(id) {
  const m=Gmail.Users.Messages.get('me',id,{format:'full'});
  const header=n=>(m.payload.headers.find(h=>h.name.toLowerCase()===n)||{}).value||'';
  return {id:m.id,sender:header('from'),subject:header('subject'),body:body_(m.payload),timestamp:Number(m.internalDate)};
}
function searchQuery_(range) {
  if (range === undefined || range === null) return MAIL_QUERY;
  if (typeof range !== 'object' || Array.isArray(range)) throw Error('日期範圍格式錯誤');
  const start = range.startSeconds, end = range.endSeconds;
  const valid = v => v == null || (Number.isSafeInteger(v) && v >= 0 && v <= 253402214400);
  if (!valid(start) || !valid(end)) throw Error('日期範圍格式錯誤');
  if (start != null && end != null && start >= end) throw Error('開始日期不能晚於結束日期');
  // Gmail date strings use Pacific time; epoch seconds preserve the browser's local days.
  return MAIL_QUERY + (start != null ? ' after:' + (start - 1) : '') +
    (end != null ? ' before:' + end : '');
}
function previewApplications(range, cursor) {
  const query=searchQuery_(range);
  checkSchema_();
  const response=Gmail.Users.Messages.list('me',{q:query,maxResults:20,...(cursor?{pageToken:String(cursor)}:{})});
  const rows=existing_(), results=[];
  for(const ref of response.messages||[]) {
    try {
      const message=message_(ref.id);
      if (range && ((range.startSeconds != null && message.timestamp < range.startSeconds*1000) ||
          (range.endSeconds != null && message.timestamp >= range.endSeconds*1000))) continue;
      const a=parse_(message), d=decision_(a,rows);
      results.push(Object.assign({},a,d)); if(d.state==='new') rows.push(a);
    } catch(e) { results.push({messageId:ref.id,state:'review',reason:e.message}); }
  }
  // Persist only IDs server-side. Import re-reads original messages and Notion.
  const ticket=Utilities.getUuid();
  CacheService.getUserCache().put('preview:'+ticket,JSON.stringify({source:dataSource_(),ids:results.filter(r=>r.state==='new').map(r=>r.messageId)}),1800);
  return {ticket,results,nextCursor:response.nextPageToken||null};
}
function importApplications(ticket) {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) throw Error('已有匯入執行中，請稍後重新預覽');
  try {
    const cache=CacheService.getUserCache(), key='preview:'+String(ticket), raw=cache.get(key);
    if(!raw) throw Error('預覽已過期或已使用，請重新預覽');
    cache.remove(key);
    const preview=JSON.parse(raw);
    if(preview.source!==dataSource_()) throw Error('Notion 連線已變更，請重新預覽');
    checkSchema_();
    const rows=existing_(), results=[];
    for(const id of preview.ids) {
      let a;
      try {
        a=parse_(message_(id)); const d=decision_(a,rows);
        if(d.state!=='new') { results.push(Object.assign({},a,d)); continue; }
        // A pending marker survives ambiguous network failures and prevents blind retries.
        const ledger=PropertiesService.getScriptProperties(), lk='job:'+dataSource_()+':'+ids_(a.Website)[0];
        const old=ledger.getProperty(lk);
        if(old) { results.push(Object.assign({},a,{state:'review',reason:'先前有匯入紀錄或未確認結果，請在 Notion 核對'})); continue; }
        const rt=s=>[{type:'text',text:{content:s}}];
        const properties={Company:{title:rt(a.Company)},Position:{rich_text:rt(a.Position)},Status:{select:{name:'Applied'}},
          Website:{rich_text:[{type:'text',text:{content:a.Website,link:{url:a.Website}}}]},'Apply Date':{date:{start:a['Apply Date']}}};
        ledger.setProperty(lk,'pending');
        const created=notion_('pages','post',{parent:{type:'data_source_id',data_source_id:dataSource_()},properties});
        ledger.setProperty(lk,created.id);
        rows.push(a); results.push(Object.assign({},a,{state:'created',reason:'已新增',url:created.url}));
      } catch(e) {
        results.push(Object.assign({},a||{messageId:id},{state:'error',reason:e.message}));
        break; // Return partial success; another preview safely resumes the remaining work.
      }
    }
    return {results};
  } finally {lock.releaseLock();}
}
