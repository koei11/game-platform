# GamePlatform

<p align="center">
  <img src="https://img.shields.io/github/license/1479650473/game-platform" alt="License">
  <img src="https://img.shields.io/github/v/release/1479650473/game-platform" alt="Release">
  <img src="https://img.shields.io/github/stars/1479650473/game-platform" alt="Stars">
</p>

桌面游戏平台启动器，内置俄罗斯方块、扫雷、数独。支持毛玻璃风格卡片、独立窗口游玩、双层自动更新。

## 下载

前往 [Releases](https://github.com/1479650473/game-platform/releases) 页面下载最新版 `GamePlatform Setup x.x.x.exe`，双击安装即可。

> 首次安装 Windows 可能弹出 SmartScreen 警告，点击「更多信息」→「仍要运行」。

## 截图

> 截图待补充。欢迎 PR 贡献界面截图。

## 内置游戏

| 游戏 | 说明 |
|------|------|
| 俄罗斯方块 | 经典方块消除 |
| 扫雷 | 经典扫雷逻辑游戏 |
| 数独 | 4 级难度，唯一解验证，笔记模式，计时器 |

---

## 技术文档（开发者阅读）

## 项目概述

GamePlatform 是一个桌面游戏启动平台，基于 Electron + React 构建。平台以毛玻璃风格卡片展示已注册的游戏，双击卡片在独立窗口中启动游戏。内置自动更新系统，支持平台级和游戏级双层更新。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Electron | 28 |
| 前端 | React + Vite + TypeScript | 19 / 8 / 6 |
| 打包 | electron-builder (NSIS) | 26.15 |
| 平台更新 | electron-updater | 6.x |
| 样式 | 纯 CSS（玻璃态深色主题） | - |

## 目录结构

```
game-platform/
├── electron/                  # 主进程（Node.js）
│   ├── main.cjs              # 入口：窗口管理、IPC、游戏目录
│   ├── preload.cjs           # 平台窗口预加载（platformAPI）
│   ├── game-preload.cjs      # 游戏窗口预加载（electronAPI / gamePlatformAPI）
│   ├── updater.cjs           # 平台自动更新模块（electron-updater）
│   └── game-updater.cjs      # 游戏远程更新模块（注册表 + zip 下载）
├── src/                       # 渲染进程（React）
│   ├── main.tsx              # React 入口
│   ├── App.tsx               # 根组件
│   ├── App.css               # 全局样式（527+ 行）
│   ├── index.css             # CSS reset / 滚动条
│   ├── electron.d.ts         # platformAPI 类型声明
│   ├── types.ts              # GameEntry / GameUpdateInfo 接口
│   ├── pages/
│   │   └── Home.tsx          # 首页：游戏列表、更新检测、toast/对话框
│   └── components/
│       ├── GameCard.tsx      # 游戏卡片网格 + 单个卡片
│       ├── AddGameDialog.tsx # 添加游戏说明对话框
│       └── UpdateDialog.tsx  # 平台更新对话框（进度条/操作）
├── resources/
│   └── builtin/              # 内置游戏源（随安装包分发）
│       ├── tetris/
│       ├── minesweeper/
│       └── sudoku/
│           ├── index.html
│           ├── assets/
│           ├── game.json
│           └── icon.png
├── scripts/
│   └── build-game.cjs       # 游戏构建脚本（npm build → 复制到 resources/games）
├── games/                     # 开发环境游戏目录（运行时生成，gitignore）
├── games-registry.json       # 远程游戏注册表（托管在 GitHub raw）
├── package.json
├── vite.config.ts
└── tsconfig*.json
```

## 架构设计

### 进程模型

```
┌─────────────────────────────────────────┐
│  Main Process (electron/main.cjs)        │
│  ├── BrowserWindow (platform)            │
│  ├── BrowserWindow × N (game windows)    │
│  ├── IPC Handlers (12 channels)          │
│  ├── setupGamesDirectory()               │
│  └── AutoUpdater + GameUpdater           │
└────────────┬────────────────────────────┘
             │ IPC (contextBridge)
┌────────────┴────────────────────────────┐
│  Renderer Process (React)                │
│  ├── platformAPI (主窗口)                │
│  │   ├── 游戏管理: CRUD                  │
│  │   └── 更新: check/download/progress   │
│  ├── electronAPI (游戏窗口)              │
│  │   └── getVersion()                    │
│  └── gamePlatformAPI (游戏窗口)          │
│      └── closeGame()                     │
└──────────────────────────────────────────┘
```

### 游戏目录管理

平台的数据目录：

| 环境 | 路径 | 说明 |
|------|------|------|
| 开发 | `./games/` | 项目根目录 |
| 生产 | `%APPDATA%/game-platform/games/` | `app.getPath('userData')` |

每个游戏是自包含文件夹：

```
games/
├── games.json              # 游戏注册表（平台维护）
├── sudoku/
│   ├── index.html          # 入口文件
│   ├── assets/             # 构建产物（JS/CSS）
│   ├── game.json           # 游戏元数据
│   └── icon.png            # 图标（可选）
├── tetris/
└── minesweeper/
```

### 启动流程

```
app.whenReady()
  ├── 1. setupGamesDirectory()        # 版本比对，复制/更新内置游戏
  ├── 2. registerIpcHandlers()        # 注册 12 个 IPC 通道
  ├── 3. createMenu()                 # 菜单栏
  ├── 4. createPlatformWindow()       # 创建主窗口，加载 React 应用
  ├── 5. initAutoUpdater(win)         # 初始化 electron-updater
  └── 6. initGameUpdater(...)         # 初始化游戏远程更新
```

### 版本感知的内置游戏同步

`setupGamesDirectory()` 在启动时遍历 `resources/builtin/`：

1. 目标目录不存在 → 复制
2. 目标目录缺少 `assets/`（上次复制损坏）→ 删除后重新复制
3. **builtin 版本 > 本地版本**（semver 比对）→ 删除后重新复制

这确保更新安装包 = 更新内置游戏。

## 自动更新系统

### 双层架构

```
┌──────────────────────────────────────────────┐
│  Layer 1: 平台更新 (electron-updater)         │
│  ─────────────────────────────────────        │
│  触发: 用户点击"检查更新"或启动时自动检查     │
│  分发: GitHub Releases (NSIS 安装包)          │
│  流程: check → available → download → install │
│  覆盖: Electron 本体 + 前端 + 内置游戏        │
├──────────────────────────────────────────────┤
│  Layer 2: 游戏更新 (远程注册表)               │
│  ─────────────────────────────────────        │
│  触发: 启动时 + 每 6 小时定时检查             │
│  分发: games-registry.json → zip 下载         │
│  流程: fetch JSON → compare version →         │
│        download zip → extract → replace        │
│  覆盖: 单个游戏的 dist + game.json            │
└──────────────────────────────────────────────┘
```

### 发布平台新版本

```powershell
# 设置环境变量
$env:GH_TOKEN = "<your-github-token>"

# 1. 修改 package.json 的 version 字段
# 2. 构建 + 发布到 GitHub Releases
npm run release

# 等价于:
# npm run build && electron-builder --win --publish always
```

`electron-builder` 根据 `publish` 配置自动：
1. 打包 NSIS 安装程序
2. 生成 `latest.yml` 更新清单
3. 推送到 GitHub Releases

客户端启动时 `electron-updater` 读取 `latest.yml`，比对版本号决定是否更新。

### 仅更新游戏（不改平台版本）

1. 编辑仓库根目录的 `games-registry.json`：

```json
{
  "games": {
    "sudoku": {
      "name": "数独",
      "latest": "1.0.1",
      "url": "https://github.com/1479650473/game-platform/releases/download/v1.0.0/sudoku.zip",
      "changelog": "修复笔记模式bug，优化键盘响应速度"
    }
  }
}
```

2. 向上一步的 URL 上传 zip（zip 内容 = 游戏 dist 目录 + game.json + icon.png）
3. 客户端在 6 小时内自动拉取，首页弹出通知条

### 前端更新 UI

| 元素 | 说明 |
|------|------|
| 首页「检查更新」按钮 | 有更新时显示红色脉冲圆点 |
| 游戏更新通知条 | 紫色横幅，列出可更新游戏名 + 更新按钮 |
| UpdateDialog | 模态对话框：检测中 / 新版本详情 / 下载进度 / 完成 |
| 游戏卡片更新角标 | Phase 2 待实现（当前通知条已覆盖） |

## 游戏规范

### game.json 格式

```json
{
  "id": "sudoku",
  "name": "数独",
  "description": "经典数独逻辑推理游戏",
  "version": "1.0.0",
  "author": "csy & gr",
  "entry": "index.html",
  "icon": "icon.png",
  "width": 540,
  "height": 720,
  "minWidth": 460,
  "minHeight": 620,
  "resizable": true
}
```

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `id` | 是 | string | 唯一标识，用作文件夹名 |
| `name` | 是 | string | 显示名称 |
| `version` | 是 | string | semver 版本，用于更新比对 |
| `entry` | 否 | string | 入口 HTML，默认 `index.html` |
| `icon` | 否 | string | 图标文件名（png/svg/ico/jpg） |
| `width` / `height` | 否 | number | 游戏窗口尺寸，默认 800×600 |
| `minWidth` / `minHeight` | 否 | number | 最小窗口尺寸 |
| `resizable` | 否 | boolean | 是否可调整大小，默认 true |

### 游戏目录要求

```
game-name/
├── index.html       # 入口（或自定义 entry）
├── game.json        # 元数据（必须）
├── icon.png         # 图标（可选，64-256px 推荐）
└── assets/          # 静态资源（JS/CSS/图片）
```

`index.html` 中的资源引用必须使用相对路径：
```html
<link rel="stylesheet" href="./assets/index-xxx.css">
<script src="./assets/index-xxx.js"></script>
```

### 游戏窗口预加载 API

游戏窗口通过 `game-preload.cjs` 暴露两个全局对象：

**`window.electronAPI`**

| 方法 | 说明 |
|------|------|
| `getVersion()` | 返回 `Promise<string>`（从 game.json 读取） |

**`window.gamePlatformAPI`**

| 方法 | 说明 |
|------|------|
| `closeGame()` | 关闭当前游戏窗口 |

## IPC API 参考

平台窗口通过 `preload.cjs` 暴露 `window.platformAPI`：

### 游戏管理

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `getGames()` | - | `Promise<GameEntry[]>` | 获取游戏列表（含 base64 图标） |
| `openGame(id)` | `string` | `Promise<{success, error?}>` | 在独立窗口启动游戏 |
| `addGame()` | - | `Promise<{success, error?, games?}>` | 打开文件夹选择，导入游戏 |
| `removeGame(id)` | `string` | `Promise<{success, error?, games?}>` | 删除游戏文件夹和注册 |
| `getGamesPath()` | - | `Promise<string>` | 返回游戏目录路径 |

### 平台更新

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `checkForUpdates()` | - | `Promise<UpdateStatus>` | 检查平台更新 |
| `downloadUpdate()` | - | `Promise<void>` | 开始下载更新 |
| `installUpdate()` | - | `Promise<void>` | 安装并重启 |
| `getUpdateStatus()` | - | `Promise<UpdateStatus>` | 获取当前更新状态 |
| `onUpdateStatusChanged(cb)` | `(status) => void` | `() => void` | 监听状态变化，返回取消函数 |

### 游戏更新

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `checkGameUpdates()` | - | `Promise<{updates, registryUrl}>` | 检查游戏更新 |
| `updateGame(id)` | `string` | `Promise<{success, error?}>` | 下载并安装游戏更新 |
| `onGameUpdateProgress(cb)` | `(data) => void` | `() => void` | 监听下载进度 |

### UpdateStatus 类型

```typescript
interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'uptodate' | 'downloading' | 'downloaded' | 'error';
  info?: { version: string; releaseDate: string; releaseNotes?: string } | null;
  progress?: { percent: number; bytesPerSecond: number } | null;
  error?: string | null;
}
```

## 构建与发布

### 本地开发

```powershell
# 安装依赖
npm install

# 启动开发服务器（仅前端，浏览器预览）
npm run dev

# 启动 Electron 开发模式（Vite + Electron 同时启动）
npm run electron:dev
```

开发模式下：
- Vite 运行在 `http://localhost:5173`
- Electron 加载该 URL（HMR 热更新）
- 游戏目录为项目根目录下的 `games/`

### 构建游戏

将独立游戏项目构建并复制到平台：

```powershell
# 构建数独 → games/sudoku/
node scripts/build-game.cjs ../sudoku

# 构建到内置游戏目录
node scripts/build-game.cjs ../sudoku --builtin
```

脚本流程：`npm run build` → 复制 `dist/` + `game.json` + `icon.png` 到目标位置。

### 打包平台

```powershell
# 仅打包（不解包目录，快速测试）
npm run package:dir
# 输出: release/win-unpacked/GamePlatform.exe

# 生成 NSIS 安装程序
npm run package
# 输出: release/GamePlatform Setup 1.0.0.exe

# 构建 + 发布到 GitHub Releases
npm run release
# 需要: $env:GH_TOKEN
```

## 开发新游戏

### 步骤

1. 在平台外独立创建游戏项目（React/Vite/TS 或纯 HTML）
2. 创建 `game.json` 填写元数据
3. 使用 `npm run build-game -- ../your-game --builtin` 构建到 `resources/builtin/`
4. 在 `games-registry.json` 中注册（可选，用于远程更新）
5. 重新打包平台发布

### 注意事项

- `index.html` 中的资源路径必须是相对路径（`./assets/...`）
- Vite 项目需配置 `base: './'`
- 游戏窗口默认不可最大化、不可全屏
- 游戏窗口 parent 设置为平台窗口，关闭平台时一并关闭

## 常见问题

### 游戏空白/不加载

检查 `%APPDATA%/game-platform/games/<id>/` 目录结构，确认 `assets/` 目录在 `index.html` 同级（而非嵌套）。若嵌套，删除该目录重启平台自动修复。

### 图标不显示

`icon` 字段对应文件名需与文件夹内图标文件名一致，支持 png/svg/ico/jpg。

### 更新无效

- 平台更新：确认 GitHub Release 上有 `latest.yml`
- 游戏更新：确认 `games-registry.json` 的 raw URL 可访问，version 号大于本地
- 版本感知同步：确认 `resources/builtin/<game>/game.json` 中 version 已更新

### 打包超时/EBUSY

`electron-builder --win` 会在最后执行签名步骤，可能超时。`package:dir` 跳过安装包打包，输出 `release/win-unpacked/` 用于本地测试。正式发布用 `npm run release`。

---

## 贡献

欢迎提交 Issue 和 PR！请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

### 贡献者

感谢所有为这个项目付出的人：

<!-- ALL-CONTRIBUTORS-LIST:START -->
<table>
  <tr>
    <td align="center">
      <a href="https://github.com/1479650473">
        <img src="https://github.com/1479650473.png" width="60px" alt=""/>
        <br /><sub><b>csy & gr</b></sub>
      </a>
      <br /><sub>💻 🎨 📦</sub>
    </td>
  </tr>
</table>
<!-- ALL-CONTRIBUTORS-LIST:END -->

> 💻 代码 &nbsp; 🎨 设计 &nbsp; 📦 打包 &nbsp; 📖 文档 &nbsp; 🐛 报告 Bug

## 许可证

MIT © csy & gr
