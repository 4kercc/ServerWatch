const staticData = require('../static_assets')

module.exports = async (ctx, next) => {
  ctx.type = 'text/html; charset=utf-8'
  const indexAsset = staticData?.assets?.['/index.html']
  if (indexAsset && indexAsset.content) {
    ctx.body = indexAsset.content
  } else {
    ctx.body = `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>ServerWatch - 现代服务器集群监控</title>
  </head>
  <body class="bg-background text-foreground antialiased selection:bg-primary/20 min-h-screen">
    <div id="root"></div>
  </body>
</html>`
  }
}
