type Props = {
  calledNumbers: number[]
  onShowHistory?: () => void
}

export default function NumberBoard({ calledNumbers, onShowHistory }: Props) {
  const current = calledNumbers.at(-1) ?? null
  const previous = calledNumbers.at(-2) ?? null

  return (
    <section className="panel draw-panel">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">LIVE DRAW</p>
          <h2>Number board</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onShowHistory}
          aria-label="Show draw history"
          title="Show draw history"
        >
          ☷
        </button>
      </div>
      <div className="draw-values">
        <div className="draw-value current">
          <span>Current draw</span>
          <strong>{current ?? '—'}</strong>
        </div>
        <div className="draw-value">
          <span>Last draw</span>
          <strong>{previous ?? '—'}</strong>
        </div>
      </div>
      <button type="button" className="history-link" onClick={onShowHistory}>
        View numbers called in order <span aria-hidden="true">→</span>
      </button>
    </section>
  )
}
