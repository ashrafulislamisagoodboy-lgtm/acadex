import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import express from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../server/index.ts';

const appId = 'com.acadex.desktop';
let mainWindow: BrowserWindow | null = null;
let localServer: Server | null = null;
let closeStore: (() => void) | null = null;
let isQuitting = false;

app.setName('Acadex');
app.setAppUserModelId(appId);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

function getDataDirectory() {
  const portableDirectory = process.env.PORTABLE_EXECUTABLE_DIR;
  return portableDirectory
    ? join(portableDirectory, 'Acadex Data')
    : join(app.getPath('userData'), 'data');
}

async function startLocalServer() {
  const dataDirectory = getDataDirectory();
  mkdirSync(dataDirectory, { recursive: true });

  const { app: webApp, store } = createApp({
    databasePath: join(dataDirectory, 'acadex.sqlite'),
  });
  closeStore = () => store.close();

  const webRoot = join(app.getAppPath(), 'dist');
  const entryFile = join(webRoot, 'index.html');
  if (!existsSync(entryFile)) {
    throw new Error('The Acadex interface is missing from this desktop build.');
  }

  webApp.use(express.static(webRoot));
  webApp.get('*', (_request, response) => response.sendFile(entryFile));

  localServer = await new Promise<Server>((resolve, reject) => {
    const server = webApp.listen(0, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });

  const address = localServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Acadex could not reserve a local port.');
  }

  return `http://127.0.0.1:${address.port}`;
}

function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function createMainWindow() {
  const localUrl = await startLocalServer();
  const icon = join(app.getAppPath(), 'dist', 'logo.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 390,
    minHeight: 640,
    show: false,
    backgroundColor: '#003631',
    icon,
    title: 'Acadex',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url) && !url.startsWith(localUrl)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(localUrl)) {
      event.preventDefault();
      if (isSafeExternalUrl(url)) void shell.openExternal(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(localUrl);
}

function shutDownLocalServices() {
  if (isQuitting) return;
  isQuitting = true;
  localServer?.close();
  localServer = null;
  closeStore?.();
  closeStore = null;
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on('before-quit', shutDownLocalServices);

app.on('window-all-closed', () => {
  app.quit();
});

app.whenReady().then(createMainWindow).catch((error) => {
  console.error(error);
  dialog.showErrorBox(
    'Acadex could not start',
    error instanceof Error ? error.message : 'An unexpected desktop error occurred.',
  );
  shutDownLocalServices();
  app.quit();
});
