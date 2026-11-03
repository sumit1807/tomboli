import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { gameApi, roomApi } from './api/gameApi'
import { subscribeRoom } from './api/roomSocket'
import NumberBoard from './components/NumberBoard'
import Ticket from './components/Ticket'
import type { GameState, PlayerTicket, PrizeWinner, RemoteRoomState, RoomSession } from './types/game'
import './styles.css'

type Menu = 'solo' | 'caller' | 'remote'

const prizeList = [
  ['01', 'Early Five', 'Any 5 numbers marked'],
  ['02', 'Top Line', 'Complete the top row'],
  ['03', 'Middle Line', 'Complete the middle row'],
  ['04', 'Bottom Line', 'Complete the bottom row'],
  ['05', 'Full House', 'All 15 numbers marked'],
] as const

function App() {
  const [menu, setMenu] = useState<Menu>('solo')
  const [game, setGame] = useState<GameState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showTicketSetup, setShowTicketSetup] = useState(false)
  const [ticketSetupStep, setTicketSetupStep] = useState<1 | 2>(1)
  const [playerCount, setPlayerCount] = useState(1)
  const [playerRegistrations, setPlayerRegistrations] = useState<Array<{ name: string; contact: string }>>([{ name: '', contact: '' }])
  const [tickets, setTickets] = useState<PlayerTicket[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [printingMode, setPrintingMode] = useState<'single' | 'all' | null>(null)
  const [printingTicketId, setPrintingTicketId] = useState<number | null>(null)
  const [winners, setWinners] = useState<Record<string, PrizeWinner>>({})
  const [claimingPrize, setClaimingPrize] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [selectedNumbers, setSelectedNumbers] = useState<Record<number, number[]>>({})
  const [showHistory, setShowHistory] = useState(false)
  const [remoteSession, setRemoteSession] = useState<RoomSession | null>(() => {
    try { return JSON.parse(localStorage.getItem('tomboli.remoteSession') ?? 'null') as RoomSession | null }
    catch { return null }
  })
  const [remoteRoom, setRemoteRoom] = useState<RemoteRoomState | null>(null)
  const [remoteBusy, setRemoteBusy] = useState(false)
  const [remoteSelectedNumbers, setRemoteSelectedNumbers] = useState<number[]>([])

  const refresh = useCallback(async () => {
    try {
      const [nextGame, nextTickets, nextWinners] = await Promise.all([
        gameApi.state(), gameApi.tickets(), gameApi.winners(),
      ])
      setGame(nextGame)
      setTickets(nextTickets)
      setWinners(nextWinners)
      setError('')
      if (nextTickets.length) setSelectedTicketId(current => current ?? nextTickets[0].id)
    } catch {
      setError('Cannot connect to the game server. Start the Spring Boot backend on port 8080.')
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (remoteSession) localStorage.setItem('tomboli.remoteSession', JSON.stringify(remoteSession))
    else localStorage.removeItem('tomboli.remoteSession')
  }, [remoteSession])

  useEffect(() => {
    if (menu !== 'remote' || !remoteSession) return
    let active = true
    void roomApi.state(remoteSession.roomCode).then(state => { if (active) setRemoteRoom(state) }).catch(e => {
      if (active) setError(e instanceof Error ? e.message : 'Remote room is unavailable.')
    })
    const unsubscribe = subscribeRoom(remoteSession.roomCode, state => {
      if (active) setRemoteRoom(state)
    }, status => {
      if (active && status === 'error') setError('Live connection interrupted. Reconnecting may be required.')
    })
    return () => { active = false; unsubscribe() }
  }, [menu, remoteSession])

  useEffect(() => {
    if (printingMode === null) return
    const timer = window.setTimeout(() => {
      window.print()
      setPrintingMode(null)
      setPrintingTicketId(null)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [printingMode])

  async function act(action: () => Promise<GameState>) {
    setBusy(true)
    setError('')
    try {
      setGame(await action())
      if (action === gameApi.start || action === gameApi.reset) {
        setTickets([])
        setWinners({})
        setSelectedNumbers({})
        setSelectedTicketId(null)
        setNotice('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const running = game?.status === 'RUNNING'
  const paused = game?.status === 'PAUSED'
  const finished = game?.status === 'FINISHED'

  function openTicketSetup() {
    const count = Math.max(1, Math.min(10, playerCount))
    setPlayerCount(count)
    setPlayerRegistrations(Array.from({ length: count }, (_, index) => playerRegistrations[index] ?? { name: '', contact: '' }))
    setTicketSetupStep(1)
    setShowTicketSetup(true)
  }

  function continueToRegistration() {
    const count = Math.max(1, Math.min(10, playerCount))
    setPlayerCount(count)
    setPlayerRegistrations(current => Array.from({ length: count }, (_, index) => current[index] ?? { name: '', contact: '' }))
    setTicketSetupStep(2)
  }

  async function registerPlayers() {
    const registrations = playerRegistrations.map(item => ({ name: item.name.trim(), contact: item.contact.trim() }))
    if (registrations.some(item => !item.name)) {
      setError('Please enter a name for every player. Contact number is optional.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const createdTickets: PlayerTicket[] = []
      for (const player of registrations) {
        createdTickets.push(await gameApi.createTicket(player.name, player.contact))
      }
      setTickets(current => [...current, ...createdTickets])
      setSelectedNumbers(current => ({ ...current, ...Object.fromEntries(createdTickets.map(ticket => [ticket.id, []])) }))
      setSelectedTicketId(createdTickets[0]?.id ?? null)
      setShowTicketSetup(false)
      setNotice(`${createdTickets.length} ticket${createdTickets.length === 1 ? '' : 's'} registered. You can print all tickets together or print an individual ticket.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register the players.')
    } finally {
      setBusy(false)
    }
  }

  function updateRegistration(index: number, field: 'name' | 'contact', value: string) {
    setPlayerRegistrations(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  }

  function printSingle(ticketId: number) {
    setPrintingTicketId(ticketId)
    setPrintingMode('single')
  }

  function printAllTickets() {
    if (!tickets.length) return
    setPrintingTicketId(null)
    setPrintingMode('all')
  }

  function toggleNumber(ticketId: number, number: number) {
    setSelectedNumbers(current => {
      const existing = new Set(current[ticketId] ?? [])
      if (existing.has(number)) existing.delete(number)
      else existing.add(number)
      return { ...current, [ticketId]: [...existing].sort((a, b) => a - b) }
    })
  }

  async function claimPrize(ticketId: number, prizeName: string) {
    setClaimingPrize(prizeName)
    setError('')
    setNotice('')
    try {
      const result = await gameApi.claimPrize(ticketId, prizeName)
      setNotice(result.message)
      setWinners(await gameApi.winners())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim this prize.')
    } finally {
      setClaimingPrize(null)
    }
  }

  const currentTicket = tickets.find(ticket => ticket.id === selectedTicketId) ?? null

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Tomboli home">
          <span className="brand-mark">T</span>
          <span>Tomboli<span className="brand-dot">.</span></span>
        </a>
        <nav className="main-menu" aria-label="Game menu">
          <button type="button" className={menu === 'solo' ? 'menu-item active' : 'menu-item'} onClick={() => setMenu('solo')}>
            <span className="menu-icon">♙</span> Solo Player
          </button>
          <button type="button" className={menu === 'caller' ? 'menu-item active' : 'menu-item'} onClick={() => setMenu('caller')}>
            <span className="menu-icon">◉</span> Game Caller
          </button>
          <button type="button" className={menu === 'remote' ? 'menu-item active' : 'menu-item'} onClick={() => setMenu('remote')}>
            <span className="menu-icon">⌁</span> Remote Room
          </button>
        </nav>
        <div className="topbar-right">
          <span className="free-pill"><span className="status-dot" /> FREE SOCIAL GAME</span>
          <span className="profile-avatar">G</span>
        </div>
      </header>

      <section className="hero compact-hero">
        <div className="hero-copy">
          <p className="eyebrow">{menu === 'solo' ? 'SOLO PLAYER' : menu === 'caller' ? 'GAME CALLER' : 'REMOTE ROOM'}</p>
          <h1>{menu === 'solo' ? <>Your ticket.<br /><span>Your moment.</span></> : menu === 'caller' ? <>Call the numbers.<br /><span>Run the game.</span></> : <>Play together.<br /><span>From anywhere.</span></>}</h1>
          <p className="hero-description">
            {menu === 'solo'
              ? 'Start a round, choose your ticket, mark numbers yourself, and keep the latest draw in view.'
              : menu === 'caller'
                ? 'Control the draw, watch the winners, and keep the game moving from one compact screen.'
                : 'Create a room, invite players with a room code, and let everyone see the same live draw.'}
          </p>
          <div className="hero-actions">
            {menu !== 'remote' && <button className="button button-primary" disabled={busy} onClick={() => void act(gameApi.start)}>
              {running || paused ? 'Restart game' : 'Start game'} <span aria-hidden="true">↗</span>
            </button>}
            <span className="round-note"><span className="pulse-dot" /> {menu === 'remote' ? (remoteSession ? `Room ${remoteSession.roomCode} connected` : 'Create or join a room below') : running ? 'Round in progress' : paused ? 'Round paused' : finished ? 'Round complete' : 'Ready when you are'}</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="ball ball-main">{game?.lastNumber ?? '90'}</div>
          <div className="ball ball-small ball-a">7</div><div className="ball ball-small ball-b">24</div><div className="ball ball-small ball-c">63</div>
          <div className="spark spark-a">✦</div><div className="spark spark-b">✳</div>
        </div>
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="notice-banner" role="status">{notice}</div>}

      {menu === 'remote' ? (
        <RemoteRoomPanel
          session={remoteSession}
          room={remoteRoom}
          busy={remoteBusy}
          selectedNumbers={remoteSelectedNumbers}
          onSession={session => { setRemoteSession(session); setRemoteSelectedNumbers([]); void roomApi.state(session.roomCode).then(setRemoteRoom) }}
          onLeave={() => { setRemoteSession(null); setRemoteRoom(null); setRemoteSelectedNumbers([]) }}
          onBusy={setRemoteBusy}
          onRoom={setRemoteRoom}
          onError={setError}
          onToggleNumber={number => setRemoteSelectedNumbers(current => current.includes(number) ? current.filter(n => n !== number) : [...current, number].sort((a, b) => a - b))}
        />
      ) : menu === 'solo' ? (
        <section className="solo-layout">
          <div className="main-column">
            <section className="panel solo-step-panel">
              <div className="step-heading"><span className="step-number">1</span><div><p className="eyebrow">GET READY</p><h2>Start the game</h2></div></div>
              <div className="solo-controls">
                <div className="status-card"><span>Game status</span><strong>{running ? 'Running' : paused ? 'Paused' : finished ? 'Finished' : 'Not started'}</strong></div>
                <button className="button button-primary" disabled={busy || !running} onClick={() => void act(gameApi.next)}>Call a number <span aria-hidden="true">→</span></button>
                <button className="button button-secondary" disabled={busy || (!running && !paused)} onClick={() => void act(gameApi.pause)}>{paused ? 'Resume' : 'Pause'}</button>
                <button className="button button-quiet" disabled={busy} onClick={() => void act(gameApi.reset)}>New game</button>
              </div>
            </section>

            <section className="panel create-ticket-panel">
              <div className="step-heading"><span className="step-number">2</span><div><p className="eyebrow">TICKET SETUP</p><h2>Create or select a ticket</h2></div></div>
              <div className="ticket-setup-summary">
                <div><span>Players registered</span><strong>{tickets.length}</strong></div>
                <button className="button button-primary" type="button" disabled={busy || !running} onClick={openTicketSetup}>Select number of players <span aria-hidden="true">↗</span></button>
              </div>
              <p className="helper-text">Choose how many players are joining. Then register each name; contact number is optional.</p>
            </section>

            <section className="player-tickets-section">
              <div className="section-heading">
                <div><p className="eyebrow">STEP 3</p><h2>Select your ticket <span className="ticket-total">{tickets.length}</span></h2></div>
                <div className="print-actions">{tickets.length > 0 && <button type="button" className="button button-secondary print-selected" onClick={printAllTickets}>Print all tickets</button>}{currentTicket && <button type="button" className="button button-primary print-selected" onClick={() => printSingle(currentTicket.id)}>Print selected ticket</button>}</div>
              </div>
              {tickets.length === 0 ? <div className="panel empty-tickets"><p>Start the game and create your first player ticket.</p></div> : tickets.map(ticket => (
                <Ticket
                  key={ticket.id}
                  ticket={ticket}
                  selectedNumbers={selectedNumbers[ticket.id] ?? []}
                  winners={winners}
                  claimingPrize={claimingPrize}
                  isSelected={selectedTicketId === ticket.id}
                  isPrintTarget={printingMode === 'all' || (printingMode === 'single' && printingTicketId === ticket.id)}
                  onSelect={() => setSelectedTicketId(ticket.id)}
                  onPrint={() => printSingle(ticket.id)}
                  onToggleNumber={number => toggleNumber(ticket.id, number)}
                  onClaim={(ticketId, prizeName) => void claimPrize(ticketId, prizeName)}
                />
              ))}
            </section>
          </div>

          <aside className="side-column">
            {game && <NumberBoard calledNumbers={game.calledNumbers} onShowHistory={() => setShowHistory(true)} />}
            <WinnersPanel winners={winners} />
          </aside>
        </section>
      ) : (
        <section className="caller-layout">
          <div className="caller-main">
            <section className="panel caller-control-panel">
              <div><p className="eyebrow">CALLER CONTROL</p><h2>Draw the next number</h2><p className="muted">Numbers are never marked automatically on a player ticket.</p></div>
              <div className="caller-current"><span>Current</span><strong>{game?.lastNumber ?? '—'}</strong></div>
              <div className="call-actions">
                <button className="button button-primary" disabled={busy || !running} onClick={() => void act(gameApi.next)}>Call next number <span aria-hidden="true">→</span></button>
                <button className="button button-secondary" disabled={busy || (!running && !paused)} onClick={() => void act(gameApi.pause)}>{paused ? 'Resume' : 'Pause'}</button>
                <button className="button button-quiet" disabled={busy} onClick={() => void act(gameApi.reset)}>New game</button>
              </div>
            </section>
            {game && <NumberBoard calledNumbers={game.calledNumbers} onShowHistory={() => setShowHistory(true)} />}
            <WinnersPanel winners={winners} />
          </div>
          <aside className="panel caller-help">
            <p className="eyebrow">PLAYER FLOW</p><h2>How it works</h2>
            <ol><li>Start a new game.</li><li>Create player tickets.</li><li>Players select numbers manually.</li><li>Call numbers one at a time.</li><li>Claim the first completed prize.</li></ol>
          </aside>
        </section>
      )}

      {showTicketSetup && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowTicketSetup(false)}>
          <section className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-setup-title" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">TICKET REGISTRATION · STEP {ticketSetupStep} OF 2</p><h2 id="ticket-setup-title">{ticketSetupStep === 1 ? 'How many players?' : 'Register the players'}</h2></div>
              <button type="button" className="icon-button" onClick={() => setShowTicketSetup(false)} aria-label="Close ticket setup">×</button>
            </div>
            {ticketSetupStep === 1 ? (
              <form onSubmit={event => { event.preventDefault(); continueToRegistration() }}>
                <p className="muted">Select the number of players who will receive tickets for this round.</p>
                <label className="field-label" htmlFor="player-count">Number of players</label>
                <select id="player-count" className="player-count-select" value={playerCount} onChange={event => setPlayerCount(Number(event.target.value))}>
                  {Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} player{index === 0 ? '' : 's'}</option>)}
                </select>
                <div className="modal-actions"><button type="submit" className="button button-primary">Continue to registration →</button></div>
              </form>
            ) : (
              <form onSubmit={event => { event.preventDefault(); void registerPlayers() }}>
                <p className="muted">Enter a name for each ticket. Contact number is optional and can be left blank.</p>
                <div className="registration-list">
                  {playerRegistrations.map((player, index) => (
                    <div className="registration-row" key={index}>
                      <span className="registration-index">{String(index + 1).padStart(2, '0')}</span>
                      <div className="registration-fields">
                        <input value={player.name} onChange={event => updateRegistration(index, 'name', event.target.value)} placeholder={`Player ${index + 1} name`} maxLength={40} required />
                        <input value={player.contact} onChange={event => updateRegistration(index, 'contact', event.target.value)} placeholder="Contact number (optional)" maxLength={20} inputMode="tel" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setTicketSetupStep(1)}>← Back</button><button type="submit" className="button button-primary" disabled={busy}>Register {playerCount} ticket{playerCount === 1 ? '' : 's'} →</button></div>
              </form>
            )}
          </section>
        </div>
      )}

      <footer className="footer"><span>© Tomboli Online · Prototype v0.2</span><span>Made for good times <span className="heart">♥</span></span></footer>

      {showHistory && game && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowHistory(false)}>
          <section className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={event => event.stopPropagation()}>
            <div className="modal-header"><div><p className="eyebrow">DRAW HISTORY</p><h2 id="history-title">Numbers called in order</h2></div><button type="button" className="icon-button" onClick={() => setShowHistory(false)} aria-label="Close draw history">×</button></div>
            <div className="history-order">
              {game.calledNumbers.length === 0 ? <p className="muted">No numbers have been called yet.</p> : game.calledNumbers.map((number, index) => <span className={index === game.calledNumbers.length - 1 ? 'history-number latest' : 'history-number'} key={`${number}-${index}`}><small>{index + 1}</small>{number}</span>)}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function RemoteRoomPanel({
  session,
  room,
  busy,
  selectedNumbers,
  onSession,
  onLeave,
  onBusy,
  onRoom,
  onError,
  onToggleNumber,
}: {
  session: RoomSession | null
  room: RemoteRoomState | null
  busy: boolean
  selectedNumbers: number[]
  onSession: (session: RoomSession) => void
  onLeave: () => void
  onBusy: (value: boolean) => void
  onRoom: (room: RemoteRoomState | null) => void
  onError: (value: string) => void
  onToggleNumber: (number: number) => void
}) {
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)
  const prizeNames = ['Early Five', 'Top Line', 'Middle Line', 'Bottom Line', 'Full House']

  async function createRoom(event: FormEvent) {
    event.preventDefault()
    onBusy(true); onError('')
    try { onSession(await roomApi.create(name, contact)); setMode('home') }
    catch (e) { onError(e instanceof Error ? e.message : 'Could not create the room.') }
    finally { onBusy(false) }
  }
  async function joinRoom(event: FormEvent) {
    event.preventDefault()
    onBusy(true); onError('')
    try { onSession(await roomApi.join(roomCode.trim().toUpperCase(), name, contact)); setMode('home') }
    catch (e) { onError(e instanceof Error ? e.message : 'Could not join the room.') }
    finally { onBusy(false) }
  }
  async function hostAction(action: () => Promise<RemoteRoomState>) {
    if (!session) return
    onBusy(true); onError('')
    try { onRoom(await action()) }
    catch (e) { onError(e instanceof Error ? e.message : 'Remote room action failed.') }
    finally { onBusy(false) }
  }
  async function claim(ticketId: number, prize: string) {
    if (!session) return
    setClaiming(prize); onError('')
    try { await roomApi.claimPrize(session.roomCode, session.token, ticketId, prize) }
    catch (e) { onError(e instanceof Error ? e.message : 'Could not claim the prize.') }
    finally { setClaiming(null) }
  }
  function printTicket(ticketId: number) {
    const ticket = room?.tickets.find(t => t.id === ticketId)
    if (!ticket) return
    const rows = ticket.numbers.map(row => `<tr>${row.map(n => `<td class="${n < 0 ? 'disabled-number' : ''}"><span class="ticket-number">${Math.abs(n)}</span>${n < 0 ? '<span class="disabled-cross"></span>' : ''}</td>`).join('')}</tr>`).join('')
    const win = window.open('', '_blank', 'width=800,height=650')
    if (!win) return
    win.document.write(`<html><head><title>Tomboli Ticket ${ticket.ticketNumber}</title><style>body{font-family:Arial;padding:30px}table{border-collapse:collapse;margin-top:20px}td{border:1px solid #777;width:55px;height:55px;text-align:center;font-size:22px;font-weight:700;position:relative}td.disabled-number{background:#f1f3f0;color:#777}td.disabled-number .ticket-number{text-decoration:line-through;text-decoration-thickness:2px}td .disabled-cross{position:absolute;left:8px;right:8px;top:50%;height:2px;background:#777;display:block;transform:rotate(45deg)}td .disabled-cross:after{content:'';position:absolute;inset:0;background:#777;transform:rotate(90deg)}h1{margin:0 0 6px}</style></head><body><h1>${ticket.playerName}</h1><div>Ticket #${ticket.ticketNumber}</div><table>${rows}</table></body></html>`)
    win.document.close(); win.print()
  }

  if (!session) {
    return <section className="remote-home-layout">
      <section className="panel remote-welcome">
        <p className="eyebrow">REMOTE PLAYER</p>
        <h2>Play with friends from different devices</h2>
        <p className="muted">One player hosts the room and calls the numbers. Every joined player sees the same draw, players and winners in real time.</p>
        <div className="remote-choice-grid">
          <button className="remote-choice" onClick={() => setMode('create')}><span>＋</span><strong>Create room</strong><small>Host the game and invite players</small></button>
          <button className="remote-choice" onClick={() => setMode('join')}><span>↗</span><strong>Join room</strong><small>Enter the room code from your host</small></button>
        </div>
      </section>
      {(mode === 'create' || mode === 'join') && <section className="panel remote-form-panel">
        <div className="section-heading"><div><p className="eyebrow">{mode === 'create' ? 'HOST A GAME' : 'JOIN A GAME'}</p><h2>{mode === 'create' ? 'Create a room' : 'Join a room'}</h2></div></div>
        <form onSubmit={mode === 'create' ? createRoom : joinRoom} className="remote-form">
          {mode === 'join' && <label><span>Room code</span><input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="e.g. 7KQ2MD" maxLength={6} required /></label>}
          <label><span>Your name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Player name" maxLength={40} required /></label>
          <label><span>Contact number <small>(optional)</small></span><input value={contact} onChange={e => setContact(e.target.value)} placeholder="Optional" maxLength={20} inputMode="tel" /></label>
          <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setMode('home')}>Back</button><button type="submit" className="button button-primary" disabled={busy}>{mode === 'create' ? 'Create room' : 'Join room'} →</button></div>
        </form>
      </section>}
    </section>
  }

  const ownTicket = room?.tickets.find(t => t.id === session.player.ticketId) ?? null
  const isHost = session.player.host
  const current = room?.currentNumber ?? null
  const last = room?.lastNumber ?? null
  const winners = room?.winners ?? {}

  return <section className="remote-room-layout">
    <div className="remote-main">
      <section className="panel remote-room-header">
        <div><p className="eyebrow">ROOM CODE</p><div className="room-code-big">{session.roomCode}</div><p className="muted">Share this code with your players. Host: <strong>{room?.hostName}</strong></p></div>
        <div className="remote-room-actions"><span className="room-status"><span className="pulse-dot" /> {room?.status ?? 'Connecting'}</span><button className="button button-quiet" onClick={onLeave}>Leave room</button></div>
      </section>

      <section className="panel remote-draw-panel">
        <div className="remote-draw-value current"><span>Current draw</span><strong>{current ?? '—'}</strong></div>
        <div className="remote-draw-value"><span>Last draw</span><strong>{last ?? '—'}</strong></div>
        <button className="history-bubble" type="button" onClick={() => setShowHistory(true)} title="View draw history">↕</button>
        {isHost && <div className="remote-host-controls"><button className="button button-primary" disabled={busy || room?.status !== 'RUNNING'} onClick={() => void hostAction(() => roomApi.next(session.roomCode, session.token))}>Call next number →</button><button className="button button-secondary" disabled={busy || !['RUNNING','PAUSED'].includes(room?.status ?? '')} onClick={() => void hostAction(() => roomApi.pause(session.roomCode, session.token))}>{room?.status === 'PAUSED' ? 'Resume' : 'Pause'}</button><button className="button button-quiet" disabled={busy} onClick={() => void hostAction(() => roomApi.reset(session.roomCode, session.token))}>Reset</button></div>}
      </section>

      <section className="panel remote-ticket-panel">
        <div className="section-heading"><div><p className="eyebrow">YOUR READY TICKET</p><h2>{ownTicket?.playerName} · #{ownTicket?.ticketNumber}</h2></div>{ownTicket && <button className="button button-secondary" onClick={() => printTicket(ownTicket.id)}>Print ticket</button>}</div>
        {ownTicket && <div className="ticket-grid remote-ticket-grid" role="grid">{ownTicket.numbers.flatMap((row, r) => row.map((number, c) => <button type="button" key={`${r}-${c}`} className={`ticket-cell ${number < 0 ? 'disabled-number' : ''} ${number > 0 && selectedNumbers.includes(number) ? 'marked' : ''}`} disabled={number < 0} onClick={() => number > 0 && onToggleNumber(number)}><span className="ticket-number">{Math.abs(number)}</span>{number < 0 && <span className="disabled-cross" aria-hidden="true" />}</button>))}</div>}
        <p className="helper-text">Numbers are marked manually. A draw never marks your ticket automatically.</p>
        <div className="ticket-prize-buttons remote-prize-buttons">{prizeNames.map(prize => { const winner = winners[prize]; const mine = winner?.ticketId === ownTicket?.id; return <button key={prize} className={`button ${mine ? 'button-primary' : 'button-secondary'}`} disabled={Boolean(winner) || claiming !== null || !ownTicket} onClick={() => ownTicket && void claim(ownTicket.id, prize)}>{winner ? (mine ? `✓ ${prize}` : `${prize} — ${winner.playerName}`) : prize}</button> })}</div>
      </section>
    </div>

    <aside className="remote-side">
      <section className="panel remote-players-panel"><div className="section-heading"><div><p className="eyebrow">PLAYERS</p><h2>In this room <span className="ticket-total">{room?.players.length ?? 0}</span></h2></div></div><div className="remote-player-list">{room?.players.map(player => <div className={`remote-player-row ${player.playerId === session.playerId ? 'you' : ''}`} key={player.playerId}><span className="player-avatar-small">{player.playerName.charAt(0).toUpperCase()}</span><div><strong>{player.playerName}{player.playerId === session.playerId ? ' (You)' : ''}</strong><small>Ticket #{player.ticketNumber}{player.host ? ' · Host' : ''}</small></div><span className="ready-badge">READY</span></div>)}</div></section>
      <WinnersPanel winners={winners} />
      <section className="panel remote-help"><p className="eyebrow">REMOTE GAME</p><h2>{isHost ? 'You are the host' : 'Waiting for the host'}</h2><p className="muted">{isHost ? 'Start the room, then call numbers. Every connected player sees the same draw and winner list.' : `The host controls the draw. Your ticket is ready and the room updates automatically.`}</p>{isHost && room?.status !== 'RUNNING' && <button className="button button-primary" disabled={busy} onClick={() => void hostAction(() => roomApi.start(session.roomCode, session.token))}>Start remote game →</button>}</section>
    </aside>

    {showHistory && room && <div className="modal-backdrop" role="presentation" onClick={() => setShowHistory(false)}><section className="history-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">DRAW HISTORY</p><h2>Numbers called in order</h2></div><button type="button" className="icon-button" onClick={() => setShowHistory(false)}>×</button></div><div className="history-order">{room.calledNumbers.length ? room.calledNumbers.map((n, i) => <span className={i === room.calledNumbers.length - 1 ? 'history-number latest' : 'history-number'} key={`${n}-${i}`}><small>{i + 1}</small>{n}</span>) : <p className="muted">No numbers have been called yet.</p>}</div></section></div>}
  </section>
}

function WinnersPanel({ winners }: { winners: Record<string, PrizeWinner> }) {
  return (
    <section className="panel winners-panel">
      <div className="section-heading"><div><p className="eyebrow">WINNERS</p><h2>Prize winners</h2></div><span className="trophy">✦</span></div>
      <div className="winner-strip">
        {prizeList.map(([number, name]) => {
          const winner = winners[name]
          return <div className={`winner-card ${winner ? 'has-winner' : ''}`} key={name}><span className="prize-index">{winner ? '✓' : number}</span><div><strong>{name}</strong><small>{winner ? `${winner.playerName} · #${winner.ticketNumber}` : 'Waiting for winner'}</small></div></div>
        })}
      </div>
    </section>
  )
}

export default App
