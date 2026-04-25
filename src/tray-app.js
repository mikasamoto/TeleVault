/**
 * Electron main process — tray wrapper for the Express server.
 */

import { app, BrowserWindow, Tray, Menu, shell, nativeImage } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer, Socket } from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));

let tray       = null;
let mainWindow = null;
let serverPort = null;

// ─── Find a free port ─────────────────────────────────────────────────────────

function getFreePort(preferred = 3000) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen(preferred, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', () => {
      const s2 = createServer();
      s2.listen(0, '127.0.0.1', () => {
        const { port } = s2.address();
        s2.close(() => resolve(port));
      });
    });
  });
}

// ─── Wait until the server is actually accepting connections ──────────────────

function waitForServer(port, maxWaitMs = 15000) {
  return new Promise((resolve, reject) => {
    const start    = Date.now();
    const interval = 200;

    function attempt() {
      const sock = new Socket();
      sock.setTimeout(500);
      sock.connect(port, '127.0.0.1', () => {
        sock.destroy();
        resolve();
      });
      sock.on('error', () => {
        sock.destroy();
        if (Date.now() - start > maxWaitMs) {
          reject(new Error(`Server did not start within ${maxWaitMs}ms`));
        } else {
          setTimeout(attempt, interval);
        }
      });
      sock.on('timeout', () => {
        sock.destroy();
        setTimeout(attempt, interval);
      });
    }
    attempt();
  });
}

// ─── Start embedded Express server ───────────────────────────────────────────

async function startExpressServer(port) {
  process.env.PORT    = String(port);
  process.env.DB_PATH = join(app.getPath('userData'), 'storage.db');

  const { startServer } = await import('./server.js');
  await startServer();
}

// ─── Tray icon (16x16 blue square encoded inline) ────────────────────────────

function buildTrayIcon() {
  try {
    // 16x16 solid blue PNG
    const buf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlz' +
      'AAALEwAACxMBAJqcGAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABGSURB' +
      'VDiNY/z//z8DJYCJgUIwasCoAaMGjBpAUQMYGBj+M5AJRg0YNWDUgFEDKGoAMRpGDRg1YNSA' +
      'UQNGDSBbAwMDAHDvAxEGHoqkAAAAAElFTkSuQmCC',
      'base64'
    );
    return nativeImage.createFromBuffer(buf);
  } catch {
    return nativeImage.createEmpty();
  }
}

// ─── Browser window ───────────────────────────────────────────────────────────

function openWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Telegram Storage',
    autoHideMenuBar: true,
    // Show a loading screen while server starts
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load a simple inline loading page first
  mainWindow.loadURL(`data:text/html,
    <html>
    <head><style>
      body { margin:0; background:#1a1a2e; display:flex; align-items:center;
             justify-content:center; height:100vh; font-family:sans-serif; color:#fff; flex-direction:column; gap:16px; }
      .spinner { width:40px; height:40px; border:3px solid #ffffff22;
                 border-top:3px solid #4a90d9; border-radius:50%;
                 animation:spin 0.8s linear infinite; }
      @keyframes spin { to { transform:rotate(360deg); } }
      p { font-size:14px; color:#aaa; margin:0; }
    </style></head>
    <body>
      <div class="spinner"></div>
      <p>Starting Telegram Storage...</p>
    </body>
    </html>
  `);

  // Once server is confirmed up, navigate to the real app
  waitForServer(serverPort, 15000)
    .then(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
      }
    })
    .catch(err => {
      console.error('Server failed to start:', err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`data:text/html,
          <html><head><style>
            body{margin:0;background:#1a1a2e;display:flex;align-items:center;
                 justify-content:center;height:100vh;font-family:sans-serif;color:#fff;flex-direction:column;gap:12px;}
            h2{color:#e74c3c;margin:0;}p{color:#aaa;font-size:13px;margin:0;}
          </style></head>
          <body><h2>⚠ Server failed to start</h2><p>${err.message}</p></body></html>
        `);
      }
    });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

// ─── System tray ─────────────────────────────────────────────────────────────

function createTray() {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip(`Telegram Storage  •  localhost:${serverPort}`);

  const menu = Menu.buildFromTemplate([
    { label: '📂  Open Telegram Storage', click: openWindow },
    { label: `🌐  Open in Browser  (localhost:${serverPort})`, click: () => shell.openExternal(`http://127.0.0.1:${serverPort}`) },
    { type: 'separator' },
    { label: '❌  Quit', click: () => app.exit(0) },
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', openWindow);
}

// ─── Single instance lock ─────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => openWindow());
}

// ─── App start ────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  app.setAppUserModelId('com.telegram-storage.app');

  serverPort = await getFreePort(3000);

  // Start server, then open UI (window shows loading spinner while server boots)
  openWindow();                           // show loading screen immediately
  await startExpressServer(serverPort);   // boot Express
  // waitForServer is called inside openWindow — it will navigate once ready

  createTray();
});

app.on('window-all-closed', () => { /* stay alive in tray */ });
