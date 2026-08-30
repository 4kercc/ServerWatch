import React, { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Settings, LogOut, LogIn, Shield, Sun, Moon, ArrowDown, ArrowUp, User, Radar } from 'lucide-react'

export default function Layout({ onlineCount = 0, totalCount = 0, txTotal = 0, rxTotal = 0 }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })

  const token = localStorage.getItem('token')
  const isLoggedIn = Boolean(token)

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => {
    setIsDark(!isDark)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUserMenuOpen(false)
    window.location.href = '/servers'
  }

  const formatSpeed = (val) => {
    const bytes = parseFloat(val) || 0
    if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB/s'
    if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB/s'
    return bytes.toFixed(0) + ' B/s'
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-200">
      {/* 顶部现代化 shadcn 导航栏 */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
          
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to="/servers" className="flex items-center gap-2.5 font-semibold text-lg tracking-tight hover:opacity-90 transition">
              <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Activity className="h-5 w-5" />
              </div>
              <span className="font-bold tracking-tight">
                ServerWatch
              </span>
            </Link>
          </div>

          {/* 全局集群吞吐与快捷操作 */}
          <div className="flex items-center gap-3 sm:gap-5">
            
            {/* 汇总指标 Badge */}
            <div className="hidden lg:flex items-center gap-3 text-xs bg-muted/50 border border-border/80 px-3.5 py-1.5 rounded-full font-mono">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-muted-foreground">在线:</span>
                <span className="font-semibold text-foreground">{onlineCount} / {totalCount}</span>
              </div>
              <div className="h-3 w-[1px] bg-border"></div>
              <div className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
                <ArrowDown className="h-3 w-3" />
                <span>{formatSpeed(rxTotal)}</span>
              </div>
              <div className="flex items-center gap-1 text-blue-500 dark:text-blue-400">
                <ArrowUp className="h-3 w-3" />
                <span>{formatSpeed(txTotal)}</span>
              </div>
            </div>

            {/* 主题切换按钮 (明亮 / 暗黑) */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/60 border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              title={isDark ? '切换至明亮模式' : '切换至暗黑模式'}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
            </button>

            {/* ���录与管理员菜单 */}
            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center justify-center h-9 w-9 rounded-full bg-muted border border-border hover:bg-accent transition cursor-pointer"
                  title="管理员工作台"
                >
                  <Shield className="h-4 w-4 text-emerald-500" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-card p-1 shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border mb-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        已登录管理员
                      </div>
                      <Link
                        to="/discover"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-muted transition text-foreground"
                      >
                        <Radar className="h-4 w-4 text-muted-foreground" />
                        自动发现中心
                      </Link>
                      <Link
                        to="/setting"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-muted transition text-foreground"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        系统配置
                      </Link>
                      <div className="h-[1px] bg-border my-1"></div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-red-500 hover:bg-red-500/10 transition text-left cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        退出登录
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                to="/signin"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition shadow-sm"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>管理员登录</span>
              </Link>
            )}

          </div>

        </div>
      </header>

      {/* 主体内容注入 */}
      <main className="flex-1 container max-w-7xl mx-auto px-4 sm:px-8 py-6">
        <Outlet />
      </main>

      {/* 极简页脚 */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        ServerWatch &copy; 2026
      </footer>
    </div>
  )
}
