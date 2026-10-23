const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell, session, Menu } = require('electron');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { createSoundResolver } = require('./lib/sound-cache.cjs');

// Audio must start instantly without waiting for a click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  { scheme: 'vp', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const SRC_DIR = path.join(__dirname, 'src');
const BUNDLED_SOUNDS = app.isPackaged ? path.join(process.resourcesPath, 'sounds') : path.join(__dirname, 'sounds');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

let win = null;
let sounds = null;
let cacheDir = null;

async function serveFile(file) {
  try {
    const data = await fsp.readFile(file);
    return new Response(data, { headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  if (rel.startsWith('sounds/')) {
    const { status, data, type } = await sounds.resolve(rel.slice('sounds/'.length));
    return new Response(data, { status, headers: { 'content-type': type } });
  }
  const file = path.normalize(path.join(SRC_DIR, rel));
  if (!file.startsWith(SRC_DIR)) return new Response('Forbidden', { status: 403 });
  return serveFile(file);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 880,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#09090c',
    title: 'Nocturne Piano',
    icon: path.join(__dirname, 'build', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#141419', symbolColor: '#cfc6b4', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // keep the metronome and playback steady when unfocused
    },
  });

  win.once('ready-to-show', () => win.show());
  win.on('enter-full-screen', () => win.webContents.send('win:fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('win:fullscreen', false));

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Links never open inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL('vp://app/index.html');
}

function registerIpc() {
  ipcMain.handle('file:save', async (_e, { defaultName, filters, data }) => {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: path.join(app.getPath('music'), defaultName),
      filters,
    });
    if (canceled || !filePath) return null;
    await fsp.writeFile(filePath, Buffer.from(data));
    return filePath;
  });

  ipcMain.handle('file:open', async (_e, { filters }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters });
    if (canceled || !filePaths.length) return [];
    return Promise.all(
      filePaths.map(async (p) => ({ name: path.basename(p), data: new Uint8Array(await fsp.readFile(p)) })),
    );
  });

  ipcMain.handle('file:reveal', (_e, filePath) => shell.showItemInFolder(filePath));
  ipcMain.handle('sounds:has', (_e, rels) => rels.filter((rel) => sounds.has(rel)));
  ipcMain.handle('sounds:open-folder', async () => {
    await fsp.mkdir(cacheDir, { recursive: true });
    return shell.openPath(cacheDir);
  });
  ipcMain.handle('win:fullscreen', () => {
    win.setFullScreen(!win.isFullScreen());
    return win.isFullScreen();
  });
  ipcMain.handle('shell:open-external', (_e, url) => {
    if (typeof url === 'string' && url.startsWith('https://')) shell.openExternal(url);
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    app.setAppUserModelId('com.nocturne.piano');
    cacheDir = path.join(app.getPath('userData'), 'sounds');
    sounds = createSoundResolver({ cacheDir, bundledDir: BUNDLED_SOUNDS, fetchImpl: (url) => net.fetch(url) });
    protocol.handle('vp', handleRequest);

    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(['midi', 'midiSysex', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write', 'display-capture', 'media'].includes(permission));
    });
    // "Record video" captures the app's own window, no picker needed.
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      callback({ video: request.frame });
    });
    session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
      ['midi', 'midiSysex', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write', 'display-capture', 'media'].includes(permission),
    );

    registerIpc();
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
