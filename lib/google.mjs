import http from 'node:http';
import crypto from 'node:crypto';

const scope = 'https://www.googleapis.com/auth/gmail.readonly';
const endpoint = 'https://oauth2.googleapis.com/token';

export function clientDetails(document) {
  const client = document?.installed;
  if (!client || typeof client.client_id !== 'string' || !client.client_id.endsWith('.apps.googleusercontent.com') || typeof client.client_secret !== 'string') {
    throw Error('Use the downloaded OAuth client JSON for a Desktop app, not a web app or service account.');
  }
  return { client_id: client.client_id, client_secret: client.client_secret };
}

export function authorization(client, redirect, state, verifier) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirect, response_type: 'code', scope,
    access_type: 'offline', prompt: 'consent', state, code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  return url.toString();
}

export function callbackCode(url, state) {
  if (url.searchParams.get('state') !== state) throw Error('Authorization state did not match.');
  if (url.searchParams.has('error')) throw Error('Google authorization was declined. Run setup again.');
  const code = url.searchParams.get('code');
  if (!code) throw Error('Google did not return an authorization code.');
  return code;
}

export async function login(client, transport, log = console.log, timeoutMs = 300000) {
  const state = crypto.randomBytes(32).toString('base64url'), verifier = crypto.randomBytes(32).toString('base64url');
  let resolveCode, rejectCode;
  const received = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  // Attach rejection handling before opening the listener.
  received.catch(() => {});
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method !== 'GET' || url.pathname !== '/oauth2callback') { res.writeHead(404); res.end('Not found.'); return; }
    if (url.searchParams.get('state') !== state) { res.writeHead(400); res.end('Invalid authorization state. Return to the original sign-in link.'); return; }
    try { const code = callbackCode(url, state); res.end('Authorization received. Return to your terminal. You can close this tab.'); resolveCode(code); }
    catch (error) { res.writeHead(400); res.end(error.message); rejectCode(error); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const redirect = `http://127.0.0.1:${server.address().port}/oauth2callback`;
  const timer = setTimeout(() => rejectCode(Error('Google sign-in timed out. Run setup again.')), timeoutMs);
  try {
    log('Open this Google sign-in link in a browser on this computer. Grant read-only Gmail access:');
    log(authorization(client, redirect, state, verifier));
    const code = await received;
    const tokens = await transport.request(endpoint, { method: 'POST', body: new URLSearchParams({ ...client, code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' }) }, { service: 'Google authorization', retrySafe: false });
    if (!tokens.access_token || !tokens.refresh_token || (tokens.scope && !tokens.scope.split(' ').includes(scope))) {
      throw Error('Read-only Gmail authorization was not completed. Grant the requested permission and run setup again.');
    }
    return { ...tokens, expires_at: Date.now() + Number(tokens.expires_in) * 1000 };
  } finally { clearTimeout(timer); server.close(); server.closeAllConnections(); }
}

export function gmailClient(store, transport) {
  return async path => {
    let tokens = store.read('google.json');
    if (!tokens?.refresh_token) throw Error('Gmail is not connected. Run node cli.mjs setup.');
    async function refresh() {
      const client = clientDetails(store.read('client.json'));
      let fresh;
      try {
        fresh = await transport.request(endpoint, { method: 'POST', body: new URLSearchParams({ ...client, refresh_token: tokens.refresh_token, grant_type: 'refresh_token' }) }, { service: 'Google authorization', retrySafe: false });
      } catch (error) {
        if ([400, 401].includes(error.status)) throw Error('Google login expired or was revoked. Run node cli.mjs setup and reconnect Gmail.');
        throw error;
      }
      if (!fresh.access_token) throw Error('Google login expired. Run node cli.mjs setup again.');
      tokens = { ...tokens, ...fresh, expires_at: Date.now() + Number(fresh.expires_in) * 1000 };
      store.write('google.json', tokens);
    }
    if (!Number.isFinite(tokens.expires_at) || tokens.expires_at < Date.now() + 60000) await refresh();
    const request = () => transport.request(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${tokens.access_token}` } }, { service: 'Gmail' });
    try { return await request(); }
    catch (error) { if (error.status !== 401) throw error; await refresh(); return request(); }
  };
}

export function notionClient(secret, transport) {
  return (path, method = 'GET', body) => transport.request(`https://api.notion.com/v1/${path}`, {
    method, headers: { Authorization: `Bearer ${secret}`, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }, { service: 'Notion', retrySafe: method === 'GET' || path.endsWith('/query') });
}
