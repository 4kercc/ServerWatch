const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const sslManager = require('./ssl')

const SERVICE_NAME = 'serverwatch'
const SYSTEMD_PATH = `/etc/systemd/system/${SERVICE_NAME}.service`
const PID_FILE = path.resolve(process.cwd(), 'serverwatch.pid')
const LOG_FILE = path.resolve(process.cwd(), 'serverwatch.log')
const CONFIG_PATH = path.resolve(process.cwd(), 'config.json')

function getBinaryPath() {
  return process.execPath || process.argv[0]
}

function getWorkDir() {
  return process.cwd()
}

function hasSystemd() {
  try {
    return fs.existsSync('/run/systemd/system') || fs.existsSync('/etc/systemd/system')
  } catch (e) {
    return false
  }
}

function runCmd(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString()
  } catch (err) {
    return null
  }
}

function isProcessAlive(pid) {
  if (!pid || isNaN(pid)) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return false
  }
}

// 精确获取运行中的 ServerWatch 进程 PID（仅认有效 PID 文件与真实存活进程）
function getPid() {
  if (fs.existsSync(PID_FILE)) {
    try {
      const content = fs.readFileSync(PID_FILE, 'utf8').trim()
      const pid = parseInt(content)
      if (pid && isProcessAlive(pid)) {
        return pid
      } else {
        // 残留的无效 PID 文件自动清理
        try { fs.unlinkSync(PID_FILE) } catch (e) {}
      }
    } catch (e) {}
  }
  return null
}

function getSpawnArgs() {
  // __filename 是 Node.js 内置变量，在 pkg 快照���永远精确指向内嵌的 bundle.cjs 虚拟绝对路径
  return [__filename]
}

function generateSystemdService() {
  const bin = getBinaryPath()
  const workDir = getWorkDir()
  return `[Unit]
Description=ServerWatch Monitor Service
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${workDir}
ExecStart=${bin} ${__filename}
Restart=always
RestartSec=5
KillMode=process
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
`
}

const serviceManager = {
  // 安装/更新 systemd 服务文件
  installSystemd() {
    if (!hasSystemd()) {
      console.log('[-] 当前系统不支持 systemd。')
      return false
    }
    try {
      const content = generateSystemdService()
      fs.writeFileSync(SYSTEMD_PATH, content)
      runCmd('systemctl daemon-reload')
      return true
    } catch (err) {
      console.error('[-] 安装 systemd 服务失败 (请确保具备 root 权限):', err.message)
      return false
    }
  },

  // 启动服务 (优先使用 systemd，若无 systemd 或未 enable 则使用精确后台守护进程)
  start() {
    if (hasSystemd() && fs.existsSync(SYSTEMD_PATH)) {
      console.log('[*] 正在通过 systemd 启动 ServerWatch 服务...')
      runCmd(`systemctl start ${SERVICE_NAME}`)
      this.status()
      return
    }

    const pid = getPid()
    if (pid) {
      console.log(`[!] ServerWatch 服务已在运行中 (PID: ${pid})`)
      return
    }

    console.log('[*] 正在后台启动 ServerWatch 服务...')
    const bin = getBinaryPath()
    const outFd = fs.openSync(LOG_FILE, 'a')
    const spawnArgs = getSpawnArgs()
    
    // 使用 node 真正的后台分离进程启动 (精准传递 pkg 内置虚拟路径，彻底规避 Cannot find module 错误)
    const child = spawn(bin, spawnArgs, {
      cwd: getWorkDir(),
      detached: true,
      stdio: ['ignore', outFd, outFd],
      env: Object.assign({}, process.env, { SERVERWATCH_DAEMON: '1' })
    })
    
    child.unref()

    fs.writeFileSync(PID_FILE, String(child.pid))
    console.log(`[+] ServerWatch 已在后台启动 (PID: ${child.pid})，日志记录于: ${LOG_FILE}`)
  },

  // 停止服务
  stop() {
    if (hasSystemd() && fs.existsSync(SYSTEMD_PATH)) {
      console.log('[*] 正在通过 systemd 停止 ServerWatch 服务...')
      runCmd(`systemctl stop ${SERVICE_NAME}`)
    }

    const pid = getPid()
    if (pid) {
      console.log(`[*] 正在终止进程 (PID: ${pid})...`)
      try {
        process.kill(pid, 'SIGTERM')
      } catch (e) {
        runCmd(`kill -9 ${pid} 2>/dev/null || true`)
      }
    }

    if (fs.existsSync(PID_FILE)) {
      try { fs.unlinkSync(PID_FILE) } catch (e) {}
    }
    console.log('[+] ServerWatch 服务已停止。')
  },

  // 重启服务
  restart() {
    console.log('[*] 正在重启 ServerWatch 服务...')
    this.stop()
    const sleep = ms => {
      const start = Date.now()
      while (Date.now() - start < ms) {}
    }
    sleep(1000)
    this.start()
  },

  // 自动化申请 Let's Encrypt 证书并启动/重启服务
  async handleSsl(domain, action) {
    if (!domain) {
      console.error('[-] 缺少域名参数！格式: ./serverwatch-linux ssl <your-domain.com> [start|restart]')
      return
    }

    // 1. 验证域名 DNS 指向
    const isValid = await sslManager.verifyDomain(domain)
    if (!isValid) {
      console.error(`[-] 域名 [${domain}] 尚未解析到本机 IP，已终止签发。`)
      return
    }

    // 2. 如果当前有服务在运行且可能占用 80 端口，先提示
    console.log('[*] 准备申请并签发 Let\'s Encrypt 免费 SSL 证书...')
    const certResult = await sslManager.issueCert(domain)
    if (!certResult) {
      console.error('[-] SSL 证书配置未完成。')
      return
    }

    // 3. 更新 config.json 开启 ssl 与 domain 配置
    let cfg = {}
    if (fs.existsSync(CONFIG_PATH)) {
      try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) } catch (e) {}
    }
    cfg.domain = domain
    cfg.ssl = true
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2))
    console.log(`[+] 已更新 config.json：开启 SSL HTTPS 模式 (域名: ${domain})`)

    // 4. 执行后续指令 (默认 restart / start)
    if (action === 'start' || !action) {
      console.log('[*] 正在启动 ServerWatch HTTPS 服务...')
      this.enable()
      this.restart()
    } else if (action === 'restart') {
      this.restart()
    }
  },

  // 查看运行状态
  status() {
    console.log('=====================================================')
    console.log(' ServerWatch 服务运行状态')
    console.log('=====================================================')

    if (hasSystemd() && fs.existsSync(SYSTEMD_PATH)) {
      const sysStatus = runCmd(`systemctl status ${SERVICE_NAME} --no-pager || true`)
      if (sysStatus) {
        console.log(sysStatus.trim())
        console.log('=====================================================')
        return
      }
    }

    const pid = getPid()
    if (pid) {
      console.log(` 状态: 运行中 (Active - Running)`)
      console.log(` 进程 PID: ${pid}`)
      console.log(` 工作目录: ${getWorkDir()}`)
      console.log(` 日志文件: ${LOG_FILE}`)
    } else {
      console.log(` 状态: 未运行 (Stopped)`)
    }
    console.log('=====================================================')
  },

  // 设置开机自启
  enable() {
    if (!this.installSystemd()) return
    runCmd(`systemctl enable ${SERVICE_NAME}`)
    console.log('[+] ServerWatch 开机自启已成功开启 (systemd enabled)！')
  },

  // 关闭开机自启
  disable() {
    if (hasSystemd()) {
      runCmd(`systemctl disable ${SERVICE_NAME}`)
      console.log('[+] ServerWatch 开机自启已成功关闭 (systemd disabled)。')
    }
  },

  // 打印帮助菜单
  help() {
    const binName = path.basename(getBinaryPath())
    console.log(`
ServerWatch - 现代服务器集群监控运维服务管理工具

使用格式:
  ./${binName} <command>

常用指令:
  start                     启动 ServerWatch 后台服务
  stop                      停止 ServerWatch 服务
  restart                   重启 ServerWatch 服务
  status                    查看 ServerWatch 服务的运行状态与 PID
  enable                    安装并开启 systemd 开机自启
  disable                   禁用 systemd 开机自启
  ssl <domain> [start]      自动校验域名、签发 Let's Encrypt 证书、开启 HTTPS 并启动
  run                       在前台直接运行 ServerWatch (用于调试/容器/Systemd)
  help                      显示此帮助信息

使用示例:
  ./${binName} ssl mx.mk start   # 自动为 mx.mk 签发证书、配置 HTTPS 与自动续期并后台启动
`)
  }
}

module.exports = serviceManager
