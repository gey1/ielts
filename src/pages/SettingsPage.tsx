import { useEffect, useState } from 'react'
import { dayKey, formatDateTime } from '../domain/time.ts'
import { buildBackup, inspectBackup, restoreBackup } from '../services/backup/backup.ts'
import { updateSettings } from '../services/library/library.ts'
import { isStandalone, requestPersistentStorage, storageIsPersisted } from '../services/storage.ts'
import { downloadJson, messageOf } from '../ui/download.ts'
import { useSnapshot } from '../ui/useSnapshot.ts'

export function SettingsPage() {
  const snapshot = useSnapshot()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [restoreRaw, setRestoreRaw] = useState<unknown>(null)
  const [restoreSummary, setRestoreSummary] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void storageIsPersisted().then(setPersisted)
    setStandalone(isStandalone())
  }, [])

  if (!snapshot) return null
  const settings = snapshot.settings

  async function exportBackup() {
    setError('')
    try {
      await updateSettings({ lastBackupAt: new Date().toISOString() })
      const file = await buildBackup()
      downloadJson(`cijing-backup-${dayKey(new Date())}.json`, file)
      setNotice('备份已开始下载。iPad 上如果直接打开了文件，用分享按钮存到「文件」。')
    } catch (caught) {
      setError(messageOf(caught))
    }
  }

  async function askPersist() {
    const result = await requestPersistentStorage()
    await updateSettings({ persistRequested: true })
    setPersisted(await storageIsPersisted())
    setNotice(result ? '浏览器已允许尽量保留这块数据。' : '浏览器没有允许持久存储。请仍定期导出备份。')
  }

  return (
    <section className="page narrow">
      <h1>设置与备份</h1>
      <section className="panel stack">
        <h2>每天学多少</h2>
        <Stepper
          label="新卡片"
          value={settings.dailyNewLimit}
          onChange={(value) => void updateSettings({ dailyNewLimit: value })}
          max={100}
        />
        <Stepper
          label="计划里的产出练习"
          value={settings.dailyExerciseLimit}
          onChange={(value) => void updateSettings({ dailyExerciseLimit: value })}
          max={20}
        />
        <p className="muted">新卡片为 0 时，按计划学习也只复习到期的卡。练习为 0 时，计划在闪卡后结束。</p>
      </section>
      <section className="panel stack">
        <h2>数据在这台设备上</h2>
        <p>
          词径没有账号，也不会把词库传到服务器。清除 Safari 或浏览器的网站数据、换设备、用隐私窗口，记录都会不见。
          主屏幕图标只是入口，数据仍在当初那个浏览器里。
        </p>
        <p className="muted">
          {standalone ? '你正在从主屏幕打开。' : '你正在浏览器里打开。iPad 可以在 Safari 的分享菜单里选择「添加到主屏幕」。'}
          {' '}
          {persisted === null && '正在查看存储状态。'}
          {persisted === true && '浏览器已标记这块存储为尽量保留。'}
          {persisted === false && '浏览器还没有保证保留这块存储。'}
          {settings.lastBackupAt && ` 上次导出：${formatDateTime(new Date(settings.lastBackupAt))}。`}
        </p>
        <div className="cluster">
          <button type="button" className="btn primary" data-testid="export-backup" onClick={() => void exportBackup()}>
            导出完整备份
          </button>
          <button type="button" className="btn ghost" onClick={() => void askPersist()}>请求保留数据</button>
        </div>
      </section>
      <section className="panel stack">
        <h2>从备份恢复</h2>
        <p>恢复会替换这台设备上的全部词卡、排程、复习记录和设置。它和「导入 JSON」不是一回事：导入只增加或更新内容，不覆盖复习进度。</p>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0]
            setRestoreRaw(null)
            setRestoreSummary('')
            setConfirmed(false)
            setError('')
            if (!file) return
            void file.text().then((value) => {
              try {
                const raw = JSON.parse(value) as unknown
                const inspected = inspectBackup(raw)
                if (!inspected.ok) {
                  setError(inspected.errors.map((item) => item.message).join(' '))
                  return
                }
                setRestoreRaw(raw)
                setRestoreSummary(`备份于 ${formatDateTime(new Date(inspected.file.exported_at))}，${inspected.file.cards.length} 张词卡，${inspected.file.reviewLogs.length} 条复习记录。`)
              } catch {
                setError('这个文件不是有效的 JSON。')
              }
            })
          }}
        />
        {restoreSummary && <p>{restoreSummary}</p>}
        {restoreRaw !== null && (
          <label className="check-line">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>我明白这将替换这台设备上的全部学习数据。</span>
          </label>
        )}
        <button
          type="button"
          className="btn danger"
          data-testid="restore-confirm"
          disabled={!confirmed || restoreRaw === null || busy}
          onClick={() => {
            setBusy(true)
            void restoreBackup(restoreRaw)
              .then(() => {
                setNotice('已从备份恢复。')
                setRestoreRaw(null)
                setRestoreSummary('')
                setConfirmed(false)
              })
              .catch((caught: unknown) => setError(messageOf(caught)))
              .finally(() => setBusy(false))
          }}
        >
          替换并恢复
        </button>
      </section>
      <section className="panel">
        <h2>安装到 iPad</h2>
        <ol className="steps">
          <li>用 Safari 打开这个页面，不要用微信或 Chrome 的内置窗口。</li>
          <li>点底部分享按钮，选「添加到主屏幕」。</li>
          <li>从主屏幕图标打开。之后即使没有网络，也可以学习和导入已经打开过的页面。</li>
        </ol>
      </section>
      {notice && <p className="banner">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  )
}

function Stepper({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <button type="button" aria-label={`减少${label}`} onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <strong>{value}</strong>
      <button type="button" aria-label={`增加${label}`} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  )
}
