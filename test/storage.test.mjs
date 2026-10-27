import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../scripts/storage.mjs', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'nitrate-storage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  const put = (name, text = 'preserve me') => {
    const target = path.join(root, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
  };
  put('scripts/storage.mjs', '');
  cpSync(source, path.join(root, 'scripts/storage.mjs'));
  put('.gitignore', '.next/\nnode_modules/\n.claude/\n.env.local\ncoverage/\n');
  put('src/app.ts');
  git('init');
  git('add', '.');
  git('-c', 'user.name=Storage Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture');
  const run = (...args) => execFileSync(process.execPath, [path.join(root, 'scripts/storage.mjs'), ...args], { encoding: 'utf8', stdio: 'pipe' });
  return { root, git, put, run };
}

test('report preserves generated files and unknown options fail without deletion', (t) => {
  const f = fixture(t);
  f.put('.next/cache/data');
  assert.match(f.run(), /Can remove/);
  assert.ok(existsSync(path.join(f.root, '.next/cache/data')));
  assert.throws(() => f.run('--anything'));
  assert.ok(existsSync(path.join(f.root, '.next/cache/data')));
});

test('cleanup preserves dirty source, secrets, dependencies and nested worktree history', (t) => {
  const f = fixture(t);
  const nested = '.claude/worktrees/old';
  f.git('worktree', 'add', '--detach', path.join(f.root, nested), 'HEAD');
  f.put('src/app.ts', 'dirty source');
  f.put('.env.local', 'secret fixture');
  f.put('.next/cache/data');
  f.put('node_modules/main/file');
  f.put(`${nested}/src/app.ts`, 'dirty nested source');
  f.put(`${nested}/.env.local`, 'nested secret');
  f.put(`${nested}/.next/cache/data`);
  f.put(`${nested}/node_modules/duplicate/file`);
  f.run('--apply', '--worktree-dependencies');
  for (const name of ['src/app.ts', '.env.local', 'node_modules/main/file', `${nested}/src/app.ts`, `${nested}/.env.local`, `${nested}/.git`]) {
    assert.ok(existsSync(path.join(f.root, name)), name);
  }
  for (const name of ['.next', `${nested}/.next`, `${nested}/node_modules`]) {
    assert.equal(existsSync(path.join(f.root, name)), false, name);
  }
  assert.match(f.git('diff').toString(), /dirty source/);
});

test('main dependency removal is opt-in and linked dependencies are preserved', (t) => {
  const f = fixture(t);
  f.put('node_modules/package/file');
  f.run('--apply');
  assert.ok(existsSync(path.join(f.root, 'node_modules/package/file')));
  f.run('--apply', '--dependencies');
  assert.equal(existsSync(path.join(f.root, 'node_modules')), false);
  f.put('external/file');
  symlinkSync(path.join(f.root, 'external'), path.join(f.root, 'node_modules'));
  assert.match(f.run('--apply', '--dependencies'), /Preserved symlink/);
  assert.ok(existsSync(path.join(f.root, 'external/file')));
});

test('tracked generated targets refuse the entire cleanup before any deletion', (t) => {
  const f = fixture(t);
  f.put('.next/cache/data');
  f.put('coverage/important.txt');
  f.git('add', '-f', 'coverage/important.txt');
  assert.throws(() => f.run('--apply'), /Refusing to remove tracked files/);
  assert.ok(existsSync(path.join(f.root, '.next/cache/data')));
});

test('active project server refuses cleanup before deletion', async (t) => {
  const f = fixture(t);
  f.put('.next/cache/data');
  const server = spawn(process.execPath, ['-e', "process.title='next-server'; process.stdout.write('ready'); setInterval(()=>{},1000)"], { cwd: f.root });
  t.after(() => server.kill());
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('error', reject);
  });
  assert.throws(() => f.run('--apply'), /verification is active/);
  assert.ok(existsSync(path.join(f.root, '.next/cache/data')));
});
