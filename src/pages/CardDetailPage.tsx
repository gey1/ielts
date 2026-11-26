import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cardTypeLabel, MASTERED_STABILITY_DAYS } from '../domain/constants.ts'
import { formatDateTime, toDateTimeLocal } from '../domain/time.ts'
import { deleteCard } from '../services/library/library.ts'
import { masteryOf, SRS_NEW } from '../services/srs/engine.ts'
import { rescheduleCard, resetCard } from '../services/srs/repository.ts'
import { BlocksView } from '../ui/BlocksView.tsx'
import { messageOf } from '../ui/download.ts'
import { Modal } from '../ui/Modal.tsx'
import { useIndexed, useSnapshot } from '../ui/useSnapshot.ts'

const STATUS = { new: '新卡片', learning: '学习中', mastered: '已掌握' } as const

export function CardDetailPage() {
  const { id = '' } = useParams()
  const snapshot = useSnapshot()
  const indexed = useIndexed(snapshot)
  const navigate = useNavigate()
  const [due, setDue] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'delete' | 'reset' | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)

  if (!snapshot || !indexed) return null
  const card = snapshot.cards.find((item) => item.id === id)
  if (!card) {
    return (
      <section className="page narrow">
        <h1>找不到这张卡片</h1>
        <Link to="/cards">返回词卡</Link>
      </section>
    )
  }
  const blocks = indexed.blocksByCard.get(card.id) ?? []
  const record = indexed.recallByCard.get(card.id)
  const status = masteryOf(record)
  const collections = (indexed.collectionIdsByCard.get(card.id) ?? [])
    .map((collectionId) => indexed.collectionById.get(collectionId)?.name)
    .filter((name): name is string => Boolean(name))
  const tags = (indexed.tagIdsByCard.get(card.id) ?? [])
    .map((tagId) => indexed.tagById.get(tagId)?.name)
    .filter((name): name is string => Boolean(name))
  const dueValue = due || (record && record.state !== SRS_NEW ? toDateTimeLocal(new Date(record.due)) : '')

  async function saveDue() {
    setError('')
    const next = new Date(dueValue)
    if (Number.isNaN(next.getTime())) {
      setError('请选一个有效的时间。')
      return
    }
    try {
      await rescheduleCard(card!.id, next)
      setShowSchedule(false)
    } catch (caught) {
      setError(messageOf(caught))
    }
  }

  return (
    <section className="page narrow">
      <p className="kicker"><Link to="/cards">词卡</Link></p>
      <article className="card-sheet">
        <p className="type-line">
          <span>{cardTypeLabel(card.type)}</span>
          <span>{STATUS[status]}</span>
        </p>
        <h1 className={card.frontText.length > 48 ? 'front long' : 'front'} lang="en">{card.frontText}</h1>
        <BlocksView blocks={blocks} backText={card.backText} side="front" />
        {card.backText && <p className="back-text" lang="zh-CN">{card.backText}</p>}
        <BlocksView blocks={blocks} backText={card.backText} side="back" />
        {(collections.length > 0 || tags.length > 0) && (
          <p className="muted">{[...collections, ...tags].join(' · ')}</p>
        )}
      </article>
      <section className="panel memory">
        <h2>记忆</h2>
        {status === 'new' || !record || record.state === SRS_NEW ? (
          <p>还没有复习过。第一次学习之后，可以改下次出现的日期，或把进度重置。</p>
        ) : (
          <>
            <p>下次复习 {formatDateTime(new Date(record.due))}。</p>
            <p className="muted">
              掌握的标准是进入复习阶段，并且稳定度至少 {MASTERED_STABILITY_DAYS} 天。认出这个词不会算成掌握。
            </p>
            <button type="button" className="btn ghost small" onClick={() => setShowSchedule((value) => !value)}>
              {showSchedule ? '收起排程' : '排程细节'}
            </button>
            {showSchedule && (
              <p className="muted">
                稳定度 {record.stability.toFixed(1)} 天 · 难度 {record.difficulty.toFixed(1)} · 复习 {record.reps} 次 · 忘记 {record.lapses} 次
              </p>
            )}
            <label className="field">
              <span>调整下次复习</span>
              <input type="datetime-local" value={dueValue} onChange={(event) => setDue(event.target.value)} />
            </label>
            <div className="cluster">
              <button type="button" className="btn small" onClick={() => void saveDue()}>保存日期</button>
              <button type="button" className="btn small ghost" onClick={() => setMode('reset')}>重置为新卡片</button>
            </div>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </section>
      <div className="cluster">
        <Link className="btn primary" to={`/cards/${card.id}/edit`}>编辑</Link>
        <button type="button" className="btn danger" onClick={() => setMode('delete')}>删除</button>
      </div>
      {mode === 'delete' && (
        <Modal title="删除这张卡片？">
          <p>「{card.frontText}」和它的复习记录会从这台设备上删掉。</p>
          <div className="cluster">
            <button
              type="button"
              className="btn danger"
              onClick={() => void deleteCard(card.id).then(() => navigate('/cards'))}
            >
              删除
            </button>
            <button type="button" className="btn ghost" onClick={() => setMode(null)}>取消</button>
          </div>
        </Modal>
      )}
      {mode === 'reset' && (
        <Modal title="重置学习进度？">
          <p>排程会回到新卡片。过去的复习记录还留在进展里，但这张卡不再算已掌握，也不会出现在到期列表里，直到你再次学习它。</p>
          <div className="cluster">
            <button
              type="button"
              className="btn primary"
              onClick={() => void resetCard(card.id).then(() => setMode(null))}
            >
              重置
            </button>
            <button type="button" className="btn ghost" onClick={() => setMode(null)}>取消</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
