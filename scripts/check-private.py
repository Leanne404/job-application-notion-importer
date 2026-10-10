#!/usr/bin/env python3
"""Scan staged files or reachable history without printing matched secrets."""
import re
import subprocess
import sys

ALLOWED = {'SingleFile.gs', 'scripts/build-single.py', 'Code.gs', 'Website.gs', 'Index.html', 'appsscript.json', 'README.md', '.gitignore',
           'scripts/check-private.py', 'scripts/pre-commit', 'scripts/pre-push',
           'tests/core.test.cjs', 'tests/website.test.cjs', 'cli.mjs', 'lib/local.mjs', 'lib/engine.mjs', 'lib/google.mjs', 'tests/cli.test.mjs'}
PATTERNS = {
    'API credential': r'\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|ntn_[A-Za-z0-9]{20,}|secret_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{25,}|AKIA[A-Z0-9]{16})',
    'private key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'OAuth credential': r'\b(?:GOCSPX-[A-Za-z0-9_-]{15,}|ya29\.[A-Za-z0-9_-]{15,}|1//[A-Za-z0-9_-]{20,})',
    'JWT': r'\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}',
    'personal email': r'[A-Za-z0-9._%+-]+@(?:gmail|outlook|hotmail|icloud|yahoo)\.com',
    'private identifier': r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\b[0-9a-f]{32}\b',
    'private link': r'https?://(?:app\.)?notion\.(?:so|com)/(?:p/)?[^\s)\"]*[0-9a-f]{32}|https?://mail\.google\.com/[^\s)\"]+|https?://script\.google\.com/macros/s/[^\s)\"]+',
    'personal filesystem path': r'/(?:Users|home)/[A-Za-z0-9_.-]+/',
    'secret assignment': r'''(?i)(?:api_key|access_token|refresh_token|client_secret|password|NOTION_TOKEN|notionSecret)["\']?\s*[=:]\s*["'][^"'\s]{8,}["']''',
}

def git(*args):
    return subprocess.check_output(['git', *args])

def scan(data, label):
    if b'\x00' in data:
        return [(label, 'binary file')]
    text = data.decode('utf-8', errors='replace')
    return [(label, name) for name, pattern in PATTERNS.items() if re.search(pattern, text)]

def main():
    problems=[]
    if '--history' in sys.argv:
        commits=git('rev-list','--all').decode().splitlines()
        seen=set()
        for commit in commits:
            for entry in git('ls-tree','-r','-z',commit).split(b'\0'):
                if not entry: continue
                meta,path=entry.split(b'\t',1);mode,kind,oid=meta.decode().split();name=path.decode()
                if name not in ALLOWED or mode not in ('100644','100755'):
                    problems.append((name,'unapproved file or mode'))
                if oid not in seen:
                    seen.add(oid);problems.extend(scan(git('cat-file','blob',oid),name))
    else:
        for entry in git('ls-files','--stage','-z').split(b'\0'):
            if not entry: continue
            meta,path=entry.split(b'\t',1);mode,oid,stage=meta.decode().split();name=path.decode()
            if name not in ALLOWED or mode not in ('100644','100755') or stage!='0':
                problems.append((name,'unapproved file or mode'))
            problems.extend(scan(git('cat-file','blob',oid),name))
    if problems:
        for path,reason in sorted(set(problems)): print(f'BLOCKED: {path}: {reason}')
        return 1
    print('Privacy scan passed (reviewed file allowlist and credential/identity patterns).')
    return 0

if __name__=='__main__':
    sys.exit(main())
