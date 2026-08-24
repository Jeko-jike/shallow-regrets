# Bug 报告模板（ISSUE_TEMPLATE.md）

> 提交 Bug 前请先阅读 [docs/PROJECT_NOTE.md](PROJECT_NOTE.md) 与 [docs/ARCHITECTURE.md](ARCHITECTURE.md)，
> 确认问题未被记录为已知陷阱。修复流程见下文"修复流程"。

## 标题

`[模块] 简述问题`（例：`[core/rules] 放回浅滩时允许盖住小阴影`）

## 环境

- 浏览器及版本：Chrome 126 / Firefox 127 / Safari 17 …
- 系统：Windows 11 / macOS …
- 运行方式：单机双击 `dist/index.html` / Vite dev / 联机（公网 cloudflared / 局域网）
- 游戏版本（CHANGELOG 版本号）：0.5.0

## 复现步骤

1. …
2. …
3. …

## 预期行为

（应当发生什么）

## 实际行为

（实际发生了什么，可附截图）

## 错误日志

（粘贴控制台输出或 logger 日志，格式：`时间戳 | 级别 | 模块 | 事件 | 数据`）

## 是否可复现

- [ ] 总是可复现
- [ ] 偶发（约 __% 概率）
- [ ] 仅特定种子/操作序列可复现

## 回放文件

- 联机模式：提供房间码（回放保留 1 小时，`GET /api/replay/:code`）。
- M4 观战：提供导出的回放 JSON（含 seed 与动作序列）。

## 备注

（其它上下文，如是否与某次改动相关）

---

## 修复流程（开发者）

1. 建 issue（用本模板）。
2. 定位模块（core / ai / spectate / solo / net / server / ui）。
3. 写失败测试（先红后绿）。
4. 修复代码。
5. 补回归测试。
6. 更新 [docs/CHANGELOG.md](CHANGELOG.md) 与相关文档（RULES / ARCHITECTURE / PROJECT_NOTE）。
7. 关闭 issue。

高频 Bug（强度误判、洗牌非法开局、联机不同步、cloudflared 掉线）须沉淀进
[docs/ARCHITECTURE.md](ARCHITECTURE.md) 的"已知陷阱"小节。
