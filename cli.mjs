#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Store, Transport, safeText } from './lib/local.mjs';
import { core, dateRange, Engine } from './lib/engine.mjs';
import { clientDetails, login, gmailClient, notionClient } from './lib/google.mjs';

const help = `LinkedIn -> Notion Application Tracker (local terminal version)

Usage:
  node cli.mjs setup
  node cli.mjs preview [--start YYYY-MM-DD] [--end YYYY-MM-DD]
  node cli.mjs import [--start YYYY-MM-DD] [--end YYYY-MM-DD]
  node cli.mjs help

Setup prompts for a Desktop OAuth client JSON path and Notion connection.
Preview is read-only. Import shows a fresh preview and asks you to type IMPORT.
Dates include both days in this computer's local timezone. Omit a bound for no bound.
English and Traditional Chinese confirmation emails are supported.
There is no Apps Script runtime limit here. Gmail/Notion API quotas still apply.
Private settings and the import ledger stay in .local beside this script.
Do not run this tool and the Apps Script importer at the same time.
`;

export function argumentsFor(args) {
  const command = args[0] || 'help';
  if (!['help', '--help', '-h', 'setup', 'preview', 'import'].includes(command)) throw Error('Unknown command. Run node cli.mjs help.');
  const options = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i];
    if (!['preview', 'import'].includes(command) || !['--start', '--end'].includes(key) || !args[i + 1] || key in options) throw Error('Invalid or repeated option. Run node cli.mjs help.');
    options[key] = args[i + 1];
  }
  return { command, range: dateRange(options['--start'], options['--end']) };
}

async function ask(prompt) {
  if (!process.stdin.isTTY) throw Error('Use an interactive terminal for setup and import confirmation.');
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await input.question(prompt)).trim(); } finally { input.close(); }
}

async function secretPrompt() {
  if (!process.stdin.isTTY) throw Error('Enter secrets in an interactive terminal, not command-line arguments.');
  process.stdout.write('Notion connection secret (hidden): ');
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const done = error => {
      process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n');
      if (error) reject(error); else resolve(value.trim());
    };
    const onData = chunk => {
      for (const character of chunk) {
        if (character === '\u0003') { done(Error('Setup cancelled.')); return; }
        if (character === '\r' || character === '\n') { done(); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (/^[A-Za-z0-9_-]$/.test(character)) value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function setup(store, transport) {
  console.log('Keep all credential files private. See the README terminal setup section first.');
  const savedClient = store.read('client.json');
  if (!savedClient || !store.read('google.json') || (await ask('Reconnect Gmail? [y/N]: ')).toLowerCase() === 'y') {
    const filename = await ask('Path to downloaded Desktop OAuth client JSON: ');
    let document;
    try { document = JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8')); }
    catch { throw Error('Cannot read the OAuth client JSON. Enter an existing file path without surrounding quotes.'); }
    const tokens = await login(clientDetails(document), transport);
    store.write('client.json', { installed: clientDetails(document) });
    store.write('google.json', tokens);
    console.log('Gmail connected.');
  }
  if (!store.read('config.json') || (await ask('Change the Notion connection? [y/N]: ')).toLowerCase() === 'y') {
    const secret = await secretPrompt();
    if (!/^(?:ntn_|secret_)[A-Za-z0-9_-]+$/.test(secret)) throw Error('Enter a valid Notion connection secret.');
    const database = core.databaseId_(await ask('Original Notion database link: '));
    const notion = notionClient(secret, transport);
    const sources = (await notion(`databases/${database}`)).data_sources || [];
    if (!sources.length) throw Error('No data sources found. Use the original database link and grant connection access.');
    let selected = 0;
    if (sources.length > 1) {
      sources.forEach((source, index) => console.log(`${index + 1}. ${safeText(source.name)}`));
      const answer = await ask('Select a data source number: ');
      if (!/^\d+$/.test(answer)) throw Error('Invalid data source selection.');
      selected = Number(answer) - 1;
    }
    if (!sources[selected]) throw Error('Invalid data source selection.');
    const source = sources[selected].id;
    core.validateSchema_((await notion(`data_sources/${source}`)).properties);
    store.write('config.json', { notionSecret: secret, source });
    console.log('Notion connected.');
  }
  console.log('Setup complete. Run node cli.mjs preview with your preferred dates.');
}

function show(results) {
  const labels = { new: 'Ready to import', duplicate: 'Already exists', review: 'Needs review', created: 'Created' };
  console.table(results.map(r => Object.fromEntries(Object.entries({ Company: r.Company, Position: r.Position, Status: r.Status,
    Website: r.Website, 'Apply Date': r['Apply Date'], Result: labels[r.state], Note: r.reason }).map(([key, value]) => [key, safeText(value)]))));
  console.log(`${results.length} matching emails; ${results.filter(r => r.state === 'new').length} ready to import; ${results.filter(r => r.state === 'review').length} need review.`);
}

export async function main(args) {
  const { command, range } = argumentsFor(args);
  if (['help', '-h', '--help'].includes(command)) { console.log(help); return; }
  if (Number(process.versions.node.split('.')[0]) < 22) throw Error('Install Node.js 22 or newer.');
  const store = new Store(fileURLToPath(new URL('.local/', import.meta.url))), release = store.lock();
  let locked = true;
  const unlock = () => { if (locked) { release(); locked = false; } };
  const stop = () => { unlock(); process.exit(130); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    const transport = new Transport();
    if (command === 'setup') { await setup(store, transport); return; }
    const config = store.read('config.json');
    if (!config?.notionSecret || !/^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i.test(config?.source || '')) throw Error('Run node cli.mjs setup first.');
    console.log(`Receipt-date timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}. Gmail and Notion quotas still apply.`);
    const engine = new Engine({ store, source: config.source, gmail: gmailClient(store, transport), notion: notionClient(config.notionSecret, transport), progress: console.log });
    const results = await engine.preview(range); show(results);
    if (command === 'preview' || !results.some(r => r.state === 'new')) return;
    if (await ask('Type IMPORT to add the ready applications to Notion: ') !== 'IMPORT') { console.log('Cancelled. No applications were added.'); return; }
    const imported = await engine.import(results, range);
    console.log(`Done: ${imported.filter(r => r.state === 'created').length} records created; ${imported.filter(r => r.state !== 'created').length} skipped after rechecking.`);
  } finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); unlock(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    // Do not print stacks, remote bodies, tokens, or raw filesystem error paths.
    const message = error.code ? 'Local file operation failed. Check .local permissions and stale .tmp files; preserve ledger.json.' : error.message;
    console.error(`Error: ${safeText(message)}`);
    console.error('Processing stopped. Completed records remain in Notion. Preview again before another import.');
    process.exitCode = 1;
  });
}
