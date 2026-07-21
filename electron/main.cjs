const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { initAutoUpdater, checkForUpdates, downloadUpdate, installUpdate, getUpdateStatus } = require('./updater.cjs');
const { initGameUpdater, checkGameUpdates, updateGame } = require('./game-updater.cjs');

const isDev = process.env.NODE_ENV === 'development';

let platformWindow = null;
const gameWindows = new Map();

function getUserGamesPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'games');
  }
  return path.join(app.getPath('userData'), 'games');
}

function getBuiltinPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'resources', 'builtin');
  }
  return path.join(process.resourcesPath, 'builtin');
}

function getGamesJsonPath() {
  return path.join(getUserGamesPath(), 'games.json');
}

function getGameDir(gameId) {
  return path.join(getUserGamesPath(), gameId);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function compareVersions(a, b) {
  const pa = (a || '0.0.0').split('.').map(Number);
  const pb = (b || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function setupGamesDirectory() {
  const gamesPath = getUserGamesPath();
  const jsonPath = getGamesJsonPath();

  ensureDir(gamesPath);

  const builtinPath = getBuiltinPath();
  if (fs.existsSync(builtinPath)) {
    const entries = fs.readdirSync(builtinPath, { withFileTypes: true });
    const registry = [];

    if (fs.existsSync(jsonPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        for (const item of existing) {
          registry.push(item);
        }
      } catch (_) { /**/ }
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const gameJsonPath = path.join(builtinPath, entry.name, 'game.json');
        if (fs.existsSync(gameJsonPath)) {
          try {
            const gameMeta = JSON.parse(fs.readFileSync(gameJsonPath, 'utf-8'));
            const targetDir = getGameDir(entry.name);
            const builtinSrcDir = path.join(builtinPath, entry.name);
            const builtinHasAssets = fs.existsSync(path.join(builtinSrcDir, 'assets'));
            const targetExists = fs.existsSync(targetDir);
            const targetMissing = !targetExists;
            const targetCorrupt = builtinHasAssets && targetExists && !fs.existsSync(path.join(targetDir, 'assets'));

            let targetVersion = '0.0.0';
            const targetGameJson = path.join(targetDir, 'game.json');
            if (targetExists && fs.existsSync(targetGameJson)) {
              try {
                const targetMeta = JSON.parse(fs.readFileSync(targetGameJson, 'utf-8'));
                targetVersion = targetMeta.version || '0.0.0';
              } catch (_) { /**/ }
            }
            const builtinVersion = gameMeta.version || '1.0.0';
            const versionOutdated = compareVersions(builtinVersion, targetVersion) > 0;

            if (targetMissing || targetCorrupt || versionOutdated) {
              if (fs.existsSync(targetDir)) {
                fs.rmSync(targetDir, { recursive: true, force: true });
              }
              copyDir(builtinSrcDir, targetDir);
            }
            const existingIdx = registry.findIndex(r => r.id === (gameMeta.id || entry.name));
            const entryData = {
              id: gameMeta.id || entry.name,
              name: gameMeta.name || entry.name,
              description: gameMeta.description || '',
              version: gameMeta.version || '1.0.0',
              author: gameMeta.author || '',
              icon: gameMeta.icon || '',
              enabled: true,
            };
            if (existingIdx >= 0) {
              registry[existingIdx] = entryData;
            } else {
              registry.push(entryData);
            }
          } catch (e) {
              console.error(`Failed to load game ${entry.name}:`, e.message);
            }
          }
        }
      }

      fs.writeFileSync(jsonPath, JSON.stringify(registry, null, 2), 'utf-8');
  } else if (!fs.existsSync(jsonPath)) {
    fs.writeFileSync(jsonPath, '[]', 'utf-8');
  }
}

function readGamesRegistry() {
  const jsonPath = getGamesJsonPath();
  if (!fs.existsSync(jsonPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const valid = [];
    for (const entry of data) {
      const gameDir = getGameDir(entry.id);
      const gameJsonPath = path.join(gameDir, 'game.json');
      if (fs.existsSync(gameDir) && fs.existsSync(gameJsonPath)) {
        try {
          const gameMeta = JSON.parse(fs.readFileSync(gameJsonPath, 'utf-8'));

          let iconData = '';
          if (entry.icon) {
            const iconPath = path.join(gameDir, entry.icon);
            if (fs.existsSync(iconPath)) {
              const ext = path.extname(iconPath).toLowerCase();
              const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.bmp': 'image/bmp' };
              const mime = mimeMap[ext] || 'image/png';
              iconData = `data:${mime};base64,${fs.readFileSync(iconPath).toString('base64')}`;
            }
          }

          valid.push({
            ...entry,
            path: gameDir,
            iconData: iconData || undefined,
            width: gameMeta.width || 800,
            height: gameMeta.height || 600,
            minWidth: gameMeta.minWidth,
            minHeight: gameMeta.minHeight,
            resizable: gameMeta.resizable !== false,
            entry: gameMeta.entry || 'index.html',
          });
        } catch (e) {
          valid.push({ ...entry, path: gameDir });
        }
      }
    }
    return valid;
  } catch {
    return [];
  }
}

function writeGamesRegistry(registry) {
  const jsonPath = getGamesJsonPath();
  const toSave = registry.map(({ id, name, description, version, author, icon, enabled }) => ({
    id,
    name,
    description,
    version,
    author,
    icon,
    enabled,
  }));
  ensureDir(getUserGamesPath());
  fs.writeFileSync(jsonPath, JSON.stringify(toSave, null, 2), 'utf-8');
}

function addGameEntry(gameMeta, iconFileName) {
  const registry = readGamesRegistry();
  const existing = registry.findIndex((g) => g.id === gameMeta.id);
  if (existing >= 0) {
    registry[existing] = {
      ...registry[existing],
      name: gameMeta.name,
      description: gameMeta.description,
      version: gameMeta.version,
      author: gameMeta.author,
      icon: iconFileName,
      enabled: true,
    };
  } else {
    registry.push({
      id: gameMeta.id,
      name: gameMeta.name,
      description: gameMeta.description || '',
      version: gameMeta.version || '1.0.0',
      author: gameMeta.author || '',
      icon: iconFileName || '',
      enabled: true,
    });
  }
  writeGamesRegistry(registry);
  return registry;
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于游戏平台',
          click: () => {
            dialog.showMessageBox(platformWindow, {
              type: 'info',
              title: '关于游戏平台',
              message: '游戏平台 v1.0.0',
              detail: '一个简单的游戏启动器。\n\n双击游戏卡片启动游戏。\n右键游戏卡片删除游戏。\n点击 + 号添加新游戏。\n\n项目地址: https://github.com/1479650473/game-platform\n\nbuilt by csy & gr',
            });
          },
        },
        {
          label: '打开游戏目录',
          click: () => {
            shell.openPath(getUserGamesPath());
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createPlatformWindow() {
  platformWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    resizable: true,
    maximizable: true,
    fullscreenable: false,
    title: '游戏平台',
    backgroundColor: '#0f0f23',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    platformWindow.loadURL('http://localhost:5173');
  } else {
    platformWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  platformWindow.on('closed', () => {
    for (const [, gw] of gameWindows) {
      if (gw.window && !gw.window.isDestroyed()) {
        gw.window.close();
      }
    }
    gameWindows.clear();
    platformWindow = null;
  });
}

function createGameWindow(gameData) {
  const { id, name, path: gameDir, width, height, minWidth, minHeight, resizable, entry } = gameData;

  const win = new BrowserWindow({
    width: width || 800,
    height: height || 600,
    minWidth: minWidth || width || 800,
    minHeight: minHeight || height || 600,
    resizable: resizable !== false,
    maximizable: false,
    fullscreenable: false,
    title: name || id,
    backgroundColor: '#0f0f23',
    parent: platformWindow,
    webPreferences: {
      preload: path.join(__dirname, 'game-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const gameEntry = entry || 'index.html';
  const gameHtmlPath = path.join(gameDir, gameEntry);

  if (fs.existsSync(gameHtmlPath)) {
    win.loadFile(gameHtmlPath);
  } else {
    win.loadURL(`data:text/html,<h1 style="color:white;text-align:center;margin-top:100px">游戏入口文件不存在</h1>`);
  }

  gameWindows.set(win.id, { window: win, gameId: id, gameDir });

  win.on('closed', () => {
    gameWindows.delete(win.id);
  });

  return win;
}

function registerIpcHandlers() {
  ipcMain.handle('get-games', () => {
    return readGamesRegistry();
  });

  ipcMain.handle('open-game', (_event, gameId) => {
    const games = readGamesRegistry();
    const gameData = games.find((g) => g.id === gameId);
    if (!gameData) {
      return { success: false, error: '游戏未找到' };
    }
    createGameWindow(gameData);
    return { success: true };
  });

  ipcMain.handle('add-game', async () => {
    if (!platformWindow) return { success: false, error: '平台窗口未就绪' };

    const result = await dialog.showOpenDialog(platformWindow, {
      title: '选择游戏文件夹',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: '已取消' };
    }

    const srcDir = result.filePaths[0];
    const gameJsonPath = path.join(srcDir, 'game.json');

    if (!fs.existsSync(gameJsonPath)) {
      return { success: false, error: '所选文件夹中没有 game.json 文件' };
    }

    let gameMeta;
    try {
      gameMeta = JSON.parse(fs.readFileSync(gameJsonPath, 'utf-8'));
    } catch {
      return { success: false, error: 'game.json 文件格式错误' };
    }

    if (!gameMeta.id || !gameMeta.name) {
      return { success: false, error: 'game.json 中缺少 id 或 name 字段' };
    }

    const destDir = getGameDir(gameMeta.id);
    copyDir(srcDir, destDir);

    const iconFiles = fs.readdirSync(destDir).filter((f) => /\.(png|svg|ico|jpg|jpeg)$/i.test(f));
    const iconFile = gameMeta.icon && iconFiles.includes(gameMeta.icon) ? gameMeta.icon : iconFiles[0] || '';

    const registry = addGameEntry(gameMeta, iconFile);
    return { success: true, games: registry };
  });

  ipcMain.handle('remove-game', (_event, gameId) => {
    const registry = readGamesRegistry();
    const idx = registry.findIndex((g) => g.id === gameId);
    if (idx < 0) {
      return { success: false, error: '游戏未找到' };
    }

    const gameDir = getGameDir(gameId);
    if (fs.existsSync(gameDir)) {
      try {
        fs.rmSync(gameDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Failed to remove game directory:', e.message);
      }
    }

    registry.splice(idx, 1);
    writeGamesRegistry(registry);
    return { success: true, games: registry };
  });

  ipcMain.handle('get-games-path', () => {
    return getUserGamesPath();
  });

  function findGameWindow(event) {
    const bw = BrowserWindow.fromWebContents(event.sender);
    if (!bw) return null;
    return gameWindows.get(bw.id) || null;
  }

  ipcMain.handle('get-game-version', (event) => {
    const gw = findGameWindow(event);
    if (!gw) return '1.0.0';
    try {
      const gameJsonPath = path.join(gw.gameDir, 'game.json');
      const meta = JSON.parse(fs.readFileSync(gameJsonPath, 'utf-8'));
      return meta.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  });

  ipcMain.handle('close-game', (event) => {
    const gw = findGameWindow(event);
    if (gw && gw.window) {
      gw.window.close();
    }
  });

  ipcMain.handle('check-for-updates', () => {
    return checkForUpdates().then(() => getUpdateStatus());
  });

  ipcMain.handle('download-update', () => {
    return downloadUpdate();
  });

  ipcMain.handle('install-update', () => {
    return installUpdate();
  });

  ipcMain.handle('get-update-status', () => {
    return getUpdateStatus();
  });

  ipcMain.handle('check-game-updates', () => {
    return checkGameUpdates();
  });

  ipcMain.handle('update-game', (_event, gameId) => {
    return updateGame(gameId, (progress) => {
      if (platformWindow && !platformWindow.isDestroyed()) {
        platformWindow.webContents.send('game-update-progress', progress);
      }
    });
  });
}

app.whenReady().then(() => {
  setupGamesDirectory();
  registerIpcHandlers();
  createMenu();
  createPlatformWindow();
  initAutoUpdater(platformWindow);
  initGameUpdater(getUserGamesPath(), getGamesJsonPath, getBuiltinPath);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPlatformWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
