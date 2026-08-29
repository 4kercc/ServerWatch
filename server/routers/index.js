const router = require('koa-router')()

const account = require('../controllers/account')
const node = require('../controllers/node')
const home = require('./home')
const client = require('./client')
const authorize = require('../middleware/koa-auth')

// 1. 公开认证与公共信息接口
router.get('/api/info', account.publicInfo)
router.post('/api/signin', account.signin)

// 2. 访客可见接口 (内置 optional 鉴权，支持无 Token 浏览脱敏看板)
router.get('/api/nodes', authorize.optional, node.list)
router.get('/api/node/:id', authorize.optional, node.query)
router.get('/api/node/:id/latest', authorize.optional, node.queryLatest)

// 3. 受保护的管理操作接口 (必须 Token 严格鉴权)
router.get('/api/node/:id/base', authorize.check, node.queryBase)
router.post('/api/node/create', authorize.check, node.create)
router.post('/api/node/:id', authorize.check, node.update)
router.post('/api/node/:id/remove', authorize.check, node.remove)
router.get('/api/node/:id/remove', authorize.check, node.remove)
router.get('/api/setting', authorize.check, account.setting)
router.post('/api/setting', authorize.check, account.update)

// 4. 探针客户端路由
router.use('/client', client.routes(), client.allowedMethods())

// 5. 首页与 SPA 前端路由分发
router.use(home.routes(), home.allowedMethods())

module.exports = router
