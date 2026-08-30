const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const path = require('path')
const https = require('https')
const http = require('http')

const config_path = process.cwd() + '/config.json'
const SSL_DIR = path.resolve(process.cwd(), 'ssl')

function generateRandomString(len = 8) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len)
}

var cfg = {
  "username": "admin",
  "password": generateRandomString(8),
  "jwt_secret": generateRandomString(32),
  "discover_key": generateRandomString(16),
  "port": 51221,
  "domain": "",
  "ssl": false,
  "guest_mode": true // 默认开启访客模式
}

var app, handler

function getIpv4() {
  var ifaces = os.networkInterfaces();
  for (var dev in ifaces) {
      for (var i in ifaces[dev]) {
          var details = ifaces[dev][i];
          if (/^\d+\./.test(details.address)) {
              return details.address;
          }
      }
  }
  return '127.0.0.1'
}

function init(instance){
  app = instance

  if (fs.existsSync(config_path)) {
    try {
      const data = fs.readFileSync(config_path, 'utf-8')
      cfg = Object.assign(cfg, JSON.parse(data))
      // 为既往旧配置文件平滑补充高强度 jwt_secret、guest_mode 与嗅探密钥
      if (!cfg.jwt_secret) {
        cfg.jwt_secret = generateRandomString(32)
      }
      if (typeof cfg.guest_mode === 'undefined') {
        cfg.guest_mode = true
      }
      if (!cfg.discover_key) {
        cfg.discover_key = generateRandomString(16)
      }
      fs.writeFileSync(config_path, JSON.stringify(cfg, null, 2))
    } catch(e) {}
    launcher(cfg, false)
  } else {
    // 首次运行：自动随机生成安全管理员账号、强密码与独立 JWT 密钥并持久化保存
    cfg.username = 'admin'
    cfg.password = generateRandomString(8)
    cfg.jwt_secret = generateRandomString(32)
    cfg.guest_mode = true
    try {
      fs.writeFileSync(config_path, JSON.stringify(cfg, null, 2))
    } catch(e) {}
    launcher(cfg, true)
  }
}

function launcher(cfg, isNew = false){
  const certPath = path.join(SSL_DIR, 'cert.pem')
  const keyPath = path.join(SSL_DIR, 'key.pem')
  const hasSslFiles = fs.existsSync(certPath) && fs.existsSync(keyPath)

  if (cfg.ssl && hasSslFiles) {
    // 启动 HTTPS 服务
    try {
      const sslOptions = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath)
      }
      handler = https.createServer(sslOptions, app.callback()).listen(cfg.port)
      console.log(new Date().toISOString())
      const domainDisplay = cfg.domain || getIpv4()
      console.log(`[+] ServerWatch HTTPS 安全服务已就绪: https://${domainDisplay}:${cfg.port}/`)
      console.log(`[+] SSL 加密通道已开启，所有流量受 TLS 保护。`)
    } catch (err) {
      console.error('[-] 加载 SSL 证书失败，回退至 HTTP 模式:', err.message)
      handler = app.listen(cfg.port)
      console.log('App is running at http://' + getIpv4() + ':' + cfg.port + '/')
    }
  } else {
    // 普通 HTTP 模式
    handler = app.listen(cfg.port)
    console.log(new Date().toISOString())
    console.log('App is running at http://' + getIpv4() + ':' + cfg.port + '/')
  }

  if (isNew) {
    console.log('=====================================================')
    console.log('【安全提示】首次启动已为您随��生成管理员登录凭据与安全密钥：')
    console.log(' 管理员用户名: ' + cfg.username)
    console.log(' 初始安全密码: ' + cfg.password)
    console.log(' 独立 JWT 密钥: [已安全生成并持久化保存在 config.json 中]')
    console.log(' 访客模式状态: 已默认开启')
    console.log(' 凭据已保存在 config.json 中，请妥善保管！')
    console.log('=====================================================')
  }
}

function data(){
  return cfg
}

function isGuestMode() {
  return cfg.guest_mode !== false
}

function getJwtSecret() {
  return cfg.jwt_secret || 'sw_default_secret_' + (cfg.password || 'default')
}

async function save(d){
  // 保持原有 jwt_secret 与嗅探密钥 (防止局部更新时意外丢失)
  if (!d.jwt_secret && cfg.jwt_secret) {
    d.jwt_secret = cfg.jwt_secret
  }
  if (!d.discover_key && cfg.discover_key) {
    d.discover_key = cfg.discover_key
  }

  let str = JSON.stringify(d, null, 2)

  if(d.port != cfg.port && handler){
    handler.close()
    launcher(d, false)
  }

  if(str.replace(/[\{\}\s]+/,'') == ''){
    return false
  }

  cfg = d
  return new Promise((resolve, reject) => {
    fs.writeFile(config_path, str, function(err) {
      if (err) {
        console.log(err, 'save config error')
      } else {
        console.log('save config success')
      }
      resolve(true)
    })
  })
}

module.exports = {
  init, data, save, launcher, getJwtSecret, isGuestMode
}
