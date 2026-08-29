import React from 'react'

// 高清标准 SVG 国旗组件 (彻底解决 Windows Chrome / 部分浏览器不渲染 Emoji 国旗显示为空白或文字的问题)
export function CountryFlag({ location, className = "h-3.5 w-5 rounded-[2px] inline-block shadow-sm object-cover flex-shrink-0" }) {
  if (!location || typeof location !== 'string') {
    return <span className="text-xs">🌐</span>
  }
  const l = location.toLowerCase()

  // 1. 中国 / 香港 / 澳门 / 台湾
  if (l.includes('香港') || l.includes('hong kong') || l.includes('hk')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="640" height="480" fill="#de2910"/>
        <circle cx="320" cy="240" r="100" fill="#fff" opacity="0.9"/>
      </svg>
    )
  }
  if (l.includes('台湾') || l.includes('taiwan') || l.includes('tw')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="640" height="480" fill="#fe0000"/>
        <rect width="320" height="240" fill="#000095"/>
        <circle cx="160" cy="120" r="45" fill="#fff"/>
      </svg>
    )
  }
  if (l.includes('中国') || l.includes('china') || l.includes('cn')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="640" height="480" fill="#de2910"/>
        <polygon points="64,128 83,188 147,188 95,225 114,285 64,248 14,285 33,225 -19,188 45,188" fill="#ffde00" transform="translate(60, 0) scale(0.6)"/>
        <polygon points="120,48 126,67 146,67 130,78 136,97 120,86 104,97 110,78 94,67 114,67" fill="#ffde00" transform="translate(100, 20) scale(0.3)"/>
        <polygon points="120,48 126,67 146,67 130,78 136,97 120,86 104,97 110,78 94,67 114,67" fill="#ffde00" transform="translate(130, 50) scale(0.3)"/>
      </svg>
    )
  }

  // 2. 美国 (US)
  if (l.includes('美国') || l.includes('united states') || l.includes('usa') || l.includes('us') || l.includes('america') || l.includes('colocrossing') || l.includes('los angeles') || l.includes('california')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <g fill="#bd3d44">
          <rect width="640" height="37"/>
          <rect y="74" width="640" height="37"/>
          <rect y="148" width="640" height="37"/>
          <rect y="222" width="640" height="37"/>
          <rect y="295" width="640" height="37"/>
          <rect y="369" width="640" height="37"/>
          <rect y="443" width="640" height="37"/>
        </g>
        <rect width="640" height="480" fill="none" stroke="#fff" strokeWidth="37"/>
        <g fill="#fff">
          <rect y="37" width="640" height="37"/>
          <rect y="111" width="640" height="37"/>
          <rect y="185" width="640" height="37"/>
          <rect y="258" width="640" height="37"/>
          <rect y="332" width="640" height="37"/>
          <rect y="406" width="640" height="37"/>
        </g>
        <rect width="256" height="258" fill="#192f5d"/>
        <circle cx="128" cy="129" r="40" fill="#fff" opacity="0.9"/>
      </svg>
    )
  }

  // 3. 日本 (JP)
  if (l.includes('日本') || l.includes('japan') || l.includes('jp') || l.includes('tokyo') || l.includes('osaka')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="640" height="480" fill="#fff"/>
        <circle cx="320" cy="240" r="144" fill="#bc002d"/>
      </svg>
    )
  }

  // 4. 新加坡 (SG)
  if (l.includes('新加坡') || l.includes('singapore') || l.includes('sg')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="640" height="240" fill="#ed2939"/>
        <rect y="240" width="640" height="240" fill="#fff"/>
        <circle cx="120" cy="120" r="60" fill="#fff"/>
        <circle cx="140" cy="120" r="54" fill="#ed2939"/>
      </svg>
    )
  }

  // 5. 德国 (DE)
  if (l.includes('德国') || l.includes('germany') || l.includes('de') || l.includes('frankfurt')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="640" height="160" fill="#000"/>
        <rect y="160" width="640" height="160" fill="#d00"/>
        <rect y="320" width="640" height="160" fill="#ffce00"/>
      </svg>
    )
  }

  // 6. 英国 (UK)
  if (l.includes('英国') || l.includes('united kingdom') || l.includes('uk') || l.includes('london')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="640" height="480" fill="#012169"/>
        <path d="M0 0 L640 480 M640 0 L0 480" stroke="#fff" strokeWidth="60"/>
        <path d="M0 0 L640 480 M640 0 L0 480" stroke="#c8102e" strokeWidth="30"/>
        <path d="M320 0 V480 M0 240 H640" stroke="#fff" strokeWidth="100"/>
        <path d="M320 0 V480 M0 240 H640" stroke="#c8102e" strokeWidth="60"/>
      </svg>
    )
  }

  // 7. 韩国 (KR)
  if (l.includes('韩国') || l.includes('korea') || l.includes('kr') || l.includes('seoul')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="640" height="480" fill="#fff"/>
        <circle cx="320" cy="240" r="100" fill="#cd2e3a"/>
        <path d="M220 240 A100 100 0 0 0 420 240 Z" fill="#0047a0"/>
      </svg>
    )
  }

  // 8. 俄罗斯 (RU)
  if (l.includes('俄罗斯') || l.includes('russia') || l.includes('ru') || l.includes('moscow')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="640" height="160" fill="#fff"/>
        <rect y="160" width="640" height="160" fill="#0039a6"/>
        <rect y="320" width="640" height="160" fill="#d52b1e"/>
      </svg>
    )
  }

  // 9. 法国 (FR)
  if (l.includes('法国') || l.includes('france') || l.includes('fr')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="213.3" height="480" fill="#002395"/>
        <rect x="213.3" width="213.3" height="480" fill="#fff"/>
        <rect x="426.6" width="213.3" height="480" fill="#ed2939"/>
      </svg>
    )
  }

  // 10. 加拿大 (CA)
  if (l.includes('加拿大') || l.includes('canada') || l.includes('ca')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="160" height="480" fill="#f00"/>
        <rect x="160" width="320" height="480" fill="#fff"/>
        <rect x="480" width="160" height="480" fill="#f00"/>
        <polygon points="320,180 340,240 310,230 330,280 290,260 320,320 300,320 320,360 310,360 320,290 320,180" fill="#f00"/>
      </svg>
    )
  }

  // 11. 澳大利亚 (AU)
  if (l.includes('澳大利亚') || l.includes('australia') || l.includes('au')) {
    return (
      <svg className={className} viewBox="0 0 640 480">
        <rect width="640" height="480" fill="#00008b"/>
        <rect width="320" height="240" fill="#012169"/>
        <path d="M0 0 L320 240 M320 0 L0 240" stroke="#fff" strokeWidth="30"/>
        <path d="M160 0 V240 M0 120 H320" stroke="#fff" strokeWidth="50"/>
        <path d="M160 0 V240 M0 120 H320" stroke="#c8102e" strokeWidth="30"/>
      </svg>
    )
  }

  // 默认全球图标
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" className="stroke-muted-foreground"/>
      <line x1="2" y1="12" x2="22" y2="12" className="stroke-muted-foreground"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" className="stroke-muted-foreground"/>
    </svg>
  )
}
