# 浅滩鱼悔 · AI 自我维护文档（PROJECT_NOTE）

> 本文件是【强制】维护文档：每次任务/阶段结束必须更新，让下一个会话/开发者无需重读全部代码即可接手。
> 新任务开始前必须先读本文件。

## 一、项目结构速览

```
shallow-regrets/
├── index.html            # 单页入口：首页五模式 / 联机大厅 / 对局页（含 M4 观战面板）/ 结算页
├── css/
│   ├── base.css          # 设计变量（深色海洋恐怖主题）+ 通用按钮
│   ├── layout.css        # 首页 / 对局页 / 结算页 / 联机大厅布局
│   ├── cards.css         # 卡背 / 卡面 / 横置 / 选中态 / 动画
│   ├── board.css         # 浅滩堆 / 抽出牌 / 钓获区 / 操作区 / 观战面板
│   ├── modal.css         # 弹窗 / toast / 设置表单（setup-seg）
│   └── responsive.css    # 桌面与手机竖屏适配
├── js/
│   ├── main.js           # 前端入口：模式路由、对局控制器、联机会话、事件绑定
│   ├── core/             # 纯逻辑层（禁止触碰 DOM，100% 可单测）
│   │   ├── cards.js      # 18 张卡牌数据（唯一数据源；含 strength 所需钩数 与 hooks 提供钩数）
│   │   ├── gameState.js  # 初始状态 / 不可变更新 / getHooks
│   │   ├── stateMachine.js # 状态机：ACTION/PHASE 枚举、validateAction、applyAction
│   │   ├── rules.js      # 取牌合法性 / 强度判定 / 放生 / 终局判定
│   │   ├── abilities.js  # 六种能力效果纯函数表 + 目标校验 + 确定性随机
│   │   └── scoring.js    # 终局计分与污秽惩罚
│   ├── ai/
│   │   ├── heuristicAI.js # 启发式 AI（M2/M4 共享，输入状态快照返回动作）
│   │   └── aiDecision.js  # AI 决策理由生成（M4 战斗日志可观测依据）
│   ├── spectate/
│   │   ├── spectate.js    # M4 SpectateController：回合调度 / 自动手动 / 速度档位 / 回放
│   │   └── battleLog.js   # 战斗日志纯数据 + 回放导出/恢复
│   ├── solo/
│   │   ├── soloScript.js  # M5 脚本对手：6 张固定目标卡 + 确定性剧本（纯函数决策）
│   │   └── soloFlow.js    # M5 SoloController：流程控制 / 实时特色目标 / 结算评价
│   ├── net/
│   │   ├── socketClient.js # M3 Socket.IO 客户端
│   │   └── protocol.js     # 前后端共享消息协议
│   ├── ui/
│   │   ├── render.js       # 浅滩 / 抽出牌 / 钓获区 / 结算渲染（纯渲染）
│   │   ├── interaction.js  # 交互计算（可点性 / 提示文案 / buildBoardUi 共享棋盘 UI 描述）
│   │   ├── boardInteraction.js # 玩家棋盘点击处理（M1/M2/M3/M5 共用，工厂注入）
│   │   ├── animations.js   # 动画开关
│   │   ├── modal.js        # 弹窗 / toast / 规则说明
│   │   ├── screens.js      # 屏幕切换（home/game/result/lobby）
│   │   ├── spectateUI.js   # M4 观战界面：控制面板 / 战斗日志 / 回放导出
│   │   └── soloUI.js       # M5 Solo 界面：对手信息 / 特色目标 / 脚本意图与日志 / 结算评价
│   ├── utils/
│   │   ├── logger.js       # 分级日志
│   │   ├── rng.js          # 可注入种子的随机数
│   │   └── eventBus.js     # 事件总线（预留）
│   └── data/
│       └── artPrompts.js   # 18 张卡 AI 绘图提示词清单 + getArtUrl 本地相对路径
├── server/               # M3 联机服务端（Node.js）
│   ├── server.js         # 入口：静态托管 + Socket.IO
│   ├── room.js           # 房间管理（4 位房间码 / 准备 / 生命周期）
│   └── gameServer.js     # 主机权威：复用 core/stateMachine.js 校验并广播
├── tests/                # 与 js/ 一一对应（core / ai / spectate / net / server / ui）
├── tools/
│   ├── inline-build.mjs  # 构建后内联 JS/CSS 到 dist/index.html（可双击离线运行）
│   └── README.md         # cloudflared 下载/配置/常用命令/排障说明
└── docs/                 # RULES / ARCHITECTURE / ASSETS / CHANGELOG / ISSUE_TEMPLATE / PROJECT_NOTE
```

依赖方向：`ui → core`（只读状态、派发动作）；`core` 不 import `ui/net/server`；`net` 只依赖 core 协议与状态机；`server` 复用 core 不被反向依赖。禁止循环依赖。

## 二、过往经验与踩坑记录

1. **钩子机制死锁（M4 关键 Bug）**
   - 现象：AI 对局死循环，永远 0 钩、只抽不放，无法终局。
   - 原因：`getHooks` 用 `card.strength` 同时表示"所需钩数"与"提供钩数"，导致钓到 strength=0 的小鱼不提供任何钩子，AI 永远无法钓大鱼。
   - 解决：卡牌新增独立字段 `hooks`（提供钩数），`strength` 仅表示"所需钩数"；`getHooks` 改为累加 `card.hooks`。
   - 约定：**难度（strength）与产出（hooks）必须分离**，小鱼 strength=0 但 hooks=1。
   - 回归：`tests/spectate/spectate.test.js` 覆盖 40 个种子，保证任意种子在 <200 步内终局。

2. **AI 放回埋牌**
   - 现象：AI 把牌放回来源浅滩，可能盖住可钓的顶牌，拖慢对局。
   - 解决：`chooseCatchAction` 放回时优先选择非来源浅滩的合法目标。
   - 约定：放回逻辑必须考虑"避免埋住可钓牌"。

3. **AI 能力处理 ReferenceError**
   - 现象：`swap_fish` 能力处理中 `me is not defined`。
   - 原因：`buildAbilityAction` 内缺少 `const me = state.players[p]`。
   - 解决：补全变量声明。

4. **jsdom 测试导入时序**
   - 现象：`tests/ui/spectateUI.test.js` 静态 import spectateUI 时，modal.js 在 DOM 就绪前执行，`document.getElementById('modalOverlay')` 返回 null。
   - 解决：测试内先 `document.body.innerHTML = html`，再在 `beforeAll` 中动态 `await import(...)`。
   - 约定：**所有 UI 测试必须在设置 DOM 后动态导入前端模块**。

5. **AI 抽牌死锁：次顶牌永远挖不到**
   - 现象：M4 观战 seed=6 不终局，AI 每回合抽两张不可钓的大鱼再放回，无限循环。
   - 原因：`chooseDrawAction` 对"顶牌/次顶牌可钓"只 +10/+6 分（小量级），且 `from` 每个浅滩只抽 1 张 → 次顶牌即使"可钓加分"也永远埋在顶牌下，抽出来全是不可钓大鱼。
   - 解决：把"可钓的顶牌/次顶牌"改为绝对优先（+100），且当顶牌不可钓、次顶牌可钓时，`from=[i,i]` 连抽同一浅滩两张真正挖到次顶牌。
   - 约定：**难易度（strength）与产钩（hooks）分离后，可钓性必须成为 AI 抽牌/放回的主导信号**；任何"次顶牌收益"若无法被触及就毫无意义。
   - 回归：`tests/spectate/spectate.test.js` 覆盖 40 个种子 + seed=6 现于 85 步内终局。

6. **放回目标需排除满堆（≥3）**
   - 规则层新增：已有 3 张的浅滩不再作为放回目标（`getLegalThrowTargets` 首行 `if (s.length >= CARDS_PER_SHOAL) return;`）。
   - 同步：放回相关测试状态改为"未满堆（2 张）"，避免构造 6×3 全满状态导致无合法放回目标。

7. **Solo noFoul 目标三态**
   - 全局特色目标"全程未钓污秽"开局 0 条不得算达成，否则永远亮灯。
   - `getLiveGoals` 每项目标带三态 `status: progress | failed | done`；noFoul 仅终局且全程无污秽为 done，一钓污秽即 failed。

8. **Vite 构建产物不可双击**
   - 现象：`vite build` 默认输出分离的 CSS/JS 文件，`file://` 下 ES module 因 CORS 无法加载。
   - 解决：`tools/inline-build.mjs` 把 JS/CSS 内联进 `dist/index.html`；`package.json` 的 `build` 脚本为 `vite build && node tools/inline-build.mjs`。
   - 约定：**单机交付必须走 `npm run build` 生成可双击的 dist/index.html**。

9. **Solo 玩家回合结束后脚本回合不推进**
   - 现象：M5 玩家结束回合后无法轮到人机脚本回合，脚本意图/行动日志不显示。
   - 原因：`runScript()` 只在对局开始调用一次，玩家动作结束后没有任何调用方触发脚本回合。
   - 解决：`boardInteraction` 的 `dispatch` 包装里，若玩家动作结束了本回合（`isScriptTurn()` 为真）自动调用 `runScript()`；`startSolo` 时重置脚本意图文案。
   - 约定：**任何"玩家动作推进到对方回合"的控制器，都必须在 dispatch 后检查是否轮到脚本并就绪调度**。

10. **卡图必须用本地方案（勿回退到外网图片 URL）**
   - 背景：早期卡图用外网 `text_to_image` 接口按 prompt 现生成，GitHub Pages 上因网络/跨域时好时坏。
   - 现在：18 张卡图存 `public/cards/{id}.jpg`，`getArtUrl` 返回相对路径 `cards/{artKey}.jpg`，构建复制到 `dist/cards/`；本地双击与 Pages 均稳定。
   - 约定：新增/更换卡图须放入 `public/cards/` 并命名为 `{artKey}.jpg`；**gh-pages 分支部署必须连同 `cards/` 目录一起提交**，否则线上缺图。
   - 卡背保持 CSS 矢量绘制，无需位图（卡面 img 的 `error` 事件有 `art-fallback` 兜底）。

11. **空浅滩没有卡背 → 整堆需要单独绑点击**
   - 现象：把牌放回到唯一空浅滩时点不动、放回操作挂在半途（看似卡死）。
   - 原因：`renderShoals` 只为每张 `card-back` 绑定 `onShoalClick`，**空浅滩没有卡背元素，整堆根本无点击目标**。`getLegalThrowTargets` 正确的只把空浅滩列为放回目标，反而放大了这个交互缺口。
   - 解决：空浅滩时给 `shoal-stack` 整堆绑定点击（`ui.shoalClickable(i)` 为真时加 `.selectable` 并监听），并加 `.shoal.empty .shoal-stack.selectable` 高亮样式提示可点。
   - 约定：**渲染层凡"可点但无天然子元素可绑"的实体，必须给容器本身绑点击**并自测。

12. **卡面全幅插画 + 透明文字会脱离 flex 流**
   - 现象：把 `cf-art-wrap` 和 `cf-info` 都设 absolute overlay 后，卡片内部布局（flex column）不再决定子元素位置。
   - 解决：`cf-art-wrap` 用 `position:absolute; inset:0` 占满整卡；`cf-info` 用 `position:absolute; left/right/bottom:0; height:50%` 叠于卡面下半。文字可读靠 `text-shadow`（双层）+ `-webkit-text-stroke` 细描边，背景设 transparent。
   - 约定：全幅卡面渲染时，信息层必须显式定位（absolute）而非依赖 flex 流；改卡面结构后需在多种尺寸下验收文字可读性。

## 三、任务日志

### 2026-08-28 · 批量维护：卡图/尺寸/开局/文本/卡面/详情/修复/移动端（0.7.0）
- 卡图压缩：1920×1920 → 512×512 JPEG，全副约 1.2MB，加载显著加速；仍存 `public/cards/{id}.jpg`，构建复制到 `dist/cards/`。
- 卡片尺寸：基准卡 92×138 → **118×177**，大号抽卡 120×180 → 154×231；移动端（≤520px）100×150 / 130×195，仍适配三列浅滩。预览文件 `card-size-preview.html`（可拖动滑块对比尺寸）。
  - `css/base.css` 变量、`css/responsive.css` 移动端变量、`css/cards.css` lg 字号、`css/board.css` drawn-area min-height 同步放大。
- 开局顶牌：`ensureSmallTops` 由"随机洗"改为**确定性跨浅滩交换**（只在不空浅滩间交换、绝不触碰空浅滩 [0]），保证 ≥3 个浅滩顶牌为 strength≤0 的小鱼；`shuffle_shoals` 能力复用同一逻辑。
  - 修复交换处**小牌被覆盖丢失、顶牌拿到重复大牌**的数据损坏 Bug：交换前先保存小牌值。
  - 回归：`tests/core/gameState.test.js` 新增 2000 种子断言"顶牌数 ≥3 且整副 18 张不重复不丢失"。
- 数字置于单位/emoji 前：卡面 `需⚓5→需5⚓`、`供⚓1→供1⚓`；玩家条 `⚓5→5⚓`；钓获区 `⚓ n 钩→n⚓ 钩`（`render.js`）。
- 卡面文字浮于卡图上、背景透明：`cf-art-wrap` 占满整卡（absolute inset 0），`cf-info` 半透明叠于卡面下半（absolute bottom），用文字阴影 + 细描边保证可读（`cards.css`）。
- 新功能「卡牌详情」：点击卡面（抽出牌 / 钓获区）弹出详情（大图 + 能力 + 数值）；能力阶段中可发动的己方能力鱼，详情内出现「发动能力」按钮。目标选择流程（偷看/横置/交换）点击仍用于选目标（`main.js` showCardDetail + `render.js` onCardInfo + `modal.css`）。
- 空浅滩无法放回卡死修复：`renderShoals` 原只为卡背绑定点击，空浅滩无卡背 → 点不动。现空浅滩整堆可点（`.shoal-stack.selectable` + 高亮样式）。
  - 回归：`tests/ui/main.test.js` 新增空浅滩可点测试。
- 移动端 UI：`跳过能力阶段` 按钮从操作条移至抽出牌区下方（玩家区上方），桌面端同步移动（`render.js` renderDrawn dc-skip + `board.css`），已同步测试选择器。
- 测试 134 例全绿（16 文件），`npm run build` 通过且 dist 完全内联。

### 2026-08-25 · 批量修复与 UI 优化（0.6.0）
- 抽牌选牌交互修复：原可实现无限多选超上限 → 确认按钮永久禁用、卡死在抽牌回合。现以"本回合应抽数"为总上限、点击已选浅滩可取消、提供"清空重选"、提示 `已选 x/y`（`js/ui/boardInteraction.js` + `interaction.js`）。
- 卡面布局重做：上半 50% 插画 + 下半 50% 信息区（分值 / 需钩(难度) / 供钩(钩数) / 名称 / 能力），供钩为 0 灰显（`css/cards.css` + `render.js`）。
- 卡背新增难度区间徽章：`[strength-1, strength+1]` 截断 0-5（如难度 4 → "3-5"）。
- 玩家条 / 钓获区同时显示实时"分"与"⚓钩"（`getRawScore` + `getHooks`，明确分离）。
- Solo 脚本回合调度修复：玩家动作若结束本回合，`boardInteraction` 的 dispatch 后自动调用 `runScript()`，脚本回合不再卡死；开新局重置脚本意图文案（`soloUI.js`）。
- Solo 特色目标三态：`getLiveGoals` 每项目标带 `status: progress | failed | done`；noFoul 一钓污秽即 failed（见踩坑 #7）。
- 放回目标排除满堆（≥3 张）；平衡性调整——分值 > 3 的卡 `hooks: 0`，钩数仅靠小鱼积累（见 ADR）。
- 测试 129 → 133 例全绿。

### 2026-08-25 · 卡图改为本地方案并为线上页配图
- 按 `artPrompts.js` 提示词批量生成 18 张卡图（手绘水彩克苏鲁风格），存 `public/cards/{id}.jpg`；构建复制到 `dist/cards/`。
- `getArtUrl` 由"返回外网图片生成 URL"改为"返回本地相对路径 `cards/{artKey}.jpg`"，与网络解耦：本地离线双击、GitHub Pages（根/子路径）均稳定加载。
- 卡背保持 CSS 矢量绘制（漩涡 + 鱼钩 + 难度区间徽章），不使用位图；故仅交付 18 张卡图，无卡背位图。
- 部署：gh-pages 分支需一并提交 `cards/` 图片目录（仅提交 index.html 会导致线上缺图）。

### 2026-08-25 · 补齐全部文档（收尾）
- 新增 `README.md`：项目简介、五模式说明、单机/联机运行方式、测试命令、目录结构、资源许可声明。
- 新增 `docs/ARCHITECTURE.md`：总体架构图、模块职责表、状态机（PHASE/ACTION/确定性）、联机协议（MSG/快照/断线托管）、cloudflared 使用与已知陷阱排障、构建部署。
- 新增 `docs/ASSETS.md`：18 张卡 AI 绘图提示词登记、CC0/CC-BY 指定渠道与署名要求（当前 UI 纯 CSS，assets/ 为空）。
- 新增 `docs/ISSUE_TEMPLATE.md`：Bug 报告模板（环境/复现/预期/实际/日志/回放）+ 修复流程。
- 新增 `tools/README.md`：cloudflared-windows-amd64 下载/安装/临时隧道/局域网兜底/命名隧道/命令速查/排障/安全提示。
- 更新 `docs/CHANGELOG.md` 至 0.5.0（M5 新增 + 文档补齐）。
- 为什么：交付物清单要求 README 与 docs/ 全部文档齐备；文档与代码同步是硬性要求。

### 2026-08-25 · M5 Solo 玩法完成
- 新增 `js/solo/soloScript.js`：脚本对手"渔夫与青蛙"的 6 张固定目标卡（kraken/kelpie/oarfish/eversquid/barracuda/morayEel）+ 确定性剧本（能力固定顺序 / 目标浅滩取牌 / 目标优先钓走 / 污秽优先放回），全部为纯函数。
- 新增 `js/solo/soloFlow.js`：`SoloController` 管理玩家/脚本回合、动作派发校验、`getLiveGoals`（实时特色目标进度）与 `getEvaluation`（星级 + 等级 + 目标达成）。
- 新增 `js/ui/soloUI.js`：Solo 面板（脚本对手信息 / 特色目标进度 / 脚本意图提示 / 脚本行动日志）、脚本回合定时器串行推进（仅节奏不改结果）、结算评价渲染。
- 新增 `js/ui/boardInteraction.js`：从 main.js 抽取玩家棋盘点击处理（M1/M2/M3/M5 共用，工厂注入 getState/getUi/dispatch/renderAll）。
- 修改 `js/ui/interaction.js`：新增 `buildBoardUi` 共享棋盘 UI 描述（浅滩可点/选中、放回目标、能力目标、状态文案），main.js 与 soloUI.js 复用。
- 修改 `js/main.js`：M5 模式路由、返回/再来一局/返回首页对 Solo 生命周期的处理；getUi 改用 buildBoardUi。
- 修改 `index.html`：对局页内嵌 `#soloPanel`，结算页新增 `#soloResult` 评价容器。
- 修改 `css/board.css` / `css/responsive.css`：Solo 面板与结算评价样式、窄屏单列。
- 新增测试：`tests/solo/soloScript.test.js`（12 例：固定卡组 / 能力 / 抽牌 / 钓走放回剧本分支）、`tests/solo/soloFlow.test.js`（9 例：先后手 / 确定性 / 防死锁 / 结算评价）、`tests/ui/soloUI.test.js`（4 例：设置入口 / 脚本自动行动日志 / 结算评价 / 返回首页）。
- 为什么：M5 核心逻辑此前已完成，本次补齐 Solo UI、共享交互抽取与全量测试，使 M5 可完整游玩并通过验收。

### 2026-08-25 · 上传 GitHub 并启用 GitHub Pages 托管
- 新建公开仓库 `Jeko-jike/shallow-regrets`，`main` 分支存放全部源码，`gh-pages` 分支仅含构建产物 `index.html`（自包含）。
- Pages 经典部署：发布源 = `gh-pages` 分支根目录，站点 `https://jeko-jike.github.io/shallow-regrets/`。
- 坑点与经验：
  - 推送含 `.github/workflows/*.yml` 的提交需 GitHub `workflow` scope（当前 keyring 令牌只有 `repo`），故未采用 Actions 方案，改用 gh-pages 分支经典部署。
  - PowerShell 管道写 `git mktree` 时文件名末尾被加上 `\r`，导致 Pages 找不到 `index.html` 返回 404；改用 `git update-index --cacheinfo 100644,<blob>,index.html` + `write-tree` + `commit-tree` 即可得到干净的根树。
- 静态托管说明：GitHub Pages 无后端，**M3 联机仍需本机启动 `npm run serve` + cloudflared**；M1/M2/M4/M5 单机模式可直接在线游玩。

### 2026-08-25 · M4 观战 UI 完成
- 新增 `js/ui/spectateUI.js`：M4 观战界面（AI 面板、速度/回合控制、战斗日志滚动区、回放导出）。
- 新增 `js/ui/screens.js`：共享屏幕切换（消除 main.js 与 spectateUI 的重复）。
- 修改 `index.html`：对局页内嵌 `#spectatePanel`（回合控制 + 战斗日志），标题加 `id="gameTitle"`。
- 修改 `css/board.css` / `css/responsive.css`：观战面板样式与窄屏单列。
- 修改 `js/ui/render.js`：`renderDrawn` 增加 `{ spectate: true }` 选项隐藏钓走/放回按钮。
- 修改 `js/main.js`：M4 模式路由、返回/再来一局/返回首页对观战生命周期的处理。
- 新增 `tests/ui/spectateUI.test.js`：设置弹窗、手动推进、日志、立即结束、返回首页、自动模式终局。
- 修改 `package.json`：`build` 脚本接入 `tools/inline-build.mjs`。
- 为什么：M4 核心编排（spectate.js/battleLog.js）此前已完成并修复死锁，本次补齐观战 UI 与入口，使 M4 可完整游玩。

## 四、当前进度与下一步

| 模式 | 状态 | 说明 |
|------|------|------|
| M1 本地对战 | ✅ 完成 | 热座、遮挡切换、结算 |
| M2 单人 AI | ✅ 完成 | 启发式 AI，与玩家同接口 |
| M3 联机 | ✅ 完成 | Socket.IO + cloudflared，主机权威 |
| M4 AI 斗蛐蛐 | ✅ 完成 | 观战 UI + 战斗日志 + 自动/手动 + 速度档位 + 回放导出 |
| M5 Solo | ✅ 完成 | 6 卡脚本对手 + 独立流程 + 特色目标/星级评价 |

下一步计划（收尾）：
1. ✅ 补齐文档：README.md、docs/ARCHITECTURE.md、docs/ASSETS.md、docs/ISSUE_TEMPLATE.md、tools/README.md，并更新 CHANGELOG 至 0.5.0。
2. ✅ 终验：`npm test` 全绿（133 例 / 16 文件）、`npm run build` 后 dist/index.html 完全内联可双击、联机服务验证（注意：本机 3000 端口可能被其它服务占用，用 `PORT=3001 npm run serve` 换端口）。
3. ✅ 卡图本地方案（0.6.1）：18 张卡图已生成并纳入 `public/cards/`，`getArtUrl` 返回本地相对路径；`dist/cards/` 随构建输出。
4. ✅ 部署：`main`（源码）与 `gh-pages`（产物 + `cards/`）均含本次更新；晋升需用 worktree 提交 gh-pages（含图片目录）。
5. ⏳ 待办提醒：`docs/ASSETS.md` 仍写 "assets/ 为空（当前 UI 纯 CSS）"，现卡图为 `public/cards/`，后续修档时请同步更正；卡图所有权 / 许可声明如需注明生成工具，请补到 ASSETS.md。
6. ✅ 0.7.0 批量维护已合并（卡图压缩 / 卡面全幅透明 / 尺寸 118px / 卡片详情 / 空浅滩放回 / 数字前置 / 移动端跳过按钮）；134 测试全绿、build 通过；`card-size-preview.html` 为临时预览文件，定稿后可从仓库移除或保留为工具。

## 五、关键决策记录（ADR 简版）

1. **联机为何用 Socket.IO + cloudflared 而非 WebRTC P2P**
   - WebRTC 需处理 ICE/STUN/TURN 打洞，NAT 穿透不稳定，实现复杂；回合制卡牌对中继延迟不敏感。
   - Socket.IO + cloudflared 一条命令即可获得临时公网 URL，穿透 100% 可靠，实现远简单。

2. **钩数机制：strength 与 hooks 分离**
   - 官方规则"已钓到的鱼其 strength 之和即当前钩子数"在 18 卡精简版中会导致小鱼不产钩、开局死锁。
   - 采用 `strength`（所需钩数）+ `hooks`（提供钩数）分离，小鱼 strength=0/hooks=1，保证对局可推进。

2b. **平衡性：分值 > 3 的卡不提供钩数（hooks: 0）**
   - 若大鱼（如梭鱼/克拉肯）被钓获后仍产钩，容易滚雪球、大鱼无限连锁。
   - 现在仅分值 ≤ 3 的小/中型鱼各提供 1 钩，大鱼是"终局渔获"、不产钩，钩数只能靠小鱼逐步积累。
   - 代价：对局节奏变慢、更强调策略取舍；已同步到卡面"供钩为 0 灰显"与 AI 抽牌"可钓性绝对优先"。

3. **M4 复用对局页而非独立屏幕**
   - 观战棋盘与普通对局渲染完全一致，复用 `#game` 屏幕 + 内嵌 `#spectatePanel`，避免重复 DOM 与 ID 冲突，渲染层零改动（仅 renderDrawn 加 spectate 选项）。

4. **单机交付必须内联构建**
   - `file://` 下 ES module 受 CORS 限制，必须把 JS/CSS 内联进单个 index.html 才能双击即玩。

5. **M5 脚本对手与 M2 启发式 AI 明确区分**
   - M2 用启发式评估（`heuristicAI.js`）决策；M5 用固定剧本（`soloScript.js`，纯函数、无随机、无评估分支），
     保证"压迫节奏"特色可复现、可单测，且与 M2 语义不混淆。

6. **共享棋盘交互抽取（boardInteraction + buildBoardUi）**
   - M5 与 M1/M2/M3 共用同一套棋盘点击处理与 UI 描述计算，避免复制粘贴导致的规则漂移；
   - `boardInteraction.js` 用工厂注入（getState/getUi/dispatch/renderAll）解耦具体控制器；
   - `interaction.buildBoardUi` 统一生成渲染层所需的可点/选中/目标/提示描述。
