const jwt = require('jsonwebtoken')
const print = require('../utils/print')

const auth = {
    // 严格鉴权：用于写操作或管理配置 (/api/node/create, /api/node/:id, /api/setting)
    check(ctx, next) {
        let token = ctx.request.header['authorization'] || ctx.request.query.key

        if (token) {
            try {
                let tokenData = jwt.verify(token, 'yueling')
                if (tokenData && tokenData.exp <= new Date() / 1000) {
                  print.json(ctx, 401, 'invalid token')
                } else {
                  ctx.authData = tokenData
                  return next()
                }
            } catch (err) {
                print.json(ctx, 401, 'invalid token')
            }
        } else {
            print.json(ctx, 401, 'no token detected')
        }
    },

    // 宽松鉴权：用于只读看板接口 (/api/nodes, /api/node/:id)，访客可看脱敏数据，管理员看完整数据
    optional(ctx, next) {
        let token = ctx.request.header['authorization'] || ctx.request.query.key

        if (token) {
            try {
                let tokenData = jwt.verify(token, 'yueling')
                if (tokenData && tokenData.exp > new Date() / 1000) {
                  ctx.authData = tokenData
                }
            } catch (err) {}
        }
        return next()
    },

    create(cnt) {
      let token = jwt.sign(cnt , 'yueling' , {expiresIn:'7d'})
      return token
    }
}

module.exports = auth
