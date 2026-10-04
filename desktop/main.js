// Native Windows window around the existing local Compute Bridge service.
// The coordinator, connector, UI and rendering code remain in the original files.
const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

let service = null;
let serviceUrl = null;
let appKey = null;
let mainWindow = null;
let shuttingDown = false;
const smoke = process.argv.includes('--smoke');

function isPanel(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(parsed.hostname) &&
      parsed.pathname === '/node' && /^30\d\d$/.test(parsed.port);
  } catch { return false; }
}

function secureNavigation(win, origin) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isPanel(url)) openPanel(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin === origin) return;
    event.preventDefault();
    if (isPanel(url)) openPanel(url);
  });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
}

function newWindow(options) {
  return new BrowserWindow({
    width: 1180, height: 820, minWidth: 880, minHeight: 620,
    backgroundColor: '#1b1523', autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    ...options
  });
}

function openPanel(url) {
  const win = newWindow({ width: 1400, height: 900 });
  secureNavigation(win, new URL(url).origin);
  win.loadURL(url);
}

function startService() {
  return new Promise((resolve, reject) => {
    const entry = path.join(__dirname, '..', 'hub-app.js');
    service = spawn(process.execPath, [entry, '--no-open', '--port', '3210'], {
      cwd: path.dirname(entry), windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', CB_DATA_DIR: app.getPath('userData'), CB_HUB_URL: process.env.CB_HUB_URL || require('./config.json').hubUrl || '' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    let settled = false;
    const timeout = setTimeout(() => fail(new Error('Aplicația locală nu a pornit în 20 de secunde.')), 20000);
    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    }
    service.stdout.on('data', chunk => {
      output = (output + String(chunk)).slice(-4000);
      const match = /Fereastra aplicației:\s*(http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);
      if (!settled && match) {
        settled = true;
        clearTimeout(timeout);
        serviceUrl = match[1];
        resolve(serviceUrl);
      }
    });
    service.stderr.on('data', chunk => { output = (output + String(chunk)).slice(-4000); });
    service.on('error', fail);
    service.on('exit', code => {
      if (!settled) fail(new Error(`Motorul s-a oprit la pornire (${code}): ${output.slice(-600)}`));
      else if (!shuttingDown) {
        dialog.showErrorBox('Compute Bridge', `Motorul aplicației s-a oprit (${code}).`);
        app.quit();
      }
    });
  });
}

async function stopService() {
  if (!service) return;
  try {
    if (serviceUrl && appKey) {
      await fetch(serviceUrl + 'local/quit', {
        method: 'POST', headers: { 'x-app-key': appKey, 'content-type': 'application/json' },
        body: '{}', signal: AbortSignal.timeout(2500)
      });
    }
  } catch {}
  const child = service;
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 2500))
    ]);
  }
  if (child.exitCode === null && child.signalCode === null) child.kill();
  service = null;
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on('second-instance', () => { mainWindow?.show(); mainWindow?.focus(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (service && !shuttingDown) {
      event.preventDefault();
      shuttingDown = true;
      stopService().finally(() => app.quit());
    }
  });

  app.whenReady().then(async () => {
    const url = await startService();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Interfața locală a răspuns cu HTTP ${response.status}.`);
    const page = await response.text();
    appKey = /<meta name="cb-key" content="([^"]+)"/.exec(page)?.[1];
    if (!appKey) throw new Error('Cheia interfeței locale lipsește.');

    mainWindow = newWindow({ show: !smoke });
    secureNavigation(mainWindow, new URL(url).origin);
    await mainWindow.loadURL(url);
    if (smoke) {
      const page = await mainWindow.webContents.executeJavaScript('({ title: document.title, content: document.body.innerText.length })');
      if (!page.title || page.content < 100) throw new Error('Interfața desktop este incompletă.');
      console.log(`DESKTOP_SMOKE_OK ${page.title} (${page.content} caractere)`);
      app.quit();
    }
  }).catch(error => {
    dialog.showErrorBox('Compute Bridge nu a pornit', error.message);
    console.error(error.stack || error);
    app.quit();
  });
}
