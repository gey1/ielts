import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BLOCK_LABELS, cardTypeLabel } from '../domain/constants.ts'
import { BLOCK_TYPES, CARD_TYPES } from '../domain/types.ts'
import { saveCard } from '../services/library/library.ts'
import { messageOf } from '../ui/download.ts'
import { useIndexed, useSnapshot } from '../ui/useSnapshot.ts'

interface DraftBlock {
  key: string
  type: string
  custom: string
  content: string
}

function blankBlock(): DraftBlock {
  return { key: crypto.randomUUID(), type: 'definition', custom: '', content: '' }
}

export function CardFormPage() {
  const { id } = useParams()
  const creating = !id
  const snapshot = useSnapshot()
  const indexed = useIndexed(snapshot)
  const navigate = useNavigate()
  const [type, setType] = useState('vocabulary')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [blocks, setBlocks] = useState<DraftBlock[]>([])
  const [collectionIds, setCollectionIds] = useState<string[]>([])
  const [tags, setTags] = useState('')
  const [newCollection, setNewCollection] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!snapshot || !indexed || loaded) return
    if (!creating && id) {
      const card = snapshot.cards.find((item) => item.id === id)
      if (!card) return
      setType(card.type)
      setFront(card.frontText)
      setBack(card.backText)
      setCollectionIds(indexed.collectionIdsByCard.get(card.id) ?? [])
      setTags((indexed.tagIdsByCard.get(card.id) ?? []).map((tagId) => indexed.tagById.get(tagId)?.name ?? '').filter(Boolean).join('，'))
      setBlocks((indexed.blocksByCard.get(card.id) ?? []).map((block) => ({
        key: block.id,
        type: (BLOCK_TYPES as readonly string[]).includes(block.type) ? block.type : 'other',
        custom: (BLOCK_TYPES as readonly string[]).includes(block.type) ? '' : block.type,
        content: block.content,
      })))
    }
    setLoaded(true)
  }, [snapshot, indexed, loaded, creating, id])

  if (!snapshot || !indexed) return null
  if (!creating && id && loaded && !snapshot.cards.some((card) => card.id === id)) {
    return (
      <section className="page narrow">
        <h1>找不到这张卡片</h1>
        <Link to="/cards">返回词卡</Link>
      </section>
    )
  }

  function toggleCollection(collectionId: string) {
    setCollectionIds((current) => current.includes(collectionId)
      ? current.filter((item) => item !== collectionId)
      : [...current, collectionId])
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved = await saveCard({
        type,
        frontText: front,
        backText: back,
        collectionIds,
        tagNames: tags.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
        newCollectionName: newCollection,
        blocks: blocks.map((block) => ({
          type: block.type === 'other' ? block.custom : block.type,
          content: block.content,
        })),
      }, creating ? undefined : id)
      navigate(`/cards/${saved}`)
    } catch (caught) {
      setError(messageOf(caught))
      setSaving(false)
    }
  }

  return (
    <section className="page narrow">
      <p className="kicker"><Link to="/cards">词卡</Link></p>
      <h1>{creating ? '新建词卡' : '编辑词卡'}</h1>
      <form className="stack" onSubmit={(event) => void onSubmit(event)}>
        <label className="field">
          <span>类型</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {CARD_TYPES.map((item) => (
              <option key={item} value={item}>{cardTypeLabel(item)}</option>
            ))}
            {!(CARD_TYPES as readonly string[]).includes(type) && <option value={type}>{type}</option>}
          </select>
        </label>
        <label className="field">
          <span>正面</span>
          <textarea data-testid="front-input" lang="en" rows={2} value={front} onChange={(event) => setFront(event.target.value)} required />
        </label>
        <label className="field">
          <span>背面</span>
          <textarea data-testid="back-input" lang="zh-CN" rows={2} value={back} onChange={(event) => setBack(event.target.value)} placeholder="中文释义，或改写后的英文" />
        </label>
        <fieldset className="field">
          <legend>收入词集</legend>
          <div className="checks">
            {snapshot.collections.map((collection) => (
              <label key={collection.id}>
                <input
                  type="checkbox"
                  checked={collectionIds.includes(collection.id)}
                  onChange={() => toggleCollection(collection.id)}
                />
                <span>{collection.name}</span>
                {collection.nameEn && <small>{collection.nameEn}</small>}
              </label>
            ))}
          </div>
          <input
            value={newCollection}
            onChange={(event) => setNewCollection(event.target.value)}
            placeholder="或新建一个词集，随这张卡一起保存"
            aria-label="新词集"
          />
        </fieldset>
        <label className="field">
          <span>标签</span>
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="用逗号分开，例如 writing，speaking" />
        </label>
        <div className="stack">
          <div className="row">
            <h2>内容</h2>
            <button type="button" className="btn small" onClick={() => setBlocks((current) => [...current, blankBlock()])}>
              添加一段
            </button>
          </div>
          {blocks.map((block, index) => (
            <div key={block.key} className="block-edit">
              <div className="row">
                <select
                  value={block.type}
                  aria-label="内容类型"
                  onChange={(event) => setBlocks((current) => current.map((item) => item.key === block.key ? { ...item, type: event.target.value } : item))}
                >
                  {BLOCK_TYPES.map((item) => (
                    <option key={item} value={item}>{BLOCK_LABELS[item]}</option>
                  ))}
                  <option value="other">其他</option>
                </select>
                <button type="button" className="btn small ghost" onClick={() => setBlocks((current) => current.filter((item) => item.key !== block.key))}>
                  移除
                </button>
              </div>
              {block.type === 'other' && (
                <input
                  value={block.custom}
                  aria-label="自定义类型"
                  placeholder="类型名称，例如 band_tip"
                  onChange={(event) => setBlocks((current) => current.map((item) => item.key === block.key ? { ...item, custom: event.target.value } : item))}
                />
              )}
              <textarea
                rows={3}
                aria-label={`内容 ${index + 1}`}
                value={block.content}
                onChange={(event) => setBlocks((current) => current.map((item) => item.key === block.key ? { ...item, content: event.target.value } : item))}
              />
            </div>
          ))}
          <p className="muted">空的段落不会保存。内容按文字显示，不会执行 HTML。</p>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn primary" data-testid="save-card" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
          <Link className="btn ghost" to={creating ? '/cards' : `/cards/${id}`}>取消</Link>
        </div>
      </form>
    </section>
  )
}
