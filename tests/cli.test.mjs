// Synthetic fixtures only. These tests never contact Gmail or Notion.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Engine, dateRange } from '../lib/engine.mjs';
import { Store, Transport, safeText } from '../lib/local.mjs';
import { authorization, callbackCode, clientDetails, gmailClient, notionClient, login } from '../lib/google.mjs';
import { argumentsFor } from '../cli.mjs';

const source = '0'.repeat(32);
const schema = { Company: { type: 'title' }, Position: { type: 'rich_text' }, Status: { type: 'select', select: { options: [{ name: 'Applied' }] } }, Website: { type: 'rich_text' }, 'Apply Date': { type: 'date' } };
function memory() {
  const values = new Map();
  return { read: (name, fallback) => structuredClone(values.get(name) ?? fallback), write: (name, value) => values.set(name, structuredClone(value)) };
}
function email(id, job = '123', chinese = false, date = '2020-01-02', position = 'Software Engineer') {
  const subject = chinese ? '您的應徵資料已傳送到Example Company' : 'Your application was sent to Example Company';
  const body = `${subject}\n${position}\nExample Company\nhttps://www.linkedin.com/jobs/view/${job}/\n${chinese ? '應徵日期：2020年1月2日' : `Date applied: ${date}`}`;
  return { id, internalDate: String(new Date(2020, 0, 2, 12).getTime()), payload: { headers: [{ name: 'From', value: 'jobs-noreply@linkedin.com' }, { name: 'Subject', value: subject }], mimeType: 'text/plain', body: { data: Buffer.from(body).toString('base64url') } } };
}
function fixture({ failCreate = false, repeated = false, icon = null } = {}) {
  const store = memory(), pages = [], created = [], messages = { one: email('one'), two: email('two', '123', true), three: email('three', '456', false, '2020-01-02', 'Data Engineer') };
  const gmail = async route => {
    if (route.startsWith('messages/')) return messages[route.split('/')[1].split('?')[0]];
    const query = new URLSearchParams(route.split('?')[1]);
    return query.has('pageToken') ? { messages: [{ id: 'two' }, { id: 'three' }], ...(repeated ? { nextPageToken: 'next' } : {}) } : { messages: [{ id: 'one' }], nextPageToken: 'next' };
  };
  const notion = async (route, method, body) => {
    if (route === `data_sources/${source}`) return { properties: schema };
    if (route.startsWith(`data_sources/${source}/templates`)) return { templates: icon ? [{ id: 'template', name: 'Application', is_default: true }] : [], has_more: false };
    if (route === 'pages/template') return { icon };
    if (route.endsWith('/query')) return { results: pages, has_more: false };
    assert.equal(route, 'pages'); assert.equal(method, 'POST');
    if (icon) { assert.equal(body.icon.type, 'emoji'); assert.equal(body.icon.emoji, icon.emoji); assert.equal('extra' in body.icon, false); }
    else assert.equal(body.icon, undefined);
    assert.deepEqual(Object.keys(body.properties).sort(), ['Apply Date', 'Company', 'Position', 'Status', 'Website']);
    assert.equal(body.parent.data_source_id, source);
    created.push(body); pages.push({ properties: Object.fromEntries(Object.entries(body.properties).map(([key, value]) => [key, { ...value, type: Object.keys(value)[0] }])) });
    if (failCreate) throw Error('Synthetic uncertain write.');
    return { id: `created-${created.length}` };
  };
  return { engine: new Engine({ gmail, notion, source, store }), store, created, pages, messages };
}

test('strict CLI arguments and inclusive local dates', () => {
  assert.equal(argumentsFor([]).command, 'help');
  assert.throws(() => argumentsFor(['import', '--yes']));
  assert.throws(() => argumentsFor(['preview', '--start', '2020-02-31']));
  assert.throws(() => argumentsFor(['preview', '--start', '2020-01-01', '--start', '2020-01-02']));
  assert.throws(() => dateRange('2020-02-02', '2020-02-01'));
  assert.throws(() => dateRange('20-01-01'));
  assert.throws(() => dateRange('0001-01-01'));
  assert.deepEqual(dateRange(), { startSeconds: null, endSeconds: null });
  for (const [day, hours] of [['2020-03-08', 23], ['2020-11-01', 25]]) {
    const script = `import {dateRange} from './lib/engine.mjs';const r=dateRange('${day}','${day}');console.log((r.endSeconds-r.startSeconds)/3600);`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' });
    assert.equal(result.status, 0); assert.equal(Number(result.stdout), hours);
  }
});

test('preview is read-only; cross-language and cross-page dedupe; rerun creates nothing', async () => {
  const { engine, created } = fixture(), range = dateRange('2020-01-02', '2020-01-02');
  const preview = await engine.preview(range);
  assert.deepEqual(preview.map(r => r.state), ['new', 'duplicate', 'new']);
  assert.equal(created.length, 0);
  const results = await engine.import(preview, range);
  assert.equal(results.filter(r => r.state === 'created').length, 2);
  assert.equal(created.length, 2);
  assert((await engine.preview(range)).every(r => r.state === 'duplicate'));
  await engine.import(preview, range); assert.equal(created.length, 2);
});

test('receipt-date filter excludes both adjacent days and includes boundaries', async () => {
  const { engine, messages } = fixture(), range = dateRange('2020-01-02', '2020-01-02');
  messages.one.internalDate = String(range.startSeconds * 1000 - 1);
  messages.two.internalDate = String(range.startSeconds * 1000);
  messages.three.internalDate = String(range.endSeconds * 1000);
  assert.deepEqual((await engine.preview(range)).map(r => r.messageId), ['two']);
});

test('uncertain write stops the batch, preserves pending ledger, and is never blindly repeated', async () => {
  const { engine, store, created, pages } = fixture({ failCreate: true }), range = dateRange();
  const preview = await engine.preview(range);
  await assert.rejects(engine.import(preview, range), /uncertain/);
  assert.equal(created.length, 1);
  assert.equal(store.read('ledger.json')[`${source}:123`], 'pending');
  assert.equal((await engine.preview(range))[0].state, 'duplicate');
  // Even if the remote page is absent/delayed, the pending marker blocks it.
  pages.length = 0;
  assert.equal((await engine.preview(range))[0].state, 'review');
});

test('import rechecks Notion after preview; repeat cursors and read failures stop', async () => {
  const f = fixture(), range = dateRange(), preview = await f.engine.preview(range);
  await f.engine.import([preview[0]], range);
  await f.engine.import(preview, range); assert.equal(f.created.length, 2);
  await assert.rejects(fixture({ repeated: true }).engine.preview(range), /pagination/);
  const broken = fixture(); broken.engine.gmail = async () => { throw Error('Synthetic read failure.'); };
  await assert.rejects(broken.engine.preview(range), /read failure/);
});

test('private store permissions, exclusive lock, atomic persistence and terminal control stripping', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'importer-test-'));
  try {
    const store = new Store(directory); store.write('ledger.json', { pending: true });
    assert.deepEqual(store.read('ledger.json'), { pending: true });
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
      assert.equal(fs.statSync(path.join(directory, 'ledger.json')).mode & 0o777, 0o600);
    }
    const release = store.lock(); assert.throws(() => store.lock(), /running/); release(); store.lock()();
    assert.equal(store.read('missing.json', null), null);
    assert.throws(() => store.write('../outside.json', {}));
    fs.writeFileSync(path.join(directory, 'ledger.json'), '{');
    assert.throws(() => store.read('ledger.json'), /Cannot read/);
    assert.equal(safeText('\x1b[31mExample\x1b[0m\n'), 'Example ');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

const response = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers });
test('bounded read retries respect Retry-After; uncertain creates are not retried or logged', async () => {
  const waits = [], logs = []; let calls = 0;
  const transport = new Transport({ sleep: async ms => waits.push(ms), log: value => logs.push(value), fetcher: async () => ++calls === 1 ? response(429, {}, { 'Retry-After': '2' }) : response(200, { ok: true }) });
  assert.deepEqual(await notionClient('synthetic', transport)('pages', 'POST', {}), { ok: true });
  assert.equal(calls, 2); assert(waits.some(ms => ms >= 2000));
  calls = 0; transport.fetcher = async () => { calls++; return response(503, { message: 'DO-NOT-LOG-PRIVATE-BODY' }); };
  await assert.rejects(notionClient('synthetic', transport)('pages', 'POST', {}), /503/); assert.equal(calls, 1);
  assert(!logs.join('').includes('DO-NOT-LOG'));
  calls = 0; transport.fetcher = async () => { calls++; throw Error('private transport internals'); };
  await assert.rejects(notionClient('synthetic', transport)('pages', 'POST', {}), /Uncertain writes/); assert.equal(calls, 1);
  calls = 0; transport.fetcher = async () => { calls++; return response(429); };
  await assert.rejects(notionClient('synthetic', transport)('data_sources/example'), /429/); assert.equal(calls, 5);
  calls = 0; transport.fetcher = async () => { calls++; return response(429, { additional_data: { rate_limit_reason: 'public_api_request_blocked' } }); };
  await assert.rejects(notionClient('synthetic', transport)('data_sources/example'), /429/); assert.equal(calls, 1);
  await assert.rejects(transport.request('https://example.com', {}, { service: 'Notion' }), /destination/);
});

test('Gmail refresh is stored privately, read-only OAuth uses PKCE and state', async () => {
  const client = { client_id: 'synthetic.apps.googleusercontent.com', client_secret: 'example' };
  assert.throws(() => clientDetails({ web: client }), /Desktop/);
  const url = new URL(authorization(client, 'http://127.0.0.1:1234/oauth2callback', 'state', 'verifier'));
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/gmail.readonly');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), 'state');
  assert.throws(() => callbackCode(new URL('http://localhost/?state=wrong&code=example'), 'state'), /state/);
  assert.throws(() => callbackCode(new URL('http://localhost/?state=state&error=access_denied'), 'state'), /declined/);
  assert.equal(callbackCode(new URL('http://localhost/?state=state&code=example'), 'state'), 'example');
  const store = memory(); store.write('client.json', { installed: client });
  store.write('google.json', { refresh_token: 'example', expires_at: 0 });
  const calls = [], transport = { request: async (url, options) => {
    calls.push(url);
    if (url.includes('/token')) return { access_token: 'example', expires_in: 3600 };
    assert.equal(options.headers.Authorization, 'Bearer example'); return { messages: [] };
  } };
  await gmailClient(store, transport)('messages'); await gmailClient(store, transport)('messages');
  assert.equal(calls.filter(url => url.includes('/token')).length, 1);
  assert.equal(store.read('google.json').refresh_token, 'example');
});

test('desktop loopback callback rejects bad state and exchanges code with PKCE (no remote API)', async () => {
  const client = { client_id: 'synthetic.apps.googleusercontent.com', client_secret: 'example' };
  const callbacks = [];
  const log = value => {
    if (!value.startsWith('https://accounts.google.com/')) return;
    const authorizationURL = new URL(value), callback = new URL(authorizationURL.searchParams.get('redirect_uri'));
    assert.equal(callback.hostname, '127.0.0.1');
    callbacks.push((async () => {
      callback.search = new URLSearchParams({ state: 'wrong', code: 'example' });
      const invalid = await fetch(callback); assert.equal(invalid.status, 400); await invalid.text();
      callback.searchParams.set('state', authorizationURL.searchParams.get('state'));
      const valid = await fetch(callback); assert.equal(valid.status, 200); assert.match(await valid.text(), /Return to your terminal/);
    })());
  };
  const transport = { request: async (url, options, policy) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert.equal(options.body.get('code'), 'example');
    assert(options.body.get('code_verifier').length >= 43);
    assert.equal(policy.retrySafe, false);
    return { access_token: 'example', refresh_token: 'example', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.readonly' };
  } };
  const tokens = await login(client, transport, log, 4000);
  await Promise.all(callbacks); assert.equal(tokens.refresh_token, 'example'); assert(tokens.expires_at > Date.now());
});

test('Gmail 401 refreshes once; revoked login reports the recovery command', async () => {
  const store = memory();
  store.write('client.json', { installed: { client_id: 'synthetic.apps.googleusercontent.com', client_secret: 'example' } });
  store.write('google.json', { refresh_token: 'example', access_token: 'example', expires_at: Date.now() + 3600000 });
  let gmailCalls = 0, refreshes = 0;
  const transport = { request: async url => {
    if (url.includes('/token')) { refreshes++; return { access_token: 'renewed', expires_in: 3600 }; }
    if (++gmailCalls === 1) throw Object.assign(Error('Unauthorized'), { status: 401 });
    return { messages: [] };
  } };
  await gmailClient(store, transport)('messages'); assert.equal(gmailCalls, 2); assert.equal(refreshes, 1);
  store.write('google.json', { refresh_token: 'example', expires_at: 0 });
  transport.request = async () => { throw Object.assign(Error('private remote detail'), { status: 400 }); };
  await assert.rejects(gmailClient(store, transport)('messages'), /Run node cli.mjs setup/);
});

test('created pages copy the default template icon and ignore extra icon fields', async () => {
  const { engine, created } = fixture({ icon: { type: 'emoji', emoji: '💼', extra: true } });
  const range = dateRange('2020-01-02', '2020-01-02');
  await engine.import(await engine.preview(range), range);
  assert.equal(created.length, 2);
  assert.ok(created.every(page => page.icon.emoji === '💼' && !('extra' in page.icon)));
});

test('same-title reposts require review, and alternate LinkedIn URLs prevent new writes', async () => {
  const f=fixture(),range=dateRange();f.messages.three=email('three','456');
  const preview=await f.engine.preview(range);assert.deepEqual(preview.map(r=>r.state),['new','duplicate','review']);
  await f.engine.import(preview,range);assert.equal(f.created.length,1);
  // The existing row's slug link must match, even if its descriptive fields are blank.
  f.pages[0].properties.Company.title=[];f.pages[0].properties.Position.rich_text=[];
  f.pages[0].properties.Website.rich_text=[{text:{content:'https://www.linkedin.com/jobs/view/software-engineer-at-example-123/'}}];
  const next=await f.engine.preview(range);assert.equal(next[0].state,'duplicate');assert.equal(next[1].state,'duplicate');
  await f.engine.import([preview[0]],range);assert.equal(f.created.length,1);
});
