# 浅滩鱼悔（Shallow Regrets）

在灰雾笼罩的海面下钓起恐怖之物的网页版卡牌小游戏，改编自桌游《浅滩鱼悔》（Button Shy Games，2025，作者 Judson Cowan），是《深海渔恨 Deep Regrets》的 18 卡精简版。

无需登录、无需安装，浏览器即开即玩。

## 五种模式

| 模式 | 名称 | 说明 |
|------|------|------|
| M1 | 本地对战 | 同一设备 2-3 人轮流操作（热座 Hotseat），支持遮挡切换防作弊 |
| M2 | 单人 AI | 玩家 vs 启发式电脑 AI（与玩家走同一动作接口，禁止作弊） |
| M3 | 联机对战 | 主机暴露临时公网网址，好友任意网络打开即加入实时对战 |
| M4 | AI 斗蛐蛐 | AI 对战 AI，玩家作为观众观看完整对战，支持自动/手动回合与速度档位 |
| M5 | Solo 挑战 | 玩家 vs 由 6 张固定卡牌构成的预设脚本对手《渔夫与青蛙》 |

## 快速开始

### 单机模式（M1 / M2 / M4 / M5）

**方式一：直接双击（推荐）**

```bash
npm install
npm run build
```

打开 `dist/index.html` 即可离线游玩（JS/CSS 已内联，支持 `file://` 协议）。

**方式二：开发模式**

```bash
npm install
npm run dev
```

浏览器访问 Vite 输出的本地地址（默认 `http://localhost:5173`）。

### 联机模式（M3）

1. 启动本机服务：`npm run serve`（默认监听 `http://localhost:3000`）。
2. 用 cloudflared 暴露临时公网网址：

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. 复制返回的 `https://xxx.trycloudflare.com` 发给好友。
4. 主机与好友都打开该网址 → 建房/加入 → 准备 → 开始对局。

> 详细操作与排障见 [tools/README.md](tools/README.md)。
> 局域网兜底：把 `http://本机内网IP:3000` 发给同一网络的好友即可直连。

## 测试

```bash
npm test        # 运行全部单元测试（Vitest）
npm run test:watch
```

测试覆盖：core 全部纯逻辑（洗牌/取牌/强度/放生/能力/计分/状态机）、AI 决策、M3 协议一致性、M4 观战回放一致性、M5 脚本对手剧本与特色机制、UI 集成（jsdom）。

## 目录结构

```
shallow-regrets/
├── index.html            # 单页入口：首页五模式 / 联机大厅 / 对局页 / 结算页
├── css/                  # base / layout / cards / board / modal / responsive
├── js/
│   ├── main.js           # 前端入口：模式路由、对局控制器、联机会话
│   ├── core/             # 纯逻辑层（禁止触碰 DOM，100% 可单测）
│   │   ├── cards.js      # 18 张卡牌数据（唯一数据源）
│   │   ├── gameState.js  # 初始状态 / 不可变更新 / getHooks
│   │   ├── stateMachine.js # 状态机：ACTION/PHASE、validateAction、applyAction
│   │   ├── rules.js      # 取牌合法性 / 强度判定 / 放生 / 终局判定
│   │   ├── abilities.js  # 六种能力效果纯函数表 + 目标校验
│   │   └── scoring.js    # 终局计分与污秽惩罚
│   ├── ai/               # M2/M4 共享启发式 AI + 决策理由生成
│   ├── spectate/         # M4 观战编排 + 战斗日志/回放
│   ├── solo/             # M5 脚本对手 + Solo 流程控制
│   ├── net/              # M3 Socket.IO 客户端 + 共享协议
│   ├── ui/               # 渲染 / 交互 / 弹窗 / 屏幕切换 / 观战与 Solo 界面
│   ├── utils/            # logger / rng / eventBus
│   └── data/             # artPrompts.js（18 张卡 AI 绘图提示词）
├── server/               # M3 联机服务端（Node.js + Socket.IO）
├── tests/                # 与 js/ 一一对应的单元测试
├── tools/
│   ├── inline-build.mjs  # 构建后内联 JS/CSS 到 dist/index.html
│   └── README.md         # cloudflared 使用说明
└── docs/                 # RULES / ARCHITECTURE / ASSETS / CHANGELOG / ISSUE_TEMPLATE / PROJECT_NOTE
```

依赖方向：`ui → core`（只读状态、派发动作）；`core` 不 import `ui/net/server`；`net` 只依赖 core 协议与状态机；`server` 复用 core 不被反向依赖。禁止循环依赖。

## 文档

- [docs/RULES.md](docs/RULES.md)：完整规则（含 M5 Solo 玩法与平局）
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：模块图 / 状态机 / 联机协议 / cloudflared 排障
- [docs/ASSETS.md](docs/ASSETS.md)：资源来源与许可登记
- [docs/CHANGELOG.md](docs/CHANGELOG.md)：版本变更记录
- [docs/ISSUE_TEMPLATE.md](docs/ISSUE_TEMPLATE.md)：Bug 报告模板
- [docs/PROJECT_NOTE.md](docs/PROJECT_NOTE.md)：AI 自我维护文档（强制）

## 资源许可声明

- 全部卡面由 AI 生成（提示词见 `js/data/artPrompts.js`），无版权素材。
- UI/图标/音效等非核心美术遵循 CC0 / CC-BY 3.0 许可，登记见 [docs/ASSETS.md](docs/ASSETS.md)。
- 代码基于 MIT 许可（见 `package.json`）。

## 规则优先级

规则以 [thefamilygamers.com/shallow-regrets/](https://www.thefamilygamers.com/shallow-regrets/) 为最高优先级权威来源；任何资料与它冲突时，一律以该网址为准。
