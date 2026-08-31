const router = require('koa-router')()
const index = require('../controllers/home')

// 1. 显式注册已知 SPA 客户端路由
router.get('/', index)
router.get('/servers', index)
router.get('/server/:id', index)
router.get('/server/:id/edit', index)
router.get('/server/:id/remove', index)
router.get('/server/create', index)
router.get('/discover', index)
router.get('/setting', index)
router.get('/signin', index)

// 2. 通配兜底���非 /api/* 与非 /client/* 的任意页面 GET 请求全部回退到 SPA 首页
// 彻底杜绝未来任何前端深层子路由直接刷新返回 404 的问题
router.get(/^(?!\/(api|client)\/).*$/, index)

module.exports = router
