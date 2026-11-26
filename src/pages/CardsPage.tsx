import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { cardTypeLabel } from '../domain/constants.ts'
import { CARD_TYPES } from '../domain/types.ts'
import { masteryOf } from '../services/srs/engine.ts'
import { createCollection, deleteCollection, renameCollection } from '../services/library/library.ts'
import { messageOf } from '../ui/download.ts'
import { Modal } from '../ui/Modal.tsx'
import { useIndexed, useSnapshot } from '../ui/useSnapshot.ts'

const STATUS_LABEL = { new: '新', learning: '学习中', mastered: '已掌握' } as const

export function CardsPage() {
  const snapshot = useSnapshot()
  const indexed = useIndexed(snapshot)
  const [params, setParams] = useSearchParams()
  const [collectionName, setCollectionName] = useState('')
  const [rename, setRename] = useState('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const query = params.get('q') ?? ''
  const collectionId = params.get('collection') ?? ''
  const typeFilter = params.get('type') ?? ''
  const tagId = params.get('tag') ?? ''

  const filtered = useMemo(() => {
    if (!snapshot || !indexed) return []
    const needle = query.trim().toLowerCase()
    return snapshot.cards
      .filter((card) => {
        if (collectionId && !(indexed.collectionIdsByCard.get(card.id) ?? []).includes(collectionId)) return false
        if (typeFilter && card.type !== typeFilter) return false
        if (tagId && !(indexed.tagIdsByCard.get(card.id) ?? []).includes(tagId)) return false
        if (!needle) return true
        const blocks = indexed.blocksByCard.get(card.id) ?? []
        const tags = (indexed.tagIdsByCard.get(card.id) ?? []).map((id) => indexed.tagById.get(id)?.name ?? '')
        const haystack = [card.frontText, card.backText, card.type, ...blocks.map((block) => block.content), ...tags]
          .join('\n')
          .toLowerCase()
        return haystack.includes(needle)
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [snapshot, indexed, query, collectionId, typeFilter, tagId])

  if (!snapshot || !indexed) return null
  const selected = snapshot.collections.find((item) => item.id === collectionId)
  const counts = new Map<string, number>()
  for (const link of snapshot.cardCollections) {
    counts.set(link.collectionId, (counts.get(link.collectionId) ?? 0) + 1)
  }

  function update(next: Record<string, string>) {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value)
      else merged.delete(key)
    }
    setParams(merged)
  }

  async function addCollection() {
    setError('')
    try {
      const id = await createCollection(collectionName)
      setCollectionName('')
      update({ collection: id })
    } catch (caught) {
      setError(messageOf(caught))
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>词卡</h1>
          <p className="lede">按专题整理。预置的十个雅思话题不能改名，自己的词集可以。</p>
        </div>
        <Link className="btn primary" to="/cards/new" data-testid="add-card">新建词卡</Link>
      </div>
      <div className="cards-layout">
        <aside className="collection-nav">
          <button type="button" className={!collectionId ? 'on' : undefined} onClick={() => update({ collection: '' })}>
            全部 <small>{snapshot.cards.length}</small>
          </button>
          {snapshot.collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              className={collection.id === collectionId ? 'on' : undefined}
              onClick={() => update({ collection: collection.id })}
            >
              <span>{collection.name}</span>
              {collection.nameEn && <small>{collection.nameEn}</small>}
              <small>{counts.get(collection.id) ?? 0}</small>
            </button>
          ))}
          <form
            className="inline-create"
            onSubmit={(event) => {
              event.preventDefault()
              void addCollection()
            }}
          >
            <input
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              placeholder="新词集名称"
              aria-label="新词集名称"
            />
            <button type="submit" className="btn small">添加</button>
          </form>
          {error && <p className="error">{error}</p>}
          {selected && !selected.preset && (
            <div className="collection-edit">
              <input value={rename || selected.name} onChange={(event) => setRename(event.target.value)} aria-label="词集名称" />
              <button
                type="button"
                className="btn small"
                onClick={() => void renameCollection(selected.id, rename || selected.name).then(() => setRename(''))}
              >
                改名
              </button>
              <button type="button" className="btn small danger" onClick={() => setConfirmDelete(true)}>删除词集</button>
            </div>
          )}
        </aside>
        <div>
          <div className="filters">
            <input
              data-testid="card-search"
              value={query}
              onChange={(event) => update({ q: event.target.value })}
              placeholder="搜索正面、释义、例句或标签"
              aria-label="搜索词卡"
            />
            <div className="chips">
              <button type="button" className={!typeFilter ? 'chip on' : 'chip'} onClick={() => update({ type: '' })}>全部类型</button>
              {CARD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={typeFilter === type ? 'chip on' : 'chip'}
                  onClick={() => update({ type: typeFilter === type ? '' : type })}
                >
                  {cardTypeLabel(type)}
                </button>
              ))}
            </div>
            {snapshot.tags.length > 0 && (
              <div className="chips">
                {snapshot.tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={tagId === tag.id ? 'chip on' : 'chip'}
                    onClick={() => update({ tag: tagId === tag.id ? '' : tag.id })}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {filtered.length === 0 ? (
            <div className="empty">
              <h2>没有符合的词卡</h2>
              <p>换一个专题，或新建一张。也可以一次导入多张。</p>
              <Link className="btn ghost" to="/import">去导入</Link>
            </div>
          ) : (
            <ul className="list">
              {filtered.map((card) => {
                const status = masteryOf(indexed.recallByCard.get(card.id))
                const tags = (indexed.tagIdsByCard.get(card.id) ?? [])
                  .map((id) => indexed.tagById.get(id)?.name)
                  .filter((name): name is string => Boolean(name))
                return (
                  <li key={card.id}>
                    <Link to={`/cards/${card.id}`} className="list-item">
                      <span className="item-main">
                        <strong lang="en">{card.frontText}</strong>
                        <span lang="zh-CN">{card.backText}</span>
                      </span>
                      <span className="item-meta">
                        <span>{cardTypeLabel(card.type)}</span>
                        <span>{STATUS_LABEL[status]}</span>
                        {tags.length > 0 && <span>{tags.join(' / ')}</span>}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      {confirmDelete && selected && (
        <Modal title="删除这个词集？" labelledBy="delete-collection-title">
          <p>词集「{selected.name}」会去掉，里面的词卡还在，只是不再属于它。</p>
          <div className="cluster">
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                void deleteCollection(selected.id).then(() => {
                  setConfirmDelete(false)
                  update({ collection: '' })
                })
              }}
            >
              删除词集
            </button>
            <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>取消</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
