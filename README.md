# ServerWatch ⚡

> **现代化、高性能、企业级分布式服务器实时监控与云探针系统**  
> 基于 **React 18 + Vite + Tailwind CSS + shadcn/ui** 现代控制台与 **WebAssembly SQLite 纯净内嵌存储**，支持单文件二进制一键部署与极速运维（支持 Linux x64、Linux ARM64 及 Windows x64 多平台）。

---

## 🎬 效果演示 (Live Demo)

https://github.com/4kercc/ServerWatch/raw/master/assets/demo.mp4

> 💡 **演示视频**：可以在上方直接播放，或 [点击此处直接下载/观看完整高清演示视频 (assets/demo.mp4)](assets/demo.mp4)。

---

## 🌟 核心特性 (Key Features)

- 🎨 **现代化 shadcn/ui 控制台**：
  - 采用现代扁平/暗黑风格设计，提供丝滑的 Dark/Light 双模沉浸式主题切换。
  - 支持 **网格卡片 (Grid View)** 与 **精简表格 (Table View)** 双重视图模式自由切换。
  - **极速响应**：彻底淘汰列表页数百个 Canvas 实例，升级为纯 CSS 硬件加速指标进度条（CPU / 内存 / 磁盘三维并行展示），轻松承载 **100+ 台服务器集群** 极速流畅渲染。

- ⚡ **零 C++ 依赖 · WebAssembly SQLite 存储引擎**：
  - 采用 `sql.js` (Pure WebAssembly SQLite)，彻底摆脱原生 C++ 动态链接库编译困扰，100% 兼容各类 Linux 发行版（Debian / Ubuntu / CentOS / Alpine 等）及 Windows 平台。
  - 内存微秒级极速读写 + 异步节流持久化落盘，杜绝高并发上报下的 I/O 阻塞风险。
  - 内置 24 小时（1440 个采样点）与 7 天（10080 个采样点）时序历史自动归档及 FIFO 滑动窗口清理。

- 🛡️ **安全脱敏与隐私保护体系**：
  - **后台自由控制访客模式 (Guest Mode)**：管理员可在系统设置中一键开启/关闭访客模式；关闭后未授权访问自动拦截重定向至登录页。
  - **访客数据脱敏**：开启访客模式时，自动掩码脱敏 IP 地址（如 `23.95.*.*`）、隐藏服务器底层活跃进程快照、隐藏未安装节点与安装指令。
  - **展示路由与通信密钥解耦**：前端使用直观简短的数字序号（如 `/server/1`），底层高强度探针对接 Token 严格隔离，防止接口嗅探与恶意数据污染。
  - **防暴力破解与动态 JWT 密钥**：首次启动自动随机生成 8 位管理员密码与 32 位独立 JWT 密钥，登录接口集成连续 5 次错误封禁 15 分钟防护。

- 🛰️ **自动发现中心 (零接触嗅探接入)**：
  - 无需预先创建节点：在后台「自动发现中心」复制一条嗅探安装命令，**批量在任意多台服务器执行**，所有服务器将自动按 **源 IP** 归档出现在发现列表。
  - **认领制纳管**：逐台设置名称/位置/采集参数后一键认领；可选「自动同步专属密钥」—— 探针在下次上报时自动收到专属 Token 并**无缝切换**到托管通道（零中断、无需重装）。
  - **纯推送分流模式**：也可以选择不同步密钥，服务器保持推送模式，数据每次按 IP 自动分流入库。
  - **生命周期与防滥用**：待认领服务器超过 **7 天无人认领将自动消失，并自动封禁其来源 IP**（无法再通过嗅探通道注册/上报）；同时支持手动封禁与一键解封。
  - 支持一键重置嗅探密钥（旧密钥立即失效），安装阶段自动回填地理位置与运营商信息。

- 🔔 **机器上线 / 下线告警通知 (Telegram & SMTP)**：
  - **智能防抖与状态机**：支持自定义连续检测失败次数阈值、累计断线时长阈值（如持续断线 100 秒才触发）及告警静默防刷屏冷却时间（如 1440 分钟），杜绝瞬时网络波动引起的误报与频繁骚扰。
  - **Telegram 机器人即时推送**：支持配置 Bot Token 与 Chat ID（频道/群组/个人），内置「发送测试消息」实时验证。
  - **SMTP 邮件告警**：支持 QQ 邮箱、Office365、企业邮箱等标准 SMTP SSL/TLS 发信，支持多邮箱逗号分割批量接收，内置「发送测试邮件」功能。
  - **恢复通知**：机器恢复连通后自动发送绿色上线恢复通知，报告累计离线时长。

- 🔒 **一键 Let's Encrypt 域名 SSL 自动化管理**：
  - 支持 CLI 一键签发 ECC 高性能 SSL 证书（如 `./serverwatch-linux ssl mx.mk start`），自动校验 DNS 解析、自动切换 51221 端口 HTTPS 并配置 60 天静默自动续期。

- 📈 **多维度时序图表与时间跨度分析**：
  - 单机详情页支持 **1小时 / 6小时 / 24小时 / 7天** 自由切换，集成智能降采样平滑渲染。
  - 实时与历史并存：涵盖 CPU 负载、内存/Swap 占��、磁盘 I/O 活跃度、系统平均负载（1/5/15m）及出入网带宽吞吐（RX/TX）。

- 🌍 **智能矢量国旗解析 (CountryFlag SVG)**：
  - 内置矢量 SVG 高清国旗解析渲染，自动识别全球主流云服务器节点所在地（中国 🇨🇳、香港 🇭🇰、台湾 🇹🇼、美国 🇺🇸、日本 🇯🇵、新加坡 🇸🇬、德国 🇩🇪、英国 🇬🇧 等），彻底解决不同操作系统/浏览器 Emoji 字符缺失或乱码问题。

- 🚀 **All-in-One 单文件可执行程序 & 内置服务管理**：
  - 前端静态资源、WASM 二进制与 Shell 探针脚本全部内嵌至单一可执行文件，开箱即用。
  - 提供 **Linux x64 (`serverwatch-linux`)**、**Linux ARM64 (`serverwatch-linux-arm64`)** 与 **Windows x64 (`serverwatch-win-x64.exe`)** 多平台单文件程序。

---

## 📦 快速安装与运行 (Quick Start)

### 🐧 Linux (x64 / ARM64) 部署指南

#### 1. 下载单文件二进制程序
从 [Releases 页面](https://github.com/4kercc/ServerWatch/releases) 下载适合当前系统架构的单文件执行程序：

```bash
# 【Linux x64 (AMD64)】下载
wget -O serverwatch-linux https://github.com/4kercc/ServerWatch/releases/latest/download/serverwatch-linux

# 【Linux ARM64 (aarch64)】下载
wget -O serverwatch-linux https://github.com/4kercc/ServerWatch/releases/latest/download/serverwatch-linux-arm64

# 赋予执行权限
chmod +x serverwatch-linux
```

#### 2. 服务运维与一键 Let's Encrypt SSL 配置

`serverwatch-linux` 内置了完整的服务生命周期、systemd 守护进程与 **Let's Encrypt 域名 SSL 自动化签发/续期** 功能：

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

# 一键自动化配置域名 SSL 证书 (自动验证 DNS 解析、签发 ECC 证书、开启 HTTPS、配置 60 天自动续期并启动)
./serverwatch-linux ssl <your-domain.com> start
# 例如：./serverwatch-linux ssl mx.mk start

# 关闭开机自启
./serverwatch-linux disable

# 前台直接运行 (适用于 Docker 容器或临时调试)
./serverwatch-linux run
```

---

### 🪟 Windows (x64) 部署指南

1. 从 [Releases 页面](https://github.com/4kercc/ServerWatch/releases) 下载 **`serverwatch-win-x64.exe`**；
2. 直接双击运行，或在 PowerShell / CMD 中启动：
   ```cmd
   serverwatch-win-x64.exe
   ```
3. 浏览器访问：`http://localhost:51221` 即可开始使用。

---

### 🔑 访问控制台
- 浏览器打开：`http://<你的服务器IP>:51221`（若配置了 SSL 则为 `https://<你的域名>:51221`）
- 默认管理员账号：`admin`
- 首次启动随机密码可在控制台输出或当前目录下的 `config.json` 中查看。

---

## 💻 客户端探针接入 (Agent Integration)

ServerWatch 客户端探针为纯原生 Linux Shell 脚本，**无需在被控机上安装 Python、Node 或复杂守护进程**，仅依赖系统内置的 `bash`、`cron` 与 `/proc` 文件系统。

1. 进入 ServerWatch 控制台，点击 **【新建节点】**。
2. 复制生成的专属一键安装命令并在目标 Linux 服务器（支持 CentOS、Debian、Ubuntu、Arch 等）上以 `root` 权限执行：
   ```bash
   wget --no-check-certificate -qO- https://<监控端地址>:51221/client/install/<TOKEN> | bash
   ```
3. **安全隔离机制**：安装脚本将自动创建禁止交互式登录的系统独立用户 `monitor`（`nologin`），并将探针与数据上报限制在 `monitor` 用户独立的 `crontab` 权限沙箱中运行，兼顾一键部署体验与极高系统安全性。
4. 执行成功后，控制台将在数秒内显示该节点上线。

---

### 🛰️ 批量零接触接入 (自动发现模式)

如果需要一次性接入**大量服务器**而不想逐台创建节点，请登录后台进入 **【自动发现中心】**：

1. 复制页面提供的嗅探批量安装命令（形如下方示例），在任意多台目标服务器上以 `root` 执行：
   ```bash
   wget --no-check-certificate -qO- http://<监控端地址>:51221/client/install/<嗅探密钥> | bash
   ```
2. 所有执行过命令的服务器将**自动按源 IP 归档**出现在「自动发现中心」列表中，实时显示主机名、操作系统、CPU/内存与推送状态；
3. 点击 **【认领】** 设置节点名称、地理位置与采集参数：
   - **自动同步专属密钥（推荐）**：探针下次上报时自动接收专属 Token，无缝切换为正式托管通道，全程零中断；
   - **不同步密钥**：服务器保持推送模式，后续数据持续按 IP 自动分流到对应节点入库。
4. **生命周期与防滥用**：待认领服务器超过 **7 天无人认领将自动消失并封禁其来源 IP**；也可对任意待认领节点手动封禁，误封可在「封禁 IP 列表」中一键解除；
5. 如需更换接入凭据，可在页面中一键重置嗅探密钥（旧密钥立即失效）。

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

# 打包全平台单文件二进制
node build_assets.js  # 编译内嵌静态资产
npx esbuild app.js --bundle --platform=node --target=node18 --outfile=bundle.cjs --external:sql.js --external:jsonwebtoken --external:bcryptjs
npx pkg bundle.cjs --target node18-linux-x64 --output serverwatch-linux                         # Linux x64 单文件
npx pkg bundle.cjs --target node18-linux-arm64 --no-bytecode --output serverwatch-linux-arm64 # Linux ARM64 (aarch64) 单文件
npx pkg bundle.cjs --target node18-win-x64 --output serverwatch-win-x64.exe                    # Windows x64 单文件
```

---

## 📄 开源协议 (License)

本项目基于 [MIT License](LICENSE) 协议开源。
