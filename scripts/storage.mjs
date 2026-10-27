import { execFileSync } from 'node:child_process';
import { lstat, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberately limited to regenerable files. Never remove a worktree or source.
const flags = new Set(process.argv.slice(2));
const allowed = new Set(['--apply', '--dependencies', '--worktree-dependencies', '--help']);
if ([...flags].some((flag) => !allowed.has(flag))) {
  console.error('Unknown option. Use --help.');
  process.exit(1);
}
if (flags.has('--help')) {
  console.log('storage.mjs [--apply] [--worktree-dependencies] [--dependencies]\nWithout --apply, report only. --dependencies includes the main install.');
  process.exit(0);
}

const root = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
if (await realpath(git(root, ['rev-parse', '--show-toplevel'])) !== root) {
  throw new Error('Run from the project checkout.');
}
const inside = (parent, child) => child.startsWith(`${parent}${path.sep}`);
const nestedPrefix = path.join(root, '.claude', 'worktrees');
const candidates = git(root, ['worktree', 'list', '--porcelain', '-z'])
  .split('\0').filter((field) => field.startsWith('worktree ')).map((field) => field.slice(9));
const roots = [root];
for (const candidate of candidates) {
  if (!inside(nestedPrefix, candidate)) continue;
  try {
    const resolved = await realpath(candidate);
    // Do not follow symlinks into another folder or touch sibling projects.
    if (resolved === candidate && !roots.includes(resolved)) roots.push(resolved);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const planned = [];
for (const checkout of roots) {
  const generated = ['.next', 'coverage', 'tsconfig.tsbuildinfo'];
  if (flags.has('--dependencies') || (checkout !== root && flags.has('--worktree-dependencies'))) {
    generated.push('node_modules');
  }
  for (const name of generated) {
    const target = path.join(checkout, name);
    try {
      const stat = await lstat(target);
      if (stat.isSymbolicLink()) {
        console.log(`Preserved symlink: ${path.relative(root, target)}`);
        continue;
      }
      if (git(checkout, ['ls-files', '--', name])) {
        throw new Error(`Refusing to remove tracked files: ${target}`);
      }
      if (!inside(checkout, target) || await realpath(target) !== target) {
        throw new Error(`Refusing an unexpected path: ${target}`);
      }
      const kib = Number(execFileSync('du', ['-sk', target], { encoding: 'utf8' }).split(/\s/)[0]);
      planned.push({ checkout, target, kib });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

// Check all processes before the first deletion. lsof supplies each process's
// actual directory, including next-server processes whose command has no path.
if (flags.has('--apply') && planned.length) {
  const commands = new Map(execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' })
    .split('\n').flatMap((line) => {
      const match = /^\s*(\d+)\s+(.*)$/.exec(line);
      return match ? [[Number(match[1]), match[2]]] : [];
    }));
  let pid = null;
  let openDirectories;
  try {
    openDirectories = execFileSync('lsof', ['-a', '-d', 'cwd', '-F', 'pn'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error('Cannot check active processes. No files removed. Close project servers and retry where lsof is available.');
  }
  for (const field of openDirectories.split('\n')) {
    if (field.startsWith('p')) pid = Number(field.slice(1));
    if (!field.startsWith('n') || pid === process.pid) continue;
    const cwd = field.slice(1);
    const command = commands.get(pid) ?? '';
    if (roots.some((checkout) => cwd === checkout || inside(checkout, cwd)) &&
        /\b(next(?:-server)?|vitest|tsc|drizzle-kit)\b|npm (?:run (?:dev|build|start|verify|test|typecheck)|ci|install)/.test(command)) {
      throw new Error(`Project server, install, or verification is active (PID ${pid}). Stop it before cleanup. No files removed.`);
    }
  }
}

let total = 0;
for (const { checkout, target, kib } of planned) {
  if (flags.has('--apply')) {
    // Recheck immediately before removal in case repository state changed.
    if ((await lstat(target)).isSymbolicLink() || git(checkout, ['ls-files', '--', path.basename(target)])) {
      throw new Error(`Path changed during cleanup: ${target}`);
    }
    await rm(target, { recursive: true, force: false });
  }
  total += kib;
  console.log(`${flags.has('--apply') ? 'Removed' : 'Can remove'} ${(kib / 1024).toFixed(1)} MiB  ${path.relative(root, target)}`);
}
console.log(`${flags.has('--apply') ? 'Reclaimed approximately' : 'Reclaimable approximately'} ${(total / 1024).toFixed(1)} MiB.`);
console.log('Source, Git history, environment files, reference images, and worktree checkouts are preserved.');
if (flags.has('--dependencies')) console.log('Restore the main dependencies with npm ci before running the app.');
