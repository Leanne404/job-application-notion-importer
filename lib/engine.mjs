import fs from 'node:fs';
import vm from 'node:vm';

// Reuse the maintained parser and duplicate rules without calling Apps Script.
const context = vm.createContext({ Utilities: {
  base64DecodeWebSafe: value => Buffer.from(value, 'base64url'),
  newBlob: value => ({ getDataAsString: () => value.toString('utf8') })
} });
vm.runInContext(fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8'), context);
export const core = context;

export function dateRange(start, end) {
  function midnight(value) {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Use dates in YYYY-MM-DD format.');
    const [y, m, d] = value.split('-').map(Number), date = new Date(0);
    date.setFullYear(y, m - 1, d); date.setHours(0, 0, 0, 0);
    if (y < 1970 || y > 9998 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) throw Error('Invalid calendar date.');
    return date;
  }
  const from = midnight(start), to = midnight(end);
  if (start && end && start > end) throw Error('Start date cannot be later than end date.');
  if (to) to.setDate(to.getDate() + 1);
  const range = { startSeconds: from ? from.getTime() / 1000 : null, endSeconds: to ? to.getTime() / 1000 : null };
  core.searchQuery_(range);
  return range;
}

export class Engine {
  constructor({ gmail, notion, source, store, progress = () => {} }) {
    Object.assign(this, { gmail, notion, source, store, progress });
  }
  async existing() {
    core.validateSchema_((await this.notion(`data_sources/${this.source}`)).properties);
    const rows = [], seen = new Set(); let cursor;
    do {
      const page = await this.notion(`data_sources/${this.source}/query`, 'POST', { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
      for (const row of page.results) {
        const p = row.properties;
        rows.push({ Company: core.text_(p.Company), Position: core.text_(p.Position), Website: [core.text_(p.Website, true), core.text_(p.Position, true)].join(' '),
          'Apply Date': p['Apply Date']?.date?.start?.slice(0, 10) || '' });
      }
      cursor = page.has_more ? page.next_cursor : null;
      if ((page.has_more && !cursor) || (cursor && seen.has(cursor))) throw Error('Incomplete or repeated Notion pagination. Import stopped.');
      if (cursor) seen.add(cursor);
    } while (cursor);
    return rows;
  }
  async message(id) {
    const m = await this.gmail(`messages/${encodeURIComponent(id)}?format=full`);
    const header = name => (m.payload.headers || []).find(h => h.name.toLowerCase() === name)?.value || '';
    return { id: m.id, sender: header('from'), subject: header('subject'), body: core.body_(m.payload), timestamp: Number(m.internalDate) };
  }
  ledgerKey(a) { return `${this.source}:${core.ids_(a.Website)[0]}`; }
  decision(a, rows, ledger) {
    const decision = core.decision_(a, rows);
    if (decision.state === 'new' && ledger[this.ledgerKey(a)]) return { state: 'review', reason: 'A previous write was recorded or has an uncertain outcome. Check Notion and the local ledger manually.' };
    return decision;
  }
  inRange(message, range) {
    return Number.isFinite(message.timestamp) && (range.startSeconds == null || message.timestamp >= range.startSeconds * 1000) &&
      (range.endSeconds == null || message.timestamp < range.endSeconds * 1000);
  }
  async preview(range) {
    const rows = await this.existing(), ledger = this.store.read('ledger.json', {}), results = [];
    const seen = new Set(), messages = new Set(); let cursor;
    do {
      const query = new URLSearchParams({ q: core.searchQuery_(range), maxResults: '100', ...(cursor ? { pageToken: cursor } : {}) });
      const page = await this.gmail(`messages?${query}`);
      for (const ref of page.messages || []) {
        if (messages.has(ref.id)) continue;
        messages.add(ref.id);
        // API failures abort the run; only unsupported email content is a review item.
        const message = await this.message(ref.id);
        if (!this.inRange(message, range)) continue;
        let a;
        try { a = core.parse_(message); }
        catch (error) { results.push({ messageId: ref.id, state: 'review', reason: error.message }); continue; }
        const decision = this.decision(a, rows, ledger);
        results.push({ ...a, ...decision });
        if (decision.state === 'new') rows.push(a);
      }
      this.progress(`Preview: ${results.length} matching emails checked.`);
      cursor = page.nextPageToken;
      if (cursor && seen.has(cursor)) throw Error('Repeated Gmail pagination. Preview stopped.');
      if (cursor) seen.add(cursor);
    } while (cursor);
    return results;
  }
  async pageIcon() {
    let cursor; const seen = new Set();
    try {
      do {
        const page = await this.notion(`data_sources/${this.source}/templates${cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : ''}`);
        const template = (page.templates || []).find(item => item && item.is_default && item.id);
        if (template) return core.writableIcon_((await this.notion(`pages/${template.id}`)).icon);
        if (page.has_more && (!page.next_cursor || seen.has(page.next_cursor))) return null;
        if (page.next_cursor) seen.add(page.next_cursor);
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);
    } catch { return null; }
    return null;
  }
  async import(results, range) {
    // Read Notion and original messages again after the user's confirmation.
    const rows = await this.existing(), ledger = this.store.read('ledger.json', {}), completed = [];
    const icon = await this.pageIcon();
    for (const candidate of results.filter(r => r.state === 'new')) {
      const message = await this.message(candidate.messageId);
      if (!this.inRange(message, range)) continue;
      const a = core.parse_(message), decision = this.decision(a, rows, ledger);
      if (decision.state !== 'new') { completed.push({ ...a, ...decision }); continue; }
      const key = this.ledgerKey(a), rt = content => [{ type: 'text', text: { content } }];
      const properties = { Company: { title: rt(a.Company) }, Position: { rich_text: rt(a.Position) }, Status: { select: { name: 'Applied' } },
        Website: { rich_text: [{ type: 'text', text: { content: a.Website, link: { url: a.Website } } }] }, 'Apply Date': { date: { start: a['Apply Date'] } } };
      ledger[key] = 'pending'; this.store.write('ledger.json', ledger);
      const payload = { parent: { type: 'data_source_id', data_source_id: this.source }, properties };
      if (icon) payload.icon = icon;
      const page = await this.notion('pages', 'POST', payload);
      if (!page.id) throw Error('Notion returned an uncertain write result. Check Notion before retrying.');
      ledger[key] = page.id; this.store.write('ledger.json', ledger);
      rows.push(a); completed.push({ ...a, state: 'created' });
      this.progress(`Created ${completed.filter(r => r.state === 'created').length} records so far.`);
    }
    return completed;
  }
}
