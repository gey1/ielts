import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { updateSettings } from '../services/library/library.ts'
import { requestPersistentStorage } from '../services/storage.ts'
import { Modal } from './Modal.tsx'
import { useSnapshot } from './useSnapshot.ts'

const NAV = [
  { to: '/', label: '今日', en: 'Home', end: true },
  { to: '/study', label: '学习', en: 'Study', end: false },
  { to: '/cards', label: '词卡', en: 'Cards', end: false },
  { to: '/calendar', label: '日历', en: 'Calendar', end: false },
  { to: '/progress', label: '进展', en: 'Progress', end: false },
]

function titleFor(pathname: string): string {
  if (pathname.startsWith('/practice')) return '练习'
  if (pathname.startsWith('/import')) return '导入'
  if (pathname.startsWith('/settings')) return '设置'
  const match = NAV.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
  return match?.label ?? '词径'
}

export function AppShell({ children }: { children: ReactNode }) {
  const snapshot = useSnapshot()
  const location = useLocation()
  const navigate = useNavigate()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [acking, setAcking] = useState(false)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    document.title = `${titleFor(location.pathname)} · 词径`
  }, [location.pathname])

  async function acknowledge(toSettings: boolean) {
    setAcking(true)
    try {
      await requestPersistentStorage()
      await updateSettings({ dataNoticeAck: true, persistRequested: true })
      if (toSettings) navigate('/settings')
    } finally {
      setAcking(false)
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">径</span>
          <span>
            <strong className="brand-name">词径</strong>
            <span className="brand-en">IELTS lexis</span>
          </span>
        </div>
        <nav className="side-nav" aria-label="主要">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
              <span>{item.label}</span>
              <small>{item.en}</small>
            </NavLink>
          ))}
        </nav>
        <div className="side-footer">
          <NavLink to="/import">导入</NavLink>
          <NavLink to="/settings">设置与备份</NavLink>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="brand-name">词径</span>
          <nav className="top-links">
            <NavLink to="/import">导入</NavLink>
            <NavLink to="/settings">设置</NavLink>
          </nav>
        </header>
        {!online && (
          <p className="offline-banner" data-testid="offline-banner" role="status">
            当前离线。已打开过的页面可以继续学习，记录仍写在这台设备上。
          </p>
        )}
        <main className="content" data-testid="app-ready">
          {snapshot ? children : <p className="muted">正在读取词库…</p>}
        </main>
      </div>
      <nav className="tabbar" aria-label="主要">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            <span>{item.label}</span>
            <small>{item.en}</small>
          </NavLink>
        ))}
      </nav>
      {snapshot && !snapshot.settings.dataNoticeAck && (
        <Modal title="数据只在这台设备上">
          <p>
            词卡、复习记录和备份都保存在这个浏览器里。没有账号，也不会上传。
            清除浏览器数据、换一台设备，或在系统里删掉主屏幕图标，都可能让记录消失。
          </p>
          <p>请偶尔导出一份 JSON 备份。iPad 上可以把文件存进「文件」App。</p>
          <div className="cluster">
            <button type="button" className="btn primary" data-testid="notice-ack" disabled={acking} onClick={() => void acknowledge(false)}>
              知道了
            </button>
            <button type="button" className="btn ghost" disabled={acking} onClick={() => void acknowledge(true)}>
              先看备份
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
