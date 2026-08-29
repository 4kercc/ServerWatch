const router = require('koa-router')()
const index = require('../controllers/home')

// 匹配首页以及 SPA 客户端路由（避免刷新 /servers、/server/:id 等返回 404）
router.get('/', index)
router.get('/servers', index)
router.get('/server/:id', index)
router.get('/server/:id/edit', index)
router.get('/server/:id/remove', index)
router.get('/server/create', index)
router.get('/setting', index)
router.get('/signin', index)

module.exports = router
