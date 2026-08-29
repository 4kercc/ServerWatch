# ServerWatch ⚡

> **现代化、高性能、企业级分布式服务器实时监控与云探针系统**  
> 基于 **React 18 + Vite + Tailwind CSS + shadcn/ui** 现代控制台与 **WebAssembly SQLite 纯净内嵌存储**，支持单文件二进制一键部署与极速运维。

---

## 🌟 核心特性 (Key Features)

- 🎨 **现代化 shadcn/ui 控制台**：
  - 采用现代扁平/暗黑风格设计，提供丝滑的 Dark/Light 双模沉浸式主题切换。
  - 支持 **网格卡片 (Grid View)** 与 **精简表格 (Table View)** 双重视图模式自由切换。
  - **极速响应**：彻底淘汰列表页数百个 Canvas 实例，升级为纯 CSS 硬件加速指标进度条（CPU / 内存 / 磁盘三维并行展示），轻松承载 **100+ 台服务器集群** 极速流畅渲染。

- ⚡ **零 C++ 依赖 · WebAssembly SQLite 存储引擎**：
  - 采用 `sql.js` (Pure WebAssembly SQLite)，彻底摆脱原生 C++ 动态链接库编译困扰，100% 兼容各类 Linux 发行版（Debian / Ubuntu / CentOS / Alpine 等）。
  - 内存微秒级极速读写 + 异步节流持久化落盘，杜绝高并发上报下的 I/O 阻塞风险。
  - 内置 24 小时（1440 个采样点）与 7 天（10080 个采样点）时序历史自动归档及 FIFO 滑动窗口清理。

- 🛡️ **安全脱敏与隐私保护体系**：
  - **访客模式 (Guest Mode)**：公开访问时自动掩码脱敏 IP 地址（如 `23.95.*.*`）、隐藏服务器底层活跃进程快照、隐藏未安装节点与安装指令。
  - **展示路由与通信密钥解耦**：前端使用直观简短的数字序号（如 `/server/1`），底层高强度探针对接 Token 严格隔离，防止接口嗅探与恶意数据污染。
  - **初次启动安全凭证**：首次启动自动随机生成 8 位高强度管理员密码并持久化保存。

- 📈 **多维度时序图��与时间跨度分析**：
  - 单机详情页支持 **1小时 / 6小时 / 24小时 / 7天** 自由切换，集成智能降采样平滑渲染。
  - 实时与历史并存：涵盖 CPU 负载、内存/Swap 占用、磁盘 I/O 活跃度、系统平均负载（1/5/15m）及出入网带宽吞吐（RX/TX）。

- 🌍 **智能矢量国旗解析 (CountryFlag SVG)**：
  - 内置矢量 SVG 高清国旗解析渲染，自动识别全球主流云服务器节点所在地（中国 🇨🇳、香港 🇭🇰、台湾 🇹🇼、美国 🇺🇸、日本 🇯🇵、新加坡 🇸🇬、德国 🇩🇪、英国 🇬🇧 等），彻底解决不同操作系统/浏览器 Emoji 字符缺失或乱码问题。

- 🚀 **All-in-One 单文件可执行程序 & 内置服务管理**：
  - 前端静态资源、WASM 二进制与 Shell 探针脚本全部内嵌至单一可执行文件 `serverwatch-linux`。
  - 内置 CLI 服务管理，一键配置 `systemd` 开机自启与后台守护进程。

---

## 📦 快速安装与运行 (Quick Start)

### 1. 下载单文件二进制程序
从 [Releases 页面](https://github.com/4kercc/ServerWatch/releases) 下载最新的 `serverwatch-linux` 单文件执行程序：

```bash
# 下载可执行文件
wget https://github.com/4kercc/ServerWatch/releases/latest/download/serverwatch-linux

# 赋予执行权限
chmod +x serverwatch-linux
```

### 2. 服务运维与开机自启命令

`serverwatch-linux` 内置了完整的服务与 systemd 生命周期管理：

```bash
# 启动后台服务
./serverwatch-linux start

# 开启开机自启 (自动注册为系统 systemd 服务)
./serverwatch-linux enable

# 查看当前运行状态、进程 PID 与实时日志
./serverwatch-linux status

# 重启服务
./serverwatch-linux restart

# 停止服务
./serverwatch-linux stop

# 关闭开机自启
./serverwatch-linux disable

# 前台直接运行 (适用于 Docker 容器或临时调试)
./serverwatch-linux run
```

### 3. 访问控制台
- 浏览器打开：`http://<你的服务器IP>:51221`
- 默认管理员账号：`admin`
- 首次启动随机密码可在终端控制台输出或当前目录下的 `config.json` 中查看。

---

## 💻 客户端探针接入 (Agent Integration)

ServerWatch 客户端探针为纯原生 Linux Shell 脚本，**无需在被控机上安装 Python、Node 或复杂守护进程**，仅依赖系统内置的 `bash`、`cron` 与 `/proc` 文件系统。

1. 进入 ServerWatch 控制台，点击 **【新建节点】**。
2. 复制生成的专属一键安装命令并在目标 Linux 服务器（支持 CentOS、Debian、Ubuntu、Arch 等）上以 `root` 权限执行：
   ```bash
   wget --no-check-certificate -qO- http://<监控端地址>:51221/client/install/<TOKEN> | bash
   ```
3. **安全隔离机制**：安装���本将自动创建禁止交互式登录的系统独立用户 `monitor`（`nologin`），并将探针与数据上报限制在 `monitor` 用户独立的 `crontab` 权限沙箱中运行，兼顾一键部署体验与极高系统安全性。
4. 执行成功后，控制台将在数秒内显示该节点上线。

---

## 🛠️ 本地开发与二次构建 (Development)

### 前端开发 (`src/`)
```bash
cd src
npm install
npm run dev     # 启动 Vite 开发服务器 (默认端口 3000，代理后端 51221)
npm run build   # 编译构建前端静态资源至 server/static
```

### 后端开发与打包 (`server/`)
```bash
cd server
npm install
node app.js     # 启动本地开发服务

# 打包单文件二进制
node build_assets.js  # 编译内嵌静态资产
npx esbuild app.js --bundle --platform=node --target=node18 --outfile=bundle.cjs --external:sql.js --external:jsonwebtoken --external:bcryptjs
npx pkg bundle.cjs --target node18-linux-x64 --output serverwatch-linux
```

---

## 📄 开源协议 (License)

本项目基于 [MIT License](LICENSE) 协议开源。
