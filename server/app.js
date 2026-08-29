// 显式指定全局 Promise，消除 any-promise 动态扫描
require('any-promise/register')('global.Promise', { Promise: global.Promise })

const Koa = require('koa')
const json = require('koa-json')
const bodyparser = require('koa-bodyparser')
const os = require('os')
const fs = require('fs')
const path = require('path')

const serviceManager = require('./utils/service')
const config = require('./config')
const routers = require('./routers/index')
const cors = require('@koa/cors')
const staticData = require('./static_assets')
const staticAssets = staticData.assets || {}

// CLI 命令行参数路由分发
const args = process.argv.slice(2)
const command = args[0] ? args[0].toLowerCase() : ''

if (command === 'ssl') {
  const domain = args[1]
  const action = args[2] || 'start'
  serviceManager.handleSsl(domain, action).then(() => {
    process.exit(0)
  }).catch((err) => {
    console.error('[-] SSL 执行异常:', err)
    process.exit(1)
  })
} else if (['start', 'stop', 'restart', 'status', 'enable', 'disable', 'help', '-h', '--help'].includes(command)) {
  switch (command) {
    case 'start':
      serviceManager.start()
      break
    case 'stop':
      serviceManager.stop()
      break
    case 'restart':
      serviceManager.restart()
      break
    case 'status':
      serviceManager.status()
      break
    case 'enable':
      serviceManager.enable()
      break
    case 'disable':
      serviceManager.disable()
      break
    case 'help':
    case '-h':
    case '--help':
    default:
      serviceManager.help()
      break
  }
  process.exit(0)
} else {
  // 正常启动 Web 服务应用 (command 为空或 'run')
  const app = new Koa()

  // 1. 全局 HTTP 安全防护 Header 中间件 (防点击劫持、防 MIME 嗅探、防 XSS 攻击)
  app.use(async (ctx, next) => {
    ctx.set('X-Content-Type-Options', 'nosniff')
    ctx.set('X-Frame-Options', 'SAMEORIGIN')
    ctx.set('X-XSS-Protection', '1; mode=block')
    ctx.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    await next()
  })

  // 2. 自定义优雅错误捕获
  app.use(async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      ctx.status = err.status || 500
      ctx.body = {
        status: ctx.status,
        message: err.message || 'Internal Server Error'
      }
      console.error('[Server Error]', err)
    }
  })

  app.use(cors())

  // middlewares
  app.use(bodyparser({
    enableTypes:['json', 'form', 'text']
  }))

  app.use(json())

  // 100% 内存内嵌静态资源服务（绝无 404，不依赖任何外部文件系统）
  app.use(async (ctx, next) => {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      return next()
    }

    // 命中内嵌打包的静态资源（/assets/* 或 favicon 等）
    const asset = staticAssets[ctx.path]
    if (asset) {
      ctx.type = asset.type
      ctx.body = asset.base64 ? Buffer.from(asset.content, 'base64') : asset.content
      return
    }

    await next()
  })

  app.use(routers.routes()).use(routers.allowedMethods())

  config.init(app)

  module.exports = app
}
