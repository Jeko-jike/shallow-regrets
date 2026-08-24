# 变更记录（CHANGELOG）

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本（SemVer）。

## [0.5.0] - 2026-08-25

### 新增
- M5 Solo 挑战《渔夫与青蛙》：
  - `js/solo/soloScript.js`：脚本对手由 6 张固定目标卡构成（kraken/kelpie/oarfish/eversquid/barracuda/morayEel），
    全部决策为纯函数（固定能力顺序 / 目标浅滩取牌 / 目标优先钓走 / 污秽优先放回），无随机与评估分支；
  - `js/solo/soloFlow.js`：`SoloController` 管理玩家/脚本回合、动作派发校验、实时特色目标（`getLiveGoals`）与结算评价（`getEvaluation`，星级 + 等级）；
  - `js/ui/soloUI.js`：Solo 面板（脚本对手信息 / 特色目标进度 / 脚本意图提示 / 脚本行动日志）与结算评价渲染。
- 共享棋盘交互 `js/ui/boardInteraction.js`：从 main.js 抽取玩家棋盘点击处理（M1/M2/M3/M5 共用，工厂注入）。
- `js/ui/interaction.js` 新增 `buildBoardUi` 共享棋盘 UI 描述（浅滩可点/选中、放回目标、能力目标、状态文案）。
- 测试：`tests/solo/soloScript.test.js`（12 例）、`tests/solo/soloFlow.test.js`（9 例）、`tests/ui/soloUI.test.js`（4 例）。

### 变更
- `js/main.js`：接入 M5 模式路由与 Solo 生命周期（返回 / 再来一局 / 返回首页）；`getUi` 改用 `buildBoardUi`。
- `index.html`：对局页内嵌 `#soloPanel`，结算页新增 `#soloResult` 评价容器。
- `css/board.css` / `css/responsive.css`：Solo 面板与结算评价样式、窄屏单列。
- 补齐文档：`README.md`、`docs/ARCHITECTURE.md`、`docs/ASSETS.md`、`docs/ISSUE_TEMPLATE.md`、`tools/README.md`。

## [0.4.0] - 2026-08-25

### 新增
- M4 AI 斗蛐蛐观战界面（`js/ui/spectateUI.js`）：
  - 自动/手动回合控制，对局中可随时切换；
  - 速度档位（慢 3s / 中 1.5s / 快 0.5s），仅影响展示节奏，不改变对局结果；
  - 手动模式支持"下一回合 / 自动 5 回合 / 立即结束本局"；
  - 战斗日志面板逐条展示回合、行动方、动作描述、AI 决策理由与结算反馈，关键节点（能力发动 / 污秽鱼被钓 / 终局）高亮；
  - 回放导出为 JSON（含 seed 与完整动作序列）。
- 共享屏幕切换模块 `js/ui/screens.js`。
- M4 观战 UI 集成测试 `tests/ui/spectateUI.test.js`。

### 变更
- `js/ui/render.js`：`renderDrawn` 支持 `{ spectate: true }` 隐藏钓走/放回按钮。
- `js/main.js`：接入 M4 模式路由与观战生命周期（返回首页 / 再来一局）。
- `package.json`：`build` 脚本改为 `vite build && node tools/inline-build.mjs`，产物可双击离线运行。
- `index.html` / `css/board.css` / `css/responsive.css`：新增观战面板与响应式布局。

### 修复
- 钩子机制死锁：`strength`（所需钩数）与 `hooks`（提供钩数）分离，小鱼钓获提供 1 钩，保证 AI 对局可推进至终局（回归测试覆盖 40 种子）。
- AI 放回逻辑避免把牌放回来源浅滩而埋住可钓牌。
- AI `swap_fish` 能力处理中 `me` 未定义导致的 ReferenceError。

## [0.3.0] - 2026-08-24

### 新增
- M3 联机对战：Socket.IO + cloudflared 临时公网 URL；房间码、准备/开始、踢人、断线 AI 托管、对局回放。
- `server/server.js` / `server/room.js` / `server/gameServer.js`；`js/net/socketClient.js` / `js/net/protocol.js`。
- 协议一致性测试与房间/服务端测试。

## [0.2.0] - 2026-08-24

### 新增
- M2 单人 AI 对战：启发式 AI（`js/ai/heuristicAI.js`），与玩家走同一动作接口。
- AI 决策理由生成 `js/ai/aiDecision.js`。

## [0.1.0] - 2026-08-24

### 新增
- 项目骨架与目录结构。
- M1 本地对战（热座）：core 层（cards/gameState/stateMachine/rules/abilities/scoring）+ UI 层 + 单测。
- 18 张卡牌数据、六种能力、计分与污秽惩罚。
