import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatByte(v, t) {
  const val = parseFloat(v)
  if (isNaN(val) || val <= 0) return '0 B'
  if (t === 'm') {
    return (val / 1024 / 1024).toFixed(2) + ' MB'
  } else if (t === 'g') {
    return (val / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  } else {
    if (val > 1024 * 1024 * 1024) {
      return (val / 1024 / 1024 / 1024).toFixed(2) + ' GB'
    } else if (val > 1024 * 1024) {
      return (val / 1024 / 1024).toFixed(2) + ' MB'
    } else if (val > 1024) {
      return (val / 1024).toFixed(2) + ' KB'
    } else {
      return val.toFixed(0) + ' B'
    }
  }
}

export function formatTime(v) {
  const num = parseInt(v)
  if (isNaN(num) || num <= 0) return '00:00:00'
  const z = (a) => (a < 10 ? '0' + a : a)
  if (num < 100 * 3600) {
    const h = Math.floor(num / 3600)
    const m = Math.floor((num - h * 3600) / 60)
    const s = Math.floor(num % 60)
    return `${z(h)}:${z(m)}:${z(s)}`
  } else {
    const days = Math.floor(num / 86400)
    const restH = Math.floor((num % 86400) / 3600)
    return `${days}天 ${restH}小时`
  }
}

export function formatDateTime(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const z = (n) => (n < 10 ? '0' + n : n)
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`
}

// 智能归属地国家/地区国旗 Emoji 解析器
export function getCountryFlag(loc) {
  if (!loc || typeof loc !== 'string') return '🌐'
  const l = loc.toLowerCase()

  if (l.includes('中国') || l.includes('china') || l.includes('cn')) {
    if (l.includes('香港') || l.includes('hong kong') || l.includes('hk')) return '🇭🇰'
    if (l.includes('澳门') || l.includes('macau') || l.includes('mo')) return '🇲🇴'
    if (l.includes('台湾') || l.includes('taiwan') || l.includes('tw')) return '🇹🇼'
    return '🇨🇳'
  }
  if (l.includes('香港') || l.includes('hong kong') || l.includes('hk')) return '🇭🇰'
  if (l.includes('台湾') || l.includes('taiwan') || l.includes('tw')) return '🇹🇼'
  if (l.includes('澳门') || l.includes('macau') || l.includes('mo')) return '🇲🇴'
  if (l.includes('美国') || l.includes('united states') || l.includes('usa') || l.includes('us')) return '🇺🇸'
  if (l.includes('日本') || l.includes('japan') || l.includes('jp') || l.includes('tokyo') || l.includes('osaka')) return '🇯🇵'
  if (l.includes('新加坡') || l.includes('singapore') || l.includes('sg')) return '🇸🇬'
  if (l.includes('韩国') || l.includes('korea') || l.includes('kr') || l.includes('seoul')) return '🇰🇷'
  if (l.includes('英国') || l.includes('united kingdom') || l.includes('uk') || l.includes('london')) return '🇬🇧'
  if (l.includes('德国') || l.includes('germany') || l.includes('de') || l.includes('frankfurt')) return '🇩🇪'
  if (l.includes('俄罗斯') || l.includes('russia') || l.includes('ru') || l.includes('moscow')) return '🇷🇺'
  if (l.includes('加拿大') || l.includes('canada') || l.includes('ca')) return '🇨🇦'
  if (l.includes('澳大利亚') || l.includes('australia') || l.includes('au') || l.includes('sydney')) return '🇦🇺'
  if (l.includes('法国') || l.includes('france') || l.includes('fr') || l.includes('paris')) return '🇫🇷'
  if (l.includes('荷兰') || l.includes('netherlands') || l.includes('nl') || l.includes('amsterdam')) return '🇳🇱'
  if (l.includes('印度') || l.includes('india') || l.includes('in') || l.includes('mumbai')) return '🇮🇳'
  if (l.includes('马来西亚') || l.includes('malaysia') || l.includes('my')) return '🇲🇾'
  if (l.includes('泰国') || l.includes('thailand') || l.includes('th')) return '🇹🇭'
  if (l.includes('越南') || l.includes('vietnam') || l.includes('vn')) return '🇻🇳'
  if (l.includes('菲律宾') || l.includes('philippines') || l.includes('ph')) return '🇵🇭'
  if (l.includes('印尼') || l.includes('indonesia') || l.includes('id')) return '🇮🇩'
  if (l.includes('巴西') || l.includes('brazil') || l.includes('br')) return '🇧🇷'
  if (l.includes('南非') || l.includes('south africa') || l.includes('za')) return '🇿🇦'
  if (l.includes('芬兰') || l.includes('finland') || l.includes('fi')) return '🇫🇮'
  if (l.includes('瑞典') || l.includes('sweden') || l.includes('se')) return '🇸🇪'
  if (l.includes('挪威') || l.includes('norway') || l.includes('no')) return '🇳🇴'
  if (l.includes('瑞士') || l.includes('switzerland') || l.includes('ch')) return '🇨🇭'
  if (l.includes('意大利') || l.includes('italy') || l.includes('it')) return '🇮🇹'
  if (l.includes('西班牙') || l.includes('spain') || l.includes('es')) return '🇪🇸'
  if (l.includes('土耳其') || l.includes('turkey') || l.includes('tr')) return '🇹🇷'
  if (l.includes('阿联酋') || l.includes('uae') || l.includes('dubai')) return '🇦🇪'
  
  return '🌐'
}
