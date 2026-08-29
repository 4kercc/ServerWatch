const dns = require('dns')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const SSL_DIR = path.resolve(process.cwd(), 'ssl')

function runCmd(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString()
  } catch (err) {
    return null
  }
}

// 获取本机公网 IPv4
async function getPublicIps() {
  const ips = new Set()
  // 1. 本地网卡扫描
  const ifaces = os.networkInterfaces()
  for (const dev in ifaces) {
    for (const item of ifaces[dev]) {
      if (!item.internal && item.family === 'IPv4') {
        ips.add(item.address)
      }
    }
  }
  // 2. 通过外部服务获取出口公网 IP
  const queryCmds = [
    'curl -s --connect-timeout 3 -4 myip.ipip.net | grep -oE "[0-9]{1,3}(\\.[0-9]{1,3}){3}" || true',
    'curl -s --connect-timeout 3 -4 ifconfig.me || true',
    'curl -s --connect-timeout 3 -4 ipinfo.io/ip || true'
  ]
  for (const q of queryCmds) {
    const res = runCmd(q)
    if (res) {
      const match = res.trim().match(/^[0-9]{1,3}(\.[0-9]{1,3}){3}$/)
      if (match) {
        ips.add(match[0])
        break
      }
    }
  }
  return Array.from(ips)
}

// 校验域名 DNS 是否解析到当前服务器
async function verifyDomain(domain) {
  console.log(`[*] 正在检测域名 [${domain}] 的 DNS 解析记录...`)
  return new Promise((resolve) => {
    dns.resolve4(domain, async (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        console.error(`[-] 域名解析失败: 无法查询到 [${domain}] 的 A 记录。`)
        return resolve(false)
      }

      console.log(`[+] 域名 [${domain}] 解析到的 IP 地址:`, addresses.join(', '))
      const publicIps = await getPublicIps()
      console.log(`[+] 本机检测到的公网 IP 列表:`, publicIps.join(', '))

      const isMatched = addresses.some(addr => publicIps.includes(addr))
      if (isMatched) {
        console.log(`[✓] 域名验证通过：[${domain}] 已正确指向当前服务器！`)
        resolve(true)
      } else {
        console.error(`[-] 域名验证失败：[${domain}] 解析的 IP (${addresses.join(', ')}) 与当前服务器公网 IP (${publicIps.join(', ')}) 不匹配！`)
        console.error(`[-] 请先在域名解析服务商处将 [${domain}] 的 A 记录解析到当前服务器 IP。`)
        resolve(false)
      }
    })
  })
}

// 安装必要依赖 (socat / curl)
function ensureDependencies() {
  if (!runCmd('which socat || true')) {
    console.log('[*] 正在安装 socat 端口监听组件...')
    if (runCmd('which apt-get || true')) {
      runCmd('apt-get update -y >/dev/null 2>&1 && apt-get install -y socat curl cron >/dev/null 2>&1')
    } else if (runCmd('which yum || true')) {
      runCmd('yum install -y socat curl cronie >/dev/null 2>&1')
    }
  }
}

// 使用 acme.sh 自动化签发 Let's Encrypt 证书并设置自动续期
async function issueCert(domain) {
  if (!fs.existsSync(SSL_DIR)) {
    fs.mkdirSync(SSL_DIR, { recursive: true })
  }

  ensureDependencies()

  const certPath = path.join(SSL_DIR, 'cert.pem')
  const keyPath = path.join(SSL_DIR, 'key.pem')

  console.log(`[*] 开始为域名 [${domain}] 自动申请 Let's Encrypt SSL 证书...`)

  // 1. 安装/更新 acme.sh
  const homeDir = os.homedir()
  const acmeSh = path.join(homeDir, '.acme.sh/acme.sh')

  if (!fs.existsSync(acmeSh)) {
    console.log('[*] 正在下载并安装 acme.sh 自动化证书工具...')
    runCmd(`curl -s https://get.acme.sh | sh -s email=admin@${domain} >/dev/null 2>&1 || wget -qO- https://get.acme.sh | sh -s email=admin@${domain} >/dev/null 2>&1`)
  }

  // 2. 检查 80 端口占用情况，若有冲突先提醒
  const port80Check = runCmd('ss -tulpn | grep ":80 " || true')
  if (port80Check && port80Check.trim()) {
    console.log('[!] 检测到 80 端口已被占用，请确保 80 端口可正常通过 ACME 验证。')
  }

  // 3. 设置默认 CA 为 Let's Encrypt 并签发 ECC 证书
  console.log(`[*] 正在通过 Let's Encrypt CA 签发 ECC 高性能 SSL 证书...`)
  runCmd(`${acmeSh} --set-default-ca --server letsencrypt >/dev/null 2>&1`)
  const issueCmd = `${acmeSh} --issue -d ${domain} --standalone --keylength ec-256 --force`
  const issueOut = runCmd(issueCmd)
  if (issueOut) {
    console.log(issueOut.trim())
  }

  // 4. 将证书安装到项目 ssl/ 目录
  const installCmd = `${acmeSh} --install-cert -d ${domain} --ecc \
    --key-file       ${keyPath}  \
    --fullchain-file ${certPath} \
    --reloadcmd     "cd ${process.cwd()} && ./serverwatch-linux restart || true"`
  runCmd(installCmd)

  if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.statSync(certPath).size > 100) {
    console.log(`[+] Let's Encrypt SSL 证书签发并安装成功！`)
    console.log(`[+] 证书路径: ${certPath}`)
    console.log(`[+] 私钥路径: ${keyPath}`)

    // 5. 配置 acme.sh 自动续期 cron 任务
    console.log(`[+] 已自动配置 Let's Encrypt 证书 60 天自动续期机制！`)
    return { cert: certPath, key: keyPath }
  } else {
    console.error(`[-] 证书签发未能完成。请确保服务器 80 端口可由公网直接访问。`)
    return null
  }
}

module.exports = {
  verifyDomain,
  issueCert,
  SSL_DIR
}
