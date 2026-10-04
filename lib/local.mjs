import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// All local state stays under the ignored .local directory beside cli.mjs.
export class Store {
  constructor(directory) {
    this.directory = directory;
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (fs.lstatSync(directory).isSymbolicLink()) throw Error('The local state directory must not be a symbolic link.');
    fs.chmodSync(directory, 0o700);
  }
  file(name) {
    if (!/^[a-z-]+\.json$/.test(name)) throw Error('Invalid local state filename.');
    const file = path.join(this.directory, name);
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw Error('Local state files must not be symbolic links.');
    return file;
  }
  read(name, fallback) {
    try { return JSON.parse(fs.readFileSync(this.file(name), 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return fallback;
      throw Error('Cannot read local settings. Check the JSON files in .local; do not delete the import ledger.');
    }
  }
  write(name, value) {
    const file = this.file(name), temporary = file + '.tmp';
    // Exclusive creation prevents following an unexpected temporary symlink.
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n');
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, file);
  }
  lock() {
    const file = path.join(this.directory, 'run.lock');
    let fd;
    try { fd = fs.openSync(file, 'wx', 0o600); }
    catch { throw Error('Another local command may be running. If a previous command crashed, stop it before removing .local/run.lock.'); }
    fs.writeFileSync(fd, String(process.pid));
    fs.closeSync(fd);
    return () => fs.unlinkSync(file);
  }
}

export function safeText(value) {
  // Strip terminal controls from untrusted email/database names (including OSC).
  return String(value ?? '').replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x1f\x7f-\x9f]/g, ' ');
}

export class HttpError extends Error {
  constructor(service, status) {
    super(`${service} request failed (HTTP ${status}). Check authorization and quotas, then preview again. No response body or credential was logged.`);
    this.status = status;
  }
}

export class Transport {
  constructor({ fetcher = fetch, sleep = delay, log = console.log, now = Date.now } = {}) {
    Object.assign(this, { fetcher, sleep, log, now });
    this.last = new Map();
  }
  async request(url, options = {}, { service, retrySafe = true } = {}) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !['gmail.googleapis.com', 'api.notion.com', 'oauth2.googleapis.com'].includes(parsed.hostname)) {
      throw Error('Unexpected API destination.');
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const interval = service === 'Notion' ? 400 : service === 'Gmail' ? 250 : 0;
      await this.sleep(Math.max(0, (this.last.get(service) || 0) + interval - this.now()));
      this.last.set(service, this.now());
      let response, data;
      try {
        response = await this.fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(60000) });
        data = await response.json();
      } catch {
        if (retrySafe && attempt < 4) {
          this.log(`${service}: temporary network failure; retrying a read request.`);
          await this.sleep(1000 * 2 ** attempt); continue;
        }
        throw Error(`${service}: network or response failure. Preview again to check completed records. Uncertain writes are not retried.`);
      }
      if (response.ok) return data;
      const reasons = data?.error?.errors?.map(item => item.reason) || [];
      const blocked = data?.additional_data?.rate_limit_reason === 'public_api_request_blocked';
      const throttled = !blocked && ([429, 529].includes(response.status) ||
        (service === 'Gmail' && response.status === 403 && reasons.some(x => ['rateLimitExceeded', 'userRateLimitExceeded'].includes(x))));
      if (attempt < 4 && (throttled || (retrySafe && [500, 502, 503, 504].includes(response.status)))) {
        const retryAfter = response.headers.get('retry-after');
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        const wait = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 1000 * 2 ** attempt;
        // Never shorten the provider's wait. Very long waits stop for a later manual run.
        if (wait > 300000) throw Error(`${service}: quota requires a wait longer than five minutes. Try again later.`);
        this.log(`${service}: rate limit or temporary failure. Waiting ${Math.ceil(wait / 1000)} seconds before retry ${attempt + 1}/4.`);
        await this.sleep(wait + Math.floor(Math.random() * 250)); continue;
      }
      throw new HttpError(service, response.status);
    }
  }
}
