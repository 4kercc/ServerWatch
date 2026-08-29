const service = require('./../models/account')
const createToken = require('../middleware/koa-auth').create
const config = require('../config')

// 登录防暴力破解记录器（基于客户端 IP 的滑动窗口与封禁保护）
const loginAttempts = new Map()
const MAX_ATTEMPTS = 5
const LOCK_TIME_MS = 15 * 60 * 1000 // 连续失败 5 次封禁 15 分钟

function getClientIp(ctx) {
  const forwarded = ctx.request.headers['x-forwarded-for']
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return ctx.request.ip || ctx.ip || '127.0.0.1'
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  async setting( ctx ){
    let result = {
      message: '',
      data: config.data(),
      status: 0
    }
    
    ctx.body = result
  },

  async update( ctx , next){
    let {username , password , port} = ctx.request.body
    let result = {
      message: '',
      data: null,
      status: 0
    }

    let obj = {}
    if(username) obj.username = username
    if(password) obj.password = password
    if(port) obj.port = port

    if(obj){
      let ret = await config.save(obj)
      if(!ret){
        result.message = '保存失败'
      }else{
        result.data = {port , username}
      }
    }
    ctx.body = result
  },

  async signin( ctx , next){
    const ip = getClientIp(ctx)
    const now = Date.now()
    const record = loginAttempts.get(ip) || { count: 0, lockUntil: 0 }

    // 1. 检查是否处于锁定封禁期
    if (record.lockUntil > now) {
      const waitMinutes = Math.ceil((record.lockUntil - now) / 60000)
      ctx.body = {
        status: -1,
        message: `密码错误次数过多，IP 已被安全锁定，请在 ${waitMinutes} 分钟后再试`
      }
      return
    }

    let data = ctx.request.body || {}
    let result = {
      message: '',
      data: null,
      status: -1
    }
    let account = config.data()

    // 2. 账号密码匹配校验
    if(account.username === data.username && account.password === data.password){
      // 登录成功：清除该 IP 的错误计数
      loginAttempts.delete(ip)

      result.status = 0
      result.data = {
        token : createToken({account: data.username})
      }
    } else {
      // 登录失败：记录失败次数，并在失败时加入防时序攻击延时 (300ms)
      await sleep(300)

      record.count = (record.count || 0) + 1
      if (record.count >= MAX_ATTEMPTS) {
        record.lockUntil = now + LOCK_TIME_MS
        result.message = `连续密码错误达 ${MAX_ATTEMPTS} 次，该 IP 已被安全锁定 15 分钟！`
      } else {
        const remaining = MAX_ATTEMPTS - record.count
        result.message = `用户名或密码错误 (剩余尝试次数: ${remaining} 次)`
      }
      loginAttempts.set(ip, record)
    }

    ctx.body = result
  },

}
