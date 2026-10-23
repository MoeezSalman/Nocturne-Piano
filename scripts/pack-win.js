// Builds a self-contained Windows app in dist/Nocturne Piano (no installer needed) and,
// with --shortcuts, adds "Nocturne Piano" to the Desktop and the Start menu.
import { cpSync, rmSync, renameSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const electronDist = join(root, 'node_modules', 'electron', 'dist');
const out = join(root, 'dist', 'Nocturne Piano');
const exe = join(out, 'Nocturne Piano.exe');

if (!existsSync(join(electronDist, 'electron.exe'))) {
  console.error('Electron is not installed yet. Run `npm install` first.');
  process.exit(1);
}

console.log('Copying the Electron runtime…');
rmSync(out, { recursive: true, force: true });
mkdirSync(dirname(out), { recursive: true });
cpSync(electronDist, out, { recursive: true });
renameSync(join(out, 'electron.exe'), exe);
rmSync(join(out, 'resources', 'default_app.asar'), { force: true });

console.log('Copying the app…');
const app = join(out, 'resources', 'app');
for (const item of ['main.cjs', 'preload.cjs', 'lib', 'src', 'build']) cpSync(join(root, item), join(app, item), { recursive: true });
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
writeFileSync(
  join(app, 'package.json'),
  JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, description: pkg.description, main: 'main.cjs' }, null, 2),
);

if (existsSync(join(root, 'sounds'))) {
  console.log('Copying the offline sound library (this can take a minute)…');
  cpSync(join(root, 'sounds'), join(out, 'resources', 'sounds'), { recursive: true, filter: (src) => !src.endsWith('.part') });
}

console.log(`Built ${exe}`);

if (process.argv.includes('--shortcuts')) {
  const icon = join(app, 'build', 'icon.ico');
  const ps = `
    $shell = New-Object -ComObject WScript.Shell
    $targets = @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('Programs')) ''))
    foreach ($dir in $targets) {
      $lnk = $shell.CreateShortcut((Join-Path $dir 'Nocturne Piano.lnk'))
      $lnk.TargetPath = '${exe.replace(/'/g, "''")}'
      $lnk.WorkingDirectory = '${out.replace(/'/g, "''")}'
      $lnk.IconLocation = '${icon.replace(/'/g, "''")},0'
      $lnk.Description = 'Nocturne Piano'
      $lnk.Save()
      Write-Output "Shortcut: $($lnk.FullName)"
    }`;
  console.log(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' }).trim());
}
