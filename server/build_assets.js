const fs = require('fs')
const path = require('path')

const staticDir = path.resolve(__dirname, 'static')
const files = {}

function walk(dir, base = '') {
  const items = fs.readdirSync(dir)
  for (const f of items) {
    const full = path.join(dir, f)
    const rel = base ? base + '/' + f : f
    if (fs.statSync(full).isDirectory()) {
      walk(full, rel)
    } else {
      const ext = path.extname(f).toLowerCase()
      const isText = ['.html', '.css', '.js', '.json', '.svg'].includes(ext)
      files['/' + rel] = {
        type: ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'application/javascript; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream',
        content: isText ? fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n') : fs.readFileSync(full).toString('base64'),
        base64: !isText
      }
    }
  }
}

walk(staticDir)

// 嵌入 sql-wasm.wasm 二进制
const wasmPath = path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm')
let wasmBase64 = ''
if (fs.existsSync(wasmPath)) {
  wasmBase64 = fs.readFileSync(wasmPath).toString('base64')
}

// 嵌入 Shell 探针脚本并强制转换为纯 Unix LF 换行符（彻底规避 Windows CRLF \r\n 语法错误）
const shellScripts = {}
const shellDir = path.resolve(__dirname, 'shell')
if (fs.existsSync(shellDir)) {
  for (const s of fs.readdirSync(shellDir)) {
    const raw = fs.readFileSync(path.join(shellDir, s), 'utf8')
    shellScripts[s] = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  }
}

const jsCode = `module.exports = {
  assets: ${JSON.stringify(files, null, 2)},
  wasmBinaryBase64: ${JSON.stringify(wasmBase64)},
  shellScripts: ${JSON.stringify(shellScripts, null, 2)}
};
`

fs.writeFileSync(path.resolve(__dirname, 'static_assets.js'), jsCode)
console.log('Successfully generated static_assets.js with UNIX LF sanitized Shell scripts:', Object.keys(shellScripts))
