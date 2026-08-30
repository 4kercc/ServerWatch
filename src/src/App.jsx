import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import ServerList from './pages/ServerList'
import ServerDetail from './pages/ServerDetail'
import ServerCreate from './pages/ServerCreate'
import ServerEdit from './pages/ServerEdit'
import ServerRemove from './pages/ServerRemove'
import Setting from './pages/Setting'
import Discover from './pages/Discover'
import SignIn from './pages/SignIn'
import http from './lib/http'

// 权限路由守卫 (管理操作专属)
function RequireAuth({ children }) {
  const token = localStorage.getItem('token')
  if (!token) {
    return <Navigate to="/signin" replace />
  }
  return children
}

// 访客模式智能守卫：如果访客模式关闭且用户未登录，自动重定向到 /signin
function GuestOrAuthRoute({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      if (token) {
        setAllowed(true)
        setChecking(false)
        return
      }

      try {
        const res = await http.get('/api/info')
        if (res && res.data && res.data.guest_mode === false) {
          // 访客模式已关闭，重定向到登录页
          navigate('/signin', { replace: true, state: { from: location } })
          return
        }
        setAllowed(true)
      } catch (err) {
        setAllowed(true)
      } finally {
        setChecking(false)
      }
    }

    checkAccess()
  }, [location.pathname, token])

  if (checking) {
    return null
  }

  return allowed ? children : null
}

export default function App() {
  const [stats, setStats] = useState({
    onlineCount: 0,
    totalCount: 0,
    rxTotal: 0,
    txTotal: 0
  })

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signin" element={<SignIn />} />

        {/* 根路径与公共/管理视图 */}
        <Route
          path="/"
          element={
            <Layout
              onlineCount={stats.onlineCount}
              totalCount={stats.totalCount}
              rxTotal={stats.rxTotal}
              txTotal={stats.txTotal}
            />
          }
        >
          {/* 访客与管理员浏览入口 (受访客模式开关智能保护) */}
          <Route index element={<Navigate to="/servers" replace />} />
          <Route
            path="servers"
            element={
              <GuestOrAuthRoute>
                <ServerList onStatsUpdate={setStats} />
              </GuestOrAuthRoute>
            }
          />
          <Route
            path="server/:id"
            element={
              <GuestOrAuthRoute>
                <ServerDetail />
              </GuestOrAuthRoute>
            }
          />

          {/* 管理员专属页面 (必须 Token) */}
          <Route path="server/create" element={<RequireAuth><ServerCreate /></RequireAuth>} />
          <Route path="server/:id/edit" element={<RequireAuth><ServerEdit /></RequireAuth>} />
          <Route path="server/:id/remove" element={<RequireAuth><ServerRemove /></RequireAuth>} />
          <Route path="discover" element={<RequireAuth><Discover /></RequireAuth>} />
          <Route path="setting" element={<RequireAuth><Setting /></RequireAuth>} />
        </Route>

        <Route path="*" element={<Navigate to="/servers" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
