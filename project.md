# ServerWatch 项目全景文档

> 本文档用于记录 **ServerWatch**（云探针/分布式服务器状态监控系统）的整体架构、模块分工、通信协议、部署运维及后续开发记录，方便项目维护、交接与无缝迁移。

---

## 1. 项目简介 (Overview)
- **项目名称**：ServerWatch
- **定位**：企业级高并发云探针与多��务器性能状态监控面板。
- **架构模式**：B/S 管理端 + Agent 客户端轻量汇报模型。
- **主要特性**：
  - **前后端分离**：现代化 React 18 + Vite + Tailwind CSS + shadcn/ui 控制台 + 后端 Node.js (Koa2) + 客户端 Shell 自动化探针脚本。
  - **无依赖 Agent**：客户端仅依赖 Linux 原生命令（`bash`, `cron`, `curl`/`wget`, `procfs`），零侵入、无额外重量级守护进程。
  - **纯净 WebAssembly SQLite 存储**：服务端采用 `sql.js` (WebAssembly SQLite)，零 C++ 原生库依赖，彻底杜绝各 Linux 发行版下的符号兼容崩溃问题，并实现微秒级读写与异步节流落盘。
  - **高性能前端看板**：列表页采用轻量 CSS 进度条（CPU/内存/磁盘三维呈现），消除数百个 Canvas 实例开销；支持明暗主题切换、国旗归属地展示、访客脱敏模式与快捷编辑模式。
  - **静态单二进制打包**：支持通过 `pkg` 编译为单一可执行文件（Linux x64 / Linux ARM64 / Win x64），单文件内嵌全套前端产物、Shell 探针与 SQLite WASM 二进制。

---

## 2. 技术栈架构 (Tech Stack)

### 2.1 后端服务 (`server/`)
- **运行环境**：Node.js (Koa2 框架)
- **路由 & 控制器**：`koa-router`
- **身份鉴权**：JWT (`jsonwebtoken`) + Header `Authorization` 认证中间件
- **持久化数据库**：`SQLite` (基于 `sql.js` WebAssembly 纯净架构，零 C++ 原生动态库依赖)
  - 数据库文件：`server/serverwatch.db`
  - 内存极速读写 + 异步节流持久化落盘，彻底规避 N-API C++ 动态链接库在各 Linux 发行版（glibc/musl/Debian/CentOS）下的兼容崩溃问题。
  - 表结构：`nodes`（节点元数据与最新快照）与 `node_history`（时序监控历史），自动索引并实现 7 天 (10080点) FIFO 滑动窗口历史归档。
- **配置管理**：`server/config.js`，支持动态端口重载并持久化到本地 `config.json`（首次启动自动生成安全随机密码与动态 32 位 JWT 密钥）
- **打包工具**：`esbuild` + `pkg`（构建输出真正 100% 独立单文件 Linux / Windows 可执行程序）

### 2.2 前端控制台 (`src/`)
- **框架**：React 18 + Vite 5 + React Router v6
- **UI 主题与样式体系**：Tailwind CSS (shadcn/ui 暗黑/明亮双模设计规范) + Lucide-React 图标库
- **图表系统**：Chart.js 4.x + `react-chartjs-2`（详情页展示 CPU、内存/Swap、磁盘 IO、系统负载与网络吞吐 5 大折线图，支持 1h/6h/24h/7d 真实 SQLite 历史回溯与智能降采样）
- **构建工具**：Vite 5 (极速 HMR 与模块化构建)
- **产物目录**：`server/static/` (编译后直接内嵌至服务端单文件程序中)

### 2.3 客户端 Agent 探针 (`server/shell/`)
- **`install.sh`**：一键安装脚本（创建专属禁止登录 `monitor` 用户，限制在沙箱 `crontab` 中运行）。
- **`agent.sh`**：定时探针脚本。采集系统 uptime、会话数、进程列表、句柄数、系统内核/架构、CPU/内存/Swap/磁盘/连接数/网卡流量及 CPU/IO Load，Base64 编码后 POST 上报服务端。
- **`uninstall.sh`**：一键卸载脚本。清理 `/home/monitor/.serverwatch` 目录及 crontab 定时任务，并触发服务端节点标记离线。

---

## 3. 目录结构说明 (Directory Structure)

```text
ServerWatch/
├── LICENSE
├── README.md
├── project.md                    # 本文档：项目全景架构、接口规范与演进日志
├── assets/                       # 媒体与演示资产 (demo.mp4)
├── server/                       # 服务端代码 (Koa2 + WebAssembly SQLite)
│   ├── app.js                    # 服务端主入口，加载中间件与路由
│   ├── config.js                 # 系统全局配置（端口、账号密码管理）
│   ├── serverwatch.db            # SQLite 持久化数据库
│   ├── package.json              # 后端依赖与打包脚本
���   ├── static_assets.js          # 内嵌静态前端与 WASM 二进制映射文件
│   ├── build_assets.js           # 静态资产打包与 LF 换行符清洗脚本
│   ├── controllers/              # 业务控制器
│   │   ├── account.js            # 账号与登录管理、系统全局设置 (防爆破)
│   │   ├── client.js             # 探针安装、卸载、探针脚本下发、数据上报与嗅探推送分流
│   │   ├── discover.js           # 自动发现中心 (嗅探列表/认领/忽略/密钥重置)
│   │   ├── home.js               # 首页及 SPA 客户端路由托管处理
│   │   └── node.js               # 探针节点增删改查及快照/历史数据管理
│   ├── middleware/               # 中间件 (JWT 鉴权 koa-auth)
│   ├── models/                   # 数据持久化模型
│   │   ├── account.js            # 账号模型
│   │   └── node.js               # 基于 SQLite 的节点与指标历史模型
│   ├── routers/                  # 路由定义
│   │   ├── api.js                # 管理后台 API (/api/nodes, /api/node/*, /api/setting)
│   │   ├── client.js             # 客户端通信路由 (/client/install, /client/agent, /client/update 等)
│   │   ├── home.js               # SPA 静态路由分发
│   │   ├── index.js              # 路由��总与鉴权拦截
│   │   └── signin.js             # 登录路由
│   ├── shell/                    # 探针客户端 Shell 脚本模板
│   │   ├── agent.sh              # 性能指标采集与上报脚本 (monitor 权限沙箱，支持嗅探/托管双通道)
│   │   ├── install.sh            # 客户端自动化安装脚本 (创建 monitor 用户)
│   │   └── uninstall.sh          # 客户端清理卸载脚本
│   └── utils/                    # 工具类库 (service.js 服务管理, ssl.js 证书自动化)
└── src/                          # 前端控制台源码 (React 18 + Vite + Tailwind + shadcn/ui)
    ├── index.html                # SPA 入口 HTML 模板
    ├── vite.config.js            # Vite 构建与开发代理配置
    ├── tailwind.config.js        # Tailwind CSS 与 shadcn 调色板
    ├── package.json              # 前端现代化依赖
    └── src/
        ├── main.jsx              # React 根挂载入口
        ├── App.jsx               # 路由表配置与鉴权守卫
        ├── index.css             # 全局暗黑/明亮双模样式体系与 Tailwind 指令
        ├── components/           # 布局与通用组件 (Layout, CountryFlag 等)
        ├── lib/                  # 工具库 (Axios 拦截器、字节与时间格式化)
        └── pages/                # 页面组件
            ├── ServerList.jsx    # 节点监控看板 (网格/表格切换、模糊搜索、CPU/内存/磁盘三维进度条、国旗、快捷编辑)
            ├── ServerDetail.jsx  # 单机详情监控 (1h/6h/24h/7d 历史折线图、硬件概况、活跃进程快照、一键对接)
            ├── ServerCreate.jsx  # 添加监控节点
            ├── ServerEdit.jsx    # 修改节点策略
            ├── ServerRemove.jsx  # 移除与卸载节点
            ├── Discover.jsx      # 自动发现中心 (嗅探接入配置、待认领列表、认领弹窗)
            ├── Setting.jsx       # 系统账户、访客模式与端口配置
            └── SignIn.jsx        # 管理员登录界面
```

---

## 4. 通信流程与核心接口 (Architecture & API)

### 4.1 节点接入生命周期
1. **创建节点**：在 Web 端点击创建，后端生成唯一 `id` (使用 `shortid`)，生成专属安装指令：
   ```bash
   wget --no-check-certificate -qO- http://<HOST>:<PORT>/client/install/<TOKEN> | bash
   ```
2. **自动化安装与安全沙箱**：
   - 目标机执行 `install.sh`，自动创建 `monitor` 独立用户 (`/usr/sbin/nologin`)。
   - 探针脚本安装至 `/home/monitor/.serverwatch` 并配置 `crontab -u monitor` 调度周期���
3. **指标定时采集与上报**：
   - `cron` 触发 `agent.sh` 读取 `/proc`、`sysfs` 及 `ss`/`ip` 命令数据。
   - 数据通过 Base64 编码打包，POST 发送到服务端 `/client/update`。
4. **状态与历史存储**：
   - 服务端解析指标并更新最新 `snapshot`。
   - 默认开启历史入库，每 60 秒将快照写入 SQLite `node_history` 表（最多保留 10080 条，即完整 7 天数据）。

### 4.2 核心管理接口
- `POST /api/signin`：用户登录获取 JWT Token (集成 IP 防暴力破解机制)。
- `GET /api/info`：获取系统公开信息（访客模式开启状态）。
- `GET /api/nodes`：获取节点列表（访客自动脱敏，管理员展示完整数据）。
- `GET /api/node/:id`：获取节点详细信息及时序历史（支持 range=1h/6h/24h/7d 参数）。
- `GET /api/node/:id/latest`：获取最新实时快照。
- `POST /api/node/create`：创建新监控节点。
- `POST /api/node/:id`：更新节点配置。
- `POST /api/node/:id/remove`：彻底删除节点。
- `GET /client/remove/:id`：探针卸载安全标记离线。
- `POST /client/push/:key`（别名 `POST /api/server/push/:key`）：嗅探推送通道，凭全局嗅探密钥免 Token 上报，服务端按源 IP 自动归档分流。
- `GET /api/discover`：自动发现中心总览（嗅探密钥、接入地址、批量安装命令、待认领节点列表）。
- `POST /api/discover/claim`：认领待发现节点（设置名称/位置/采样参数，可选 sync_token 自动同步专属密钥）。
- `POST /api/discover/remove`：忽略待认领的嗅探节点。
- `POST /api/discover/ban`：封禁来源 IP (移除其待认领节点并禁止嗅探通道再接入)。
- `POST /api/discover/unban`：解除 IP 封禁。
- `POST /api/discover/regenerate`：重置嗅探密钥（旧密钥立即失效）。
- `GET /api/setting` / `POST /api/setting`：系统账号、密码、访客模式开关与运行端口配置。

### 4.3 自动发现 (嗅探接入) 工作流
1. **批量部署**：管理员在「自动发现中心」复制嗅探安装命令，批量在任意多台服务器执行（无需预先创建节点）。
2. **免 Token 推送**：探针以 `DISCOVER <嗅探密钥>` 模式运行，定时将指标 POST 至 `/client/push/<key>`。
3. **IP 归档分流**：服务端按源 IP（socket 直连优先，反代场景采信 X-Forwarded-For）匹配：
   - 全新 IP → 自动登记为「待认领」嗅探节点（仅保留实时快照，不写历史）；
   - 已待认领 → 刷新快照与在线状态；
   - 已认领 (`push_source=1`) → 完整入库并按 `record_interval` 归档时序。
4. **认领与密钥同步**：认领时若开启 `sync_token`，推送响应将下发正式专属 Token（`TOKEN <id>`），探针自动原子换写本地 token.log 并无缝切换到 `/client/update` 托管通道；若不开启，则保持纯推送分流模式。
5. **密钥轮换**：支持随时重置嗅探密钥，旧密钥立即失效，需重新部署探针。
6. **生命周期与防滥用**：待认领嗅探节点仅保留 7 天 (服务端每 10 分钟巡检一次)，超时未认领自动清理，并自动封禁其来源 IP (banned_ips 表持久化)；管理员可手动封禁/解封，封禁 IP 的嗅探安装、脚本下发与推送上报全部返回 403。

---

## 5. 快速启动与部署指南 (Deployment)

### 5.1 服务端命令行运维管理 (CLI ��制)
单文件程序内置完整的守护进程与 systemd 服务生命周期管理工具，支持以下常用运维指令：

```bash
# 赋予执行权限
chmod +x serverwatch-linux

# 1. 启动服务 (后台运行)
./serverwatch-linux start

# 2. 停止服务
./serverwatch-linux stop

# 3. 重启服务
./serverwatch-linux restart

# 4. 查看当前运行状态与进程 PID
./serverwatch-linux status

# 5. 安装并开启开机自启 (systemd enabled)
./serverwatch-linux enable

# 6. 关闭开机自启
./serverwatch-linux disable

# 7. 一键签发 Let's Encrypt 域名 SSL 并启用 HTTPS 访问
./serverwatch-linux ssl <your-domain.com> start

# 8. 前台直接运行 (用于调试或 Docker/Systemd 容器环境)
./serverwatch-linux run
```

---

## 6. 项目演进与修改记录 (Changelog)

- **2026-08-29 ~ 2026-08-30 (全栈重构与企业级增强演进)**：
  1. **前端 UI 重构**：全量升级为 React 18 + Vite + Tailwind CSS + shadcn/ui 风格，支持深色/浅色一键切换。
  2. **100+ 节点极限性能优化**：移除数百个 Canvas 实例，升级为纯 CSS 硬件加速指标进度条（CPU/内存/磁盘）。
  3. **SQLite 存储升级**：重构为纯净 WebAssembly SQLite (`sql.js`)，零 C++ 动态库依赖，支持 7 天历史时序自动入库。
  4. **时序历史多时间跨度查看**：单机详情页支持 1小时 / 6小时 / 24小时 / 7天 灵活切换，支持前端智能降采样。
  5. **服务运维与自启控制 (CLI)**：单文件程序支持 `start` / `stop` / `restart` / `status` / `enable` / `disable`，自动化管理 systemd 服务与开机自启动。
  6. **安全与防滥用加固**：路由公开展示序号与底层对接 Token 全链路解耦；访客模式隐藏未安装节点与安装命令，敏感 IP 掩码脱敏，隐藏活跃进程；首次启动随机生成强密码与动态 32 位 JWT 密钥；登录接口 IP 防爆破锁机制。
  7. **自动化 Let's Encrypt SSL 与域名 HTTPS**：支持 `./serverwatch-linux ssl <domain> start` 自动化 DNS 预校验、ECC 证书签发、51221 端口 HTTPS 切换与 60 天自动续期。
  8. **安全沙箱隔离探针**：探针安装逻辑升级为自动创建禁止登录独立用户 `monitor` (`nologin`)，探针与数据上报限制在独立沙箱 crontab 运行。
  9. **多平台单文件二进制发布**：成功构建并发布 Linux x64 (`serverwatch-linux`)、Linux ARM64 (`serverwatch-linux-arm64`) 与 Windows x64 (`serverwatch-win-x64.exe`)。
  10. **高清演示视频入库与发布**：将系统演示视频集成至 `assets/demo.mp4`，在 `README.md` 中嵌入展���，并发布至 GitHub Release v2.0.6 资产列表。
  11. **自动发现中心 (零接触嗅探接入)**：新增全局嗅探密钥与 `/client/push/:key` 免 Token 推送通道；批量执行一条安装命令即可让任意多台服务器按源 IP 自动归档到发现列表；支持认领设置参数、可选专属密钥自动同步（探针自动换发 Token 无缝切换托管通道）或纯推送 IP 分流模式；agent.sh 升级为嗅探/托管双通道架构并采集主机名；管理员侧提供发现列表、认领弹窗、忽略与密钥重置；端到端联调 38 项断言全部通过。
  12. **嗅探节点生命周期与来源 IP 封禁**：待认领服务器 7 天无人认领自动消失并封禁来源 IP；新增 banned_ips 持久化封禁体系、手动封禁/解封接口与管理端封禁列表卡片，嗅探安装/脚本下发/推送三通道全量拦截封禁 IP；巡检幂等且不影响已认领节点。
  13. **SPA 通配路由与深层页面直接刷新修复**：后端 Koa 显式注册 `/discover` 并新增通配正则兜底 `^(?!/(api|client)/).*$`，彻底解决未匹配前端深层路由在浏览器直接刷新 (F5) 时报 404 Not Found 的问题。
  14. **详情页 28x 加速与 shadcn 脉冲骨架屏**：服务端重构 `getNodeById(id, range)`，利用 `(node_id, timestamp)` 联合索引仅检索对应时间窗口记录；时序指标智能裁剪，剥离冗余大字段，传输体积从 10MB 压缩至 30KB；前端引入 shadcn/ui 脉冲微光骨架屏 (Skeleton)，消除居中转圈，首屏感知耗时降至 0.1s。
  15. **探针跨平台兼容性与账号永不过期加固**：探针保留系统原有 `$PATH`，解决特殊/精简环境下工具链寻址遗漏；`/proc/stat` 加入数组越界默认值容错；安装脚本显式配置 `chage -E -1 -M 99999 monitor` 确保账号永不过期；修复 crontab 间隔生成时第 12 行缺少分号的语法问题。
  16. **CLI 守护进程与 Systemd 模块寻址修复**：解决 `pkg` 单文件二进制在 `spawn` 守护进程时因解析 `run` 参数导致 `Cannot find module '/root/run'` 的报错，统一传递 Node.js 原生内置 `__filename` 虚拟快照绝对路径，并在 `app.js` 中规范化参数路由。
  17. **自动化部署流水线建立**：固化每次代码提交自动执行全平台构建 -> GitHub 仓库推送 -> Release 资产热更新 -> 远程服务器 (`/root/monitor`) SSH 自动化部署与 Systemd 重启全流程。
