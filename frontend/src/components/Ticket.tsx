import type { PlayerTicket, PrizeWinner } from '../types/game'

const ticketPrizes = ['Early Five', 'Top Line', 'Middle Line', 'Bottom Line', 'Full House']

type Props = {
  ticket: PlayerTicket
  selectedNumbers: number[]
  winners: Record<string, PrizeWinner>
  claimingPrize: string | null
  isSelected: boolean
  isPrintTarget: boolean
  onSelect: () => void
  onPrint: () => void
  onToggleNumber: (number: number) => void
  onClaim: (ticketId: number, prizeName: string) => void
}

export default function Ticket({
  ticket,
  selectedNumbers,
  winners,
  claimingPrize,
  isSelected,
  isPrintTarget,
  onSelect,
  onPrint,
  onToggleNumber,
  onClaim,
}: Props) {
  const selected = new Set(selectedNumbers)
  const markedCount = selectedNumbers.length

  return (
    <section className={`panel ticket-panel player-ticket-panel ${isSelected ? 'ticket-selected' : ''} ${isPrintTarget ? 'print-target' : ''}`}>
      <div className="ticket-header">
        <div className="ticket-identity">
          <label className="ticket-select">
            <input type="radio" name="selected-ticket" checked={isSelected} onChange={onSelect} />
            <span className="ticket-radio" aria-hidden="true" />
          </label>
          <div>
            <p className="eyebrow">PLAYER TICKET</p>
            <h2>{ticket.playerName}</h2>
            <p className="ticket-number-label">Ticket #{ticket.ticketNumber}{ticket.contactNumber ? ` · ${ticket.contactNumber}` : ""}</p>
          </div>
        </div>
        <div className="ticket-tools">
          <span className="count-pill">{markedCount} / 15</span>
          <button type="button" className="small-action" onClick={onPrint} title="Print this ticket">Print</button>
        </div>
      </div>
      <div className="ticket-grid" role="grid" aria-label={`Tambola ticket for ${ticket.playerName}`}>
        {ticket.numbers.flatMap((row, r) => row.map((number, c) => (
          <button
            type="button"
            key={`${r}-${c}`}
            className={[
              'ticket-cell',
              number < 0 ? 'disabled-number' : '',
              number > 0 && selected.has(number) ? 'marked' : '',
            ].filter(Boolean).join(' ')}
            disabled={number < 0}
            aria-pressed={number > 0 ? selected.has(number) : undefined}
            aria-label={`${Math.abs(number)}${number < 0 ? ', disabled' : selected.has(number) ? ', selected' : ''}`}
            onClick={() => number > 0 && onToggleNumber(number)}
          >
            <span className={number < 0 ? 'ticket-number disabled-ticket-number' : 'ticket-number'}>{Math.abs(number)}</span>{number < 0 && <span className="disabled-cross" aria-hidden="true" />}
          </button>
        )))}
      </div>
      <div className="ticket-prize-actions">
        <div className="ticket-prize-title"><span>Prize claims</span><small>Manual marking only</small></div>
        <div className="ticket-prize-buttons">
          {ticketPrizes.map(prize => {
            const winner = winners[prize]
            const isWinner = winner?.ticketId === ticket.id
            return (
              <button
                key={prize}
                className={`button ${isWinner ? 'button-primary' : 'button-secondary'} ticket-prize-button`}
                disabled={Boolean(winner) || claimingPrize !== null}
                onClick={() => onClaim(ticket.id, prize)}
                title={winner ? `${winner.playerName} won this prize` : `Claim ${prize}`}
              >
                {winner ? (isWinner ? `✓ ${prize}` : `${prize} — Claimed`) : prize}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
