const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const SERVICE_NAME = 'serverwatch'
const SYSTEMD_PATH = `/etc/systemd/system/${SERVICE_NAME}.service`
const PID_FILE = path.resolve(process.cwd(), 'serverwatch.pid')
const LOG_FILE = path.resolve(process.cwd(), 'serverwatch.log')

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

function isRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return false
  }
}

function getPid() {
  if (fs.existsSync(PID_FILE)) {
    try {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim())
      if (pid && isRunning(pid)) {
        return pid
      }
    } catch (e) {}
  }
  // 备用进程查找
  const out = runCmd(`pgrep -f "${getBinaryPath()}" || true`)
  if (out) {
    const pids = out.trim().split('\n').map(p => parseInt(p)).filter(p => p && p !== process.pid)
    if (pids.length > 0) return pids[0]
  }
  return null
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
ExecStart=${bin} run
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
      console.log('[-] 当前系��不支持 systemd。')
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

  // 启动服务 (优先 systemd，降级守护进程)
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
    const child = spawn(bin, ['run'], {
      cwd: getWorkDir(),
      detached: true,
      stdio: ['ignore', outFd, outFd]
    })
    child.unref()

    fs.writeFileSync(PID_FILE, String(child.pid))
    console.log(`[+] ServerWatch 已启动成功 (PID: ${child.pid})，日志记录于: ${LOG_FILE}`)
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
    } else {
      runCmd(`pkill -f "${getBinaryPath()}" 2>/dev/null || true`)
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
  start     启动 ServerWatch 后台服务
  stop      停止 ServerWatch 服务
  restart   重启 ServerWatch 服务
  status    查看 ServerWatch 服务的运行状态与 PID
  enable    安装并开启 systemd 开机自启
  disable   禁用 systemd 开机自启
  run       在前台直接运行 ServerWatch (用于调试/容器/Systemd)
  help      显示此帮助信息
`)
  }
}

module.exports = serviceManager
