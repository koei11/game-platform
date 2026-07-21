# 贡献指南

感谢你对 GamePlatform 的关注！参与方式如下。

## 环境搭建

```powershell
git clone https://github.com/1479650473/game-platform.git
cd game-platform
npm install
```

## 开发模式

```powershell
# 同时启动 Vite 开发服务器和 Electron
npm run electron:dev
```

## 代码规范

- 前端：TypeScript + React 19，样式用纯 CSS（`src/App.css`）
- 主进程：CommonJS（`electron/` 下的 `.cjs` 文件）
- Lint：`npm run lint`（基于 oxlint）
- Type Check：`npm run build` 包含 `tsc -b`
- Commit 消息请用中文，格式随意

## 提交流程

1. **Fork 仓库**（外部贡献者）或在主仓库**创建分支**（团队成员）
2. 开发功能 / 修复 bug
3. 确保 `npm run build` 和 `npm run lint` 通过
4. 提交 PR 到 `main` 分支
5. 等待 review 和 CI 通过后合并

## 添加新游戏

1. 在 `resources/builtin/<game-id>/` 下放置游戏文件
2. 创建 `resources/builtin/<game-id>/game.json`，填写元数据
3. 在 `games-registry.json` 中添加对应条目
4. 打包测试：`npm run package:dir`

## 项目结构

```
electron/    → 主进程（窗口管理、IPC、更新逻辑）
src/         → 渲染进程（React 前端）
scripts/     → 构建脚本
resources/   → 内置游戏源
```

## 需要帮助？

- 提 Issue
- 在 PR 中 @ 仓库维护者
