import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ServerList from './pages/ServerList'
import ServerDetail from './pages/ServerDetail'
import ServerCreate from './pages/ServerCreate'
import ServerEdit from './pages/ServerEdit'
import ServerRemove from './pages/ServerRemove'
import Setting from './pages/Setting'
import SignIn from './pages/SignIn'

// 权限路由守卫 (仅保护管理操作页面)
function RequireAuth({ children }) {
  const token = localStorage.getItem('token')
  if (!token) {
    return <Navigate to="/signin" replace />
  }
  return children
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
          {/* 访客与管理员均可浏览服务器列表与详情 */}
          <Route index element={<Navigate to="/servers" replace />} />
          <Route path="servers" element={<ServerList onStatsUpdate={setStats} />} />
          <Route path="server/:id" element={<ServerDetail />} />

          {/* 管理员专属页面 (需要 Token) */}
          <Route path="server/create" element={<RequireAuth><ServerCreate /></RequireAuth>} />
          <Route path="server/:id/edit" element={<RequireAuth><ServerEdit /></RequireAuth>} />
          <Route path="server/:id/remove" element={<RequireAuth><ServerRemove /></RequireAuth>} />
          <Route path="setting" element={<RequireAuth><Setting /></RequireAuth>} />
        </Route>

        <Route path="*" element={<Navigate to="/servers" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
