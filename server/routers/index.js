const router = require('koa-router')()

const account = require('../controllers/account')
const node = require('../controllers/node')
const discover = require('../controllers/discover')
const clientService = require('../controllers/client')
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

// 3.1 自动发现中心 (管理员专属：嗅探节点列表 / 认领 / 忽略 / 封禁 / 解封 / 密钥重置)
router.get('/api/discover', authorize.check, discover.info)
router.post('/api/discover/claim', authorize.check, discover.claim)
router.post('/api/discover/remove', authorize.check, discover.remove)
router.post('/api/discover/ban', authorize.check, discover.ban)
router.post('/api/discover/unban', authorize.check, discover.unban)
router.post('/api/discover/regenerate', authorize.check, discover.regenerate)

// 3.2 嗅探推送通道公开别名 (免 JWT，凭嗅探密钥鉴权，语义对齐 /api/server/push/<key>)
router.post('/api/server/push/:key', clientService.push)

// 4. 探针客户端路由
router.use('/client', client.routes(), client.allowedMethods())

// 5. 首页与 SPA 前端路由分发
router.use(home.routes(), home.allowedMethods())

module.exports = router
