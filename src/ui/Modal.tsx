import type { ReactNode } from 'react'

export function Modal({
  title,
  children,
  labelledBy = 'modal-title',
}: {
  title: string
  children: ReactNode
  labelledBy?: string
}) {
  return (
    <div className="modal-back" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <h2 id={labelledBy}>{title}</h2>
        {children}
      </div>
    </div>
  )
}
