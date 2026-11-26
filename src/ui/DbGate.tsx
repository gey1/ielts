import { useEffect, useState, type ReactNode } from 'react'
import { ready } from '../services/db/db.ts'
import { messageOf } from './download.ts'

export function DbGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    let active = true
    ready()
      .then(() => {
        if (active) setState('ready')
      })
      .catch((error: unknown) => {
        if (!active) return
        setDetail(messageOf(error))
        setState('error')
      })
    return () => {
      active = false
    }
  }, [])

  if (state === 'loading') {
    return <p className="gate">正在打开这台设备上的词库…</p>
  }
  if (state === 'error') {
    return (
      <div className="gate">
        <h1>词库没有打开</h1>
        <p>词径把数据放在这个浏览器的 IndexedDB 里。当前环境打不开它。</p>
        <p className="muted">{detail}</p>
      </div>
    )
  }
  return children
}
