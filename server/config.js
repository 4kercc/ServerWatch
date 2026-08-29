const fs = require('fs')
const os = require('os')
const crypto = require('crypto')

const config_path = process.cwd() + '/config.json'

function generateRandomString(len = 8) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len)
}

var cfg = {
  "username": "admin",
  "password": generateRandomString(8),
  "port": 51221
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
      cfg = JSON.parse(data)
    } catch(e) {}
    launcher(cfg, false)
  } else {
    // 首次运行：自动随机生成安全管理员账号与密码并持久化保存
    cfg.username = 'admin'
    cfg.password = generateRandomString(8)
    try {
      fs.writeFileSync(config_path, JSON.stringify(cfg, null, 2))
    } catch(e) {}
    launcher(cfg, true)
  }
}

function launcher(cfg, isNew = false){
  handler = app.listen(cfg.port)
  console.log(new Date().toISOString())
  console.log('App is running at http://' + getIpv4() + ':' + cfg.port + '/')
  if (isNew) {
    console.log('=====================================================')
    console.log('【安全提示】首次启动已为您随机生成管理员登录凭据：')
    console.log(' 管理员用户名: ' + cfg.username)
    console.log(' 初始安全密码: ' + cfg.password)
    console.log(' 凭据已保存在 config.json 中，请妥善保管！')
    console.log('=====================================================')
  }
}

function data(){
  return cfg
}

async function save(d){
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
  init, data, save, launcher
}
