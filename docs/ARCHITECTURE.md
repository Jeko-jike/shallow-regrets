# 架构文档（ARCHITECTURE.md）

> 本文档描述《浅滩鱼悔》的模块划分、状态机、联机协议与 cloudflared 使用排障。
> 规则细节见 [RULES.md](RULES.md)；资源登记见 [ASSETS.md](ASSETS.md)。

## 一、总体架构

单机模式（M1/M2/M4/M5）为纯静态 HTML/CSS/JS，双击 `index.html` 即可离线游玩；
联机模式（M3）为"本机 Node.js 服务 + Socket.IO + cloudflared 隧道"的主机权威架构。

```
┌───────────────────────────── 浏览器（单机 / 客户端） ─────────────────────────────┐
│  js/ui/*       视图层：渲染 + 交互，无业务规则                                        │
│  js/main.js    模式路由 / 对局控制器 / 联机会话                                        │
│  js/ai/*       启发式 AI（M2/M4）    js/solo/* 脚本对手（M5）                         │
│  js/spectate/* M4 观战编排           js/net/*  M3 客户端                              │
│  js/core/*     纯逻辑层：规则 / 状态机 / 计分（禁止触碰 DOM）                          │
└────────────────────────────────────────────────────────────────────────────────────┘
                                  │ Socket.IO（仅 M3）
                                  ▼
┌───────────────────────────── 主机服务（Node.js） ──────────────────────────────────┐
│  server/server.js    静态托管 + Socket.IO 事件入口                                    │
│  server/room.js      房间管理（4 位房间码 / 准备 / 生命周期）                          │
│  server/gameServer.js 主机权威：复用 js/core/stateMachine.js 校验并广播               │
└────────────────────────────────────────────────────────────────────────────────────┘
                                  │ cloudflared tunnel
                                  ▼
                    https://xxx.trycloudflare.com（临时公网 URL）
```

**依赖方向约束**：`ui → core`（只读状态、派发动作）；`core` 不 import `ui/net/server`；
`net` 只依赖 core 的协议与状态机；`server` 复用 core 逻辑但不被 core 反向依赖。禁止循环依赖。

## 二、模块职责

| 模块 | 职责 | 关键导出 |
|------|------|----------|
| `core/cards.js` | 18 张卡牌数据（唯一数据源） | `CARDS`、`CARD_BY_ID` |
| `core/gameState.js` | 初始状态、不可变更新、钩数计算 | `createInitialState`、`cloneState`、`getHooks` |
| `core/stateMachine.js` | 状态机：动作校验与推进（确定性） | `ACTION`、`PHASE`、`validateAction`、`applyAction` |
| `core/rules.js` | 取牌/钓走/放回合法性、终局判定 | `canCatch`、`getDrawableShoals`、`getLegalThrowTargets`、`checkGameOver` |
| `core/abilities.js` | 六种能力效果纯函数 + 目标校验 + 确定性随机 | `applyAbilityEffect`、`validateAbilityTarget` |
| `core/scoring.js` | 终局计分与污秽惩罚 | `getResults`、`getWinners` |
| `ai/heuristicAI.js` | 启发式 AI（M2/M4 共享） | `chooseAction` |
| `ai/aiDecision.js` | AI 决策理由生成（M4 日志） | `explainDecision` |
| `spectate/spectate.js` | M4 观战编排：回合调度/自动手动/速度/回放 | `SpectateController` |
| `spectate/battleLog.js` | 战斗日志纯数据 + 回放导出/恢复 | `BattleLog` |
| `solo/soloScript.js` | M5 脚本对手：6 张固定目标卡 + 确定性剧本 | `TARGETS`、`chooseScriptAction` |
| `solo/soloFlow.js` | M5 Solo 流程控制 + 实时目标 + 结算评价 | `SoloController` |
| `net/protocol.js` | 前后端共享消息协议（字段/校验/快照） | `MSG`、`toSnapshot`、`validate*` |
| `net/socketClient.js` | M3 Socket.IO 客户端 | `SocketClient` |
| `ui/render.js` | 浅滩/抽出牌/钓获区/结算渲染 | `renderBoard` 等 |
| `ui/interaction.js` | 交互计算 + 共享棋盘 UI 描述 | `buildBoardUi` |
| `ui/boardInteraction.js` | 玩家棋盘点击处理（M1/M2/M3/M5 共用） | `createBoardInteraction` |
| `ui/spectateUI.js` | M4 观战界面 | `openM4Setup`、`startSpectate` |
| `ui/soloUI.js` | M5 Solo 界面 | `openM5Setup`、`startSolo` |
| `utils/rng.js` | 可注入种子的随机数（测试复现） | `createRng` |
| `utils/logger.js` | 分级日志 | `logger`、`setLogLevel` |

## 三、状态机

### 阶段（PHASE）

```
ability（能力阶段）→ draw（抽牌）→ catch（钓走/放生）→ 下一位玩家（或 gameOver）
```

| 阶段 | 说明 | 合法动作 |
|------|------|----------|
| `ability` | 回合开始，可发动任意数量已钓能力鱼 | `USE_ABILITY`、`PASS_ABILITIES` |
| `draw` | 从任意浅滩取 2 张（可同一/不同浅滩） | `DRAW` |
| `catch` | 钓走 1 张或放回 | `CATCH`、`THROW_BACK` |
| `gameOver` | 终局 | 无 |

### 动作（ACTION）

| 动作 | 载荷 | 说明 |
|------|------|------|
| `USE_ABILITY` | `{ cardId, target? }` | 发动已钓能力鱼（整局一次，发动后横置） |
| `PASS_ABILITIES` | — | 跳过能力阶段进入抽牌 |
| `DRAW` | `{ from: number[] }` | 按所需张数从浅滩取牌（长度必须等于所需张数） |
| `CATCH` | `{ cardId }` | 钓走一张（钩数需 ≥ strength，每回合最多 1 条） |
| `THROW_BACK` | `{ cardId, shoalIndex }` | 放回一张（有可钓牌时必须先钓走一条） |

### 确定性

`applyAction(state, action)` 为纯函数：同一状态 + 同一动作序列必然得到同一结果。
因此同一套状态机可被单机、联机服务端（权威）、回放与测试复用。
随机性（洗牌、能力随机）全部通过可注入种子的 `createRng` 实现，`state.seed` 记录种子。

## 四、联机协议（M3）

所有消息为 JSON，字段/类型/校验统一在 `js/net/protocol.js`（前后端同构，有协议一致性测试）。

### 消息类型（MSG）

| 方向 | 消息 | 说明 |
|------|------|------|
| C→S | `CREATE` | 建房（房主） |
| C→S | `JOIN` | 加入房间（房间码 + 昵称） |
| C→S | `READY` | 准备/取消准备 |
| C→S | `START` | 房主开始对局（需全员准备） |
| C→S | `ACTION` | 提交动作（服务端先校验轮到谁，再交状态机） |
| C→S | `KICK` | 房主踢人 |
| C→S | `LEAVE` / `PING` | 离开 / 心跳 |
| S→C | `JOINED` | 加入成功（含 playerId / isHost / 房间信息） |
| S→C | `ROOM_UPDATE` | 房间成员/准备状态广播 |
| S→C | `JOIN_ERROR` | 加入失败原因 |
| S→C | `GAME_START` | 对局开始（含 seed / 玩家 / 初始快照） |
| S→C | `STATE_SYNC` | 权威状态快照广播 |
| S→C | `PEEK_RESULT` | 偷看浅滩结果（仅发给发动者） |
| S→C | `ACTION_REJECTED` | 动作被拒（含原因） |
| S→C | `PLAYER_LEFT` | 玩家掉线（已由 AI 托管） |
| S→C | `RECONNECT` | 重连成功（补发当前快照） |
| S→C | `GAME_OVER` / `PONG` / `ERROR` | 终局 / 心跳应答 / 通用错误 |

### 状态快照（toSnapshot）

可序列化纯数据：`version / seed / players / shoals / currentPlayer / phase / turn / drawn / drawnFrom / extraDraw / caughtThisTurn / gameOver / winner`。
用于渲染、重连恢复与对局回放。浅滩堆内容保留（客户端规则函数依赖顶牌强度判定放回合法性）；
服务端为权威，动作一律经状态机校验，客户端无法用快照信息作弊。

### 断线与托管

- 对局中掉线 → 席位保留，`connected=false`，由 `heuristicAI` 托管（`ai=true`），界面明示。
- 同名玩家重连 → 恢复席位并补发快照。
- 房间 30 分钟无活动自动销毁；回放保留 1 小时。

## 五、cloudflared 使用与排障

### 使用步骤

1. 安装 `cloudflared-windows-amd64.exe`（见 [tools/README.md](tools/README.md)）。
2. 启动本机服务：`npm run serve`（监听 3000）。
3. 暴露公网：`cloudflared tunnel --url http://localhost:3000`。
4. 复制返回的 `https://xxx.trycloudflare.com` 发给好友。
5. 主机与好友都打开该网址参与对局。

### 已知陷阱与排障

| 现象 | 原因 | 解决 |
|------|------|------|
| 好友打不开 URL | cloudflared 未运行 / 已退出 | 重新运行命令，重新分享新 URL |
| URL 变了 | 临时 URL 每次重启 cloudflared 都会变 | 需要固定地址用命名隧道 + 域名（见 tools/README.md） |
| 局域网内可连、公网不行 | 防火墙 / 隧道未建立 | 检查 cloudflared 输出；或改用局域网兜底 |
| 对局不同步 | 客户端与服务端状态机版本不一致 | 确认双方使用同一构建产物（`npm run build` 后分发） |
| 掉线后动作被拒 | 掉线玩家已由 AI 托管 | 等待 AI 行动或重连恢复席位 |

## 六、构建与部署

- `npm run build`：Vite 构建后由 `tools/inline-build.mjs` 把 JS/CSS 内联进 `dist/index.html`，
  产物可双击（`file://`）离线运行。
- `npm run serve`：启动联机服务（静态托管优先 `dist/`，否则根目录源码）。
- 单机交付：分发 `dist/index.html` 即可；联机交付：`npm run serve` + cloudflared。
