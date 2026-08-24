# cloudflared 联机使用说明（tools/README.md）

> 本文档说明 M3 联机模式如何用 `cloudflared-windows-amd64` 把本机服务暴露为临时公网网址，
> 让好友在任意网络打开即加入对局。架构与协议见 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)。

## 一、下载与安装

1. 前往 Cloudflare 官方下载页获取 Windows 版 `cloudflared`：
   - 官方下载：<https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/>
   - 或 GitHub Releases：<https://github.com/cloudflare/cloudflared/releases>
2. 下载 `cloudflared-windows-amd64.exe`。
3. 放置方式二选一：
   - **方式 A（推荐）**：把 `cloudflared-windows-amd64.exe` 重命名为 `cloudflared.exe`，
     放入项目根目录或任意目录，命令行中直接使用完整路径。
   - **方式 B**：把 `cloudflared.exe` 所在目录加入系统 PATH，之后可直接输入 `cloudflared` 命令。

> 注意：`.gitignore` 已忽略 `cloudflared/` 目录与 `*.pem` / `*.jsonl` 凭据文件，
> 禁止把隧道凭据提交到仓库。

## 二、快速联机（临时隧道）

### 1. 启动本机服务

```bash
npm run serve
```

默认监听 `http://localhost:3000`（可用环境变量 `PORT` 修改）。

### 2. 暴露临时公网网址

```bash
cloudflared tunnel --url http://localhost:3000
```

命令运行后，终端会输出类似：

```
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://xxxxxxxx.trycloudflare.com
```

复制 `https://xxxxxxxx.trycloudflare.com` 发给好友。

### 3. 建房与加入

- 主机与好友都打开该网址。
- 主机点击"联机对战"→"创建房间"；好友点击"加入房间"并输入 4 位房间码。
- 全员"准备"后，房主点击"开始对局"。

> 提示：临时 URL 每次重启 cloudflared 都会变化，需重新分享。
> 需要固定地址时使用命名隧道 + 自有域名（见第四节）。

## 三、局域网兜底

若不想用 cloudflared（或隧道不可达），主机直接把内网地址发给同一网络的好友即可直连：

```bash
# 查看本机内网 IP（Windows）
ipconfig
```

把 `http://本机内网IP:3000` 发给同一局域网的好友，对方打开即可加入。

## 四、固定地址（命名隧道 + 域名，可选）

临时隧道地址不稳定；需要长期固定地址时：

```bash
# 1. 登录（首次）
cloudflared tunnel login

# 2. 创建命名隧道
cloudflared tunnel create shallow-regrets

# 3. 配置 ~/.cloudflared/config.yml，把 tunnel 指向 localhost:3000
# 4. 在 Cloudflare 面板为域名添加 DNS CNAME 指向隧道
# 5. 运行
cloudflared tunnel run shallow-regrets
```

> 命名隧道需要 Cloudflare 账号与自有域名，仅在有固定地址需求时配置。

## 五、常用命令速查

| 命令 | 说明 |
|------|------|
| `cloudflared tunnel --url http://localhost:3000` | 临时隧道（快速联机） |
| `cloudflared tunnel login` | 登录（命名隧道用） |
| `cloudflared tunnel create <name>` | 创建命名隧道 |
| `cloudflared tunnel run <name>` | 运行命名隧道 |
| `cloudflared tunnel list` | 列出命名隧道 |
| `cloudflared tunnel delete <name>` | 删除命名隧道 |
| `cloudflared --version` | 查看版本 |

## 六、排障

| 现象 | 处理 |
|------|------|
| 好友打不开 URL | 确认 cloudflared 仍在运行；临时 URL 已变则重新分享 |
| 终端提示隧道已创建但打不开 | 等待几秒（隧道建立需要时间）；检查本机 3000 端口服务是否在运行 |
| 端口被占用 | 换端口：`PORT=3001 npm run serve`，隧道命令同步改为 `--url http://localhost:3001` |
| 局域网能连、公网不行 | 检查防火墙是否拦截 3000 端口；或改用局域网兜底 |
| 对局不同步 | 确认所有客户端使用同一构建产物（`npm run build` 后分发 `dist/`） |
| cloudflared 被禁/不可达 | 自动降级为"仅局域网联机"并提示，单机模式不受影响 |

## 七、安全提示

- 临时 URL 在 cloudflared 退出后即失效，适合好友间临时对局。
- 房间码用于防陌生人乱入；对局中掉线由 AI 托管，同名可重连。
- 请勿把隧道凭据（`*.pem` / `*.jsonl`）提交到版本库或公开分享。
