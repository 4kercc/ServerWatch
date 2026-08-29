# ServerWatch 项目全景文档

> 本文档用于记录 **ServerWatch**（云探针/分布式服务器状态监控系统）的整体架构、模块分工、通信协议、部署运维及后续开发记录，方便项目维护、交接与无缝迁移。

---

## 1. 项目简介 (Overview)
- **项目名称**：ServerWatch
- **定位**：企业级高并发云探针与多服务器性能状态监控面板。
- **架构模式**：B/S 管理端 + Agent 客户端轻量汇报模型。
- **主要特性**：
  - **前后端分离**：现代化 React 18 + Vite + Tailwind CSS + shadcn/ui 控制台 + 后端 Node.js (Koa2) + 客户端 Shell 自动化探针脚本。
  - **无依赖 Agent**：客户端仅依赖 Linux 原生命令（`bash`, `cron`, `curl`/`wget`, `procfs`），零侵入、无额外重量级守护进程。
  - **纯净 WebAssembly SQLite 存储**：服务端采用 `sql.js` (WebAssembly SQLite)，零 C++ 原生库依赖，彻底杜绝各 Linux 发行版下的符号兼容崩溃问题，并实现微秒级读写与异步节流落盘。
  - **高性能前端看板**：列表页采用轻量 CSS 进度条（CPU/内存/磁盘三维呈现），消除数百个 Canvas 实例开销；支持明暗主题切换、国旗归属地展示、访客脱敏模式与快捷编辑模式。
  - **静态单二进制打包**：支持通过 `pkg` 编译为单一可执行文件（Linux x64 / Win x64），单文件内嵌全套前端产物、Shell 探针与 SQLite WASM 二进制。

---

## 2. 技术栈架构 (Tech Stack)

### 2.1 后端服务 (`server/`)
- **运行环境**：Node.js (Koa2 框架)
- **路由 & 控制器**：`koa-router`
- **身份鉴权**：JWT (`jsonwebtoken`) + Header `Authorization` 认证中间件
- **持久化数据库**：`SQLite` (基于 `sql.js` WebAssembly 纯净架构，零 C++ 原生动态库依赖)
  - 数据库文件：`server/serverwatch.db`
  - 内存极速读写 + 异步节流持久化落盘，彻底规避 N-API C++ 动态链���库在各 Linux 发行版（glibc/musl/Debian/CentOS）下的兼容崩溃问题。
  - 表结构：`nodes`（节点元数据与最新快照）与 `node_history`（时序监控历史），自动索引并实现 24 小时 (1440点) FIFO 滑动窗口历史归档。
- **配置管理**：`server/config.js`，支持动态端口重载并持久化到本地 `config.json`（首次启动自动生成安全随机密码）
- **打包工具**：`esbuild` + `pkg`（构建输出真正 100% 独立单文件 Linux 可执行程序）

### 2.2 前端控制台 (`src/`)
- **框架**：React 18 + Vite 5 + React Router v6
- **UI 主题与样式体系**：Tailwind CSS (shadcn/ui 暗黑/明亮双模设计规范) + Lucide-React 图标库
- **图表系统**：Chart.js 4.x + `react-chartjs-2`（详情页展示 CPU、内存/Swap、磁盘 IO、系统负载与网络吞吐 5 大折线图，支持 24 小时真实 SQLite 历史回溯）
- **构建工具**：Vite 5 (极速 HMR 与模块化构建)
- **产物目录**：`src/build/` (编译后直接内嵌至服务端单文件程序中)

### 2.3 客户端 Agent 探针 (`server/shell/`)
- **`install.sh`**：一键安装脚本（已清洗版权与 Windows 换行符）。检测包管理器(`apt`/`yum`/`pacman`)并安装 `cron`/`curl`，从服务端获取探针脚本及初始位置信息并写入系统 `crontab` 调度。
- **`agent.sh`**：定时探针脚本。采集系统 uptime、会话数、进程列表、句柄数、系统内核/架构、CPU/内存/Swap/磁盘/连接数/网卡流量及 CPU/IO Load，Base64 编码后 POST 上报服务端。
- **`uninstall.sh`**：一键卸载脚本。清理 `/etc/serverwatch` 目录及 crontab 定时任务，并触发服务端节点移除。

---

## 3. 目录结构说明 (Directory Structure)

```text
ServerWatch/
├── LICENSE
├── README.md
├── project.md                    # 本文档：项目全景架构、接口规范与演进日志
├── server/                       # 服务端代码 (Koa2 + WebAssembly SQLite)
│   ├── app.js                    # 服务端主入口，加载中间件与路由
│   ├── config.js                 # 系统全局配置（端口、账号密码管理）
│   ├── serverwatch.db            # SQLite 持久化数据库
│   ├── package.json              # 后端依赖与打包脚本
│   ├── static_assets.js          # 内嵌静态前端与 WASM 二进制映射文件
│   ├── build_assets.js           # 静态资产打包与 LF 换行符清洗脚本
│   ├── controllers/              # 业务控制器
│   │   ├── account.js            # 账号与登录管理、系统全局设置
│   │   ├── client.js             # 探针安装、卸载、探针脚本下发及数据上报
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
│   │   ├── index.js              # 路由汇总与鉴权拦截
│   │   └── signin.js             # 登录路由
│   ├── shell/                    # 探针客户端 Shell 脚本模板
│   │   ├── agent.sh              # 性能指标采集与上报脚本
│   │   ├── install.sh            # 客户端自动化安装脚本
│   ��   └── uninstall.sh          # 客户端清理卸载脚本
│   └── utils/                    # 工具类库（SQLite 连接、Base64 处理、格式化工具等）
└── src/                          # 前端控制台源码 (React 18 + Vite + Tailwind + shadcn/ui)
    ├── index.html                # SPA 入口 HTML 模板
    ├── vite.config.js            # Vite 构建与开发代理配置
    ├── tailwind.config.js        # Tailwind CSS 与 shadcn 调色板
    ├── package.json              # 前端现代化依赖
    ├── build/                    # 前端构建产物 (由 Vite build 生成供 Koa 托管)
    └── src/
        ├── main.jsx              # React 根挂载入口
        ├── App.jsx               # 路由表配置与鉴权守卫
        ├── index.css             # 全局暗黑/明亮双模样式体系与 Tailwind 指令
        ├── components/           # 布局与通用组件 (Layout 顶栏导航)
        ├── lib/                  # 工具库 (Axios 拦截器、字节与时间格式化、国旗解析)
        └── pages/                # 页面组件
            ├── ServerList.jsx    # 节点监控看板 (网格/表格切换、模糊搜索、CPU/内存/磁盘三维进度条、国旗、快捷编辑)
            ├── ServerDetail.jsx  # 单机详情监控 (24小时历史折线图、硬件概况、活跃进程快照、一键对接)
            ├── ServerCreate.jsx  # 添加监控节点
            ├── ServerEdit.jsx    # 修改节点策略
            ├── ServerRemove.jsx  # 移除与卸载节点
            ├── Setting.jsx       # 系统账户与端口配置
            └── SignIn.jsx        # 管理员登录界面
```

---

## 4. 通信流程与核心接口 (Architecture & API)

### 4.1 节点接入生命周期
1. **创建节点**：在 Web 端点击创建，后端生成唯一 `id` (使用 `shortid`)，生成专属安装指令：
   ```bash
   wget --no-check-certificate -qO- http://<HOST>:<PORT>/client/install/<ID> | bash
   ```
2. **自动化安装**：
   - 目标机执行 `install.sh`，自动配置 `crontab` 调度周期（按设定间隔每 N 秒执行）。
   - 客户端通过 `myip.ipip.net` 查询出口 IP/地理位置/运营商并向服务端注册。
3. **指标定时采集与上报**：
   - `cron` 触发 `agent.sh` 读取 `/proc`、`sysfs` 及 `ss`/`ip` 命令数据。
   - 数据通过 Base64 编码打包，POST 发送到服务端 `/client/update`。
4. **状态与历史存储**：
   - 服务端解析指标并更新最新 `snapshot`。
   - 默认开启历史入库，每 60 秒将快照写入 SQLite `node_history` 表（最多保留 1440 条，即完整 24 小时数据）。

### 4.2 核心管理接口
- `POST /api/signin`：用户登录获取 JWT Token。
- `GET /api/nodes`：获取节点列表（访客自动脱敏，管理员展示完整数据）。
- `GET /api/node/:id`：获取节点详细信息及 24 小时时序历史。
- `GET /api/node/:id/latest`：获取最新实时快照。
- `POST /api/node/create`：创建新监控节点。
- `POST /api/node/:id`：更新节点配置（报警/记录频率等）。
- `POST /api/node/:id/remove` / `GET /api/node/:id/remove`：删除节点。
- `GET /api/setting` / `POST /api/setting`：系统账号、密码与运行端口配置。

---

## 5. 快速启动与部署指南 (Deployment)

### 5.1 服务端命令行运维管理 (CLI 控制)
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

# 7. 前台直接运行 (用于调试或 Docker/Systemd 容器环境)
./serverwatch-linux run
```

---

## 6. 项目演进与修改记录 (Changelog)

- **2026-08-29 (架构与功能完整演进)**：
  1. **前端 UI 重构**：全量升级为 React 18 + Vite + Tailwind CSS + shadcn/ui 风格，支持深色/浅色一键切换。
  2. **100+ 节点极限性能优化**：移除数百个 Canvas 实例，升级为纯 CSS 硬件加速指标进度条（CPU/内存/磁盘）。
  3. **SQLite 存储升级**：重构为纯净 WebAssembly SQLite (`sql.js`)，零 C++ 动态库依赖，支持 24 小时历史时序自动入库。
  4. **时序历史多时间跨度查看**：单机详情页支持 1小时 / 6小时 / 24小时 / 7天 灵活切换，支持前端智能降采样。
  5. **服务运维与自启控制 (CLI)**：单文件程序支持 `start` / `stop` / `restart` / `status` / `enable` / `disable`，自动化管理 systemd 服务与开机自启动。
  6. **安全与防滥用加固**：路由公开展示序号与底层对接 Token 全链路解耦；访客模式隐藏未安装节点与安装命令，敏感 IP 掩码脱敏，隐藏活跃进程；首次启动随机生成强密码。
  7. **地理矢量国旗适配**：开���专用 SVG 矢量国旗组件，覆盖全球主流云服务器节点所在地，消除跨端 Emoji 渲染差异。
  8. **一键复制与换行符清洗**：解决非 HTTPS 复制问题，彻底清洗 Shell 脚本 CRLF 换行符。
  9. **远程部署验证**：已完成自动化部署流水线与端到端闭环测试。
