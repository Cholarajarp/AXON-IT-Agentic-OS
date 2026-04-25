const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const rootDir = path.resolve(__dirname, '..');
const devUrl = process.env.AXON_DESKTOP_URL || 'http://localhost:5173';
const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const isProductionMode = app.isPackaged || process.argv.includes('--production') || process.env.AXON_DESKTOP_MODE === 'production';
const isDev = !isProductionMode;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'AXON IT Agentic OS',
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#0b0f14',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev && process.env.AXON_DESKTOP_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url.startsWith(devUrl) : url.startsWith('file://');
    if (!allowed) {
      event.preventDefault();
      if (isAllowedExternalUrl(url)) shell.openExternal(url);
    }
  });

  if (isDev) {
    mainWindow.loadURL(devUrl);
  } else {
    const builtIndex = path.join(rootDir, 'dist', 'index.html');
    if (!fs.existsSync(builtIndex)) {
      throw new Error('Desktop production start requires dist/index.html. Run npm run build first.');
    }
    mainWindow.loadFile(builtIndex);
  }
}

function isAllowedExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return ['https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'AXON',
      submenu: [
        { label: 'About AXON', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' },
      ],
    },
    {
      label: 'Workspace',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: 'Toggle Developer Tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.toggleDevTools() },
      ],
    },
  ]);
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.axon.it-agentic-os');
  Menu.setApplicationMenu(buildMenu());

  ipcMain.handle('axon:runtime-info', () => ({
    appVersion: app.getVersion(),
    mode: isDev ? 'development' : 'production',
    apiUrl,
    platform: process.platform,
    userDataPath: app.getPath('userData'),
    security: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      externalNavigation: 'https/mailto only',
    },
  }));

  ipcMain.handle('axon:open-external', async (_event, url) => {
    if (!isAllowedExternalUrl(url)) return { opened: false, reason: 'URL protocol blocked' };
    await shell.openExternal(url);
    return { opened: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
