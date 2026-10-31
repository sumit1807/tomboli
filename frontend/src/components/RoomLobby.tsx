import { useEffect, useState } from 'react'
import {
    createRoom,
    joinRoom,
    getRoom,
    startRoom,
    callNextNumber,
    type GameRoom,
} from '../api/roomApi'
import './RoomLobby.css'

export default function RoomLobby() {
    const [playerName, setPlayerName] = useState('')
    const [roomCodeInput, setRoomCodeInput] = useState('')
    const [ticketCount, setTicketCount] = useState(1)
    const [room, setRoom] = useState<GameRoom | null>(null)
    const [playerId, setPlayerId] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    async function run(action: () => Promise<void>) {
        setBusy(true)
        setError('')

        try {
            await action()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong.')
        } finally {
            setBusy(false)
        }
    }

    async function handleCreate() {
        const result = await createRoom(playerName, ticketCount)
        setRoom(result.room)
        setPlayerId(result.playerId)
    }

    async function handleJoin() {
        const result = await joinRoom(
            roomCodeInput.trim(),
            playerName,
            ticketCount,
        )
        setRoom(result.room)
        setPlayerId(result.playerId)
    }

    useEffect(() => {
        if (!room?.roomCode) return

        const timer = window.setInterval(async () => {
            try {
                const updatedRoom = await getRoom(room.roomCode)
                setRoom(updatedRoom)
            } catch {
                // A temporary refresh failure should not clear the current room.
            }
        }, 2000)

        return () => window.clearInterval(timer)
    }, [room?.roomCode])

    const isHost = room?.hostPlayerId === playerId

    if (room) {
        return (
            <section className="room-lobby panel">
                <div className="section-heading">
                    <div>
                        <p className="eyebrow">MULTIPLAYER</p>
                        <h2>Room {room.roomCode}</h2>
                    </div>
                    <span className="room-status">{room.status}</span>
                </div>

                <p className="muted">
                    Share room code <strong>{room.roomCode}</strong> with your friends.
                </p>

                <h3>Players ({room.players.length})</h3>

                <div className="room-player-list">
                    {room.players.map((player) => (
                        <div className="room-player" key={player.playerId}>
                            <span>{player.playerName}</span>
                            <span>{player.ticketCount} ticket(s)</span>
                        </div>
                    ))}
                </div>

                {room.status === 'WAITING' && isHost && (
                    <button
                        className="button button-primary"
                        disabled={busy}
                        onClick={() =>
                            void run(async () => {
                                setRoom(await startRoom(room.roomCode, playerId))
                            })
                        }
                    >
                        Start game
                    </button>
                )}

                {room.status === 'PLAYING' && (
                    <>
                        <h3>Called numbers</h3>
                        <div className="room-number-list">
                            {room.calledNumbers.map((number) => (
                                <span key={number} className="room-number">
                                    {number}
                                </span>
                            ))}
                        </div>

                        {isHost && (
                            <button
                                className="button button-primary"
                                disabled={busy}
                                onClick={() =>
                                    void run(async () => {
                                        setRoom(await callNextNumber(room.roomCode, playerId))
                                    })
                                }
                            >
                                Call next number
                            </button>
                        )}
                    </>
                )}

                {room.status === 'COMPLETED' && (
                    <p className="notice-banner">All numbers have been called.</p>
                )}

                <button
                    className="button button-secondary"
                    onClick={() => {
                        setRoom(null)
                        setPlayerId('')
                        setError('')
                    }}
                >
                    Back to rooms
                </button>

                {error && <div className="error-banner">{error}</div>}
            </section>
        )
    }

    return (
        <section className="room-lobby panel">
            <p className="eyebrow">PLAY WITH FRIENDS</p>
            <h2>Create or join a room</h2>
            <p className="muted">
                Create a private room or join a friend's room using its code.
            </p>

            <form
                className="room-form"
                onSubmit={(event) => {
                    event.preventDefault()
                    void run(handleCreate)
                }}
            >
                <label htmlFor="room-player-name">Your name</label>
                <input
                    id="room-player-name"
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder="Enter your name"
                    maxLength={40}
                    required
                />

                <label htmlFor="room-ticket-count">Number of tickets</label>
                <select
                    id="room-ticket-count"
                    value={ticketCount}
                    onChange={(event) => setTicketCount(Number(event.target.value))}
                >
                    {[1, 2, 3, 4, 5, 6].map((count) => (
                        <option key={count} value={count}>
                            {count} ticket(s)
                        </option>
                    ))}
                </select>

                <button
                    className="button button-primary"
                    type="submit"
                    disabled={busy || !playerName.trim()}
                >
                    Create room
                </button>
            </form>

            <div className="room-divider">OR JOIN AN EXISTING ROOM</div>

            <form
                className="room-form"
                onSubmit={(event) => {
                    event.preventDefault()
                    void run(handleJoin)
                }}
            >
                <label htmlFor="room-code">Room code</label>
                <input
                    id="room-code"
                    value={roomCodeInput}
                    onChange={(event) => setRoomCodeInput(event.target.value)}
                    placeholder="Enter room code"
                    maxLength={6}
                    required
                />

                <button
                    className="button button-secondary"
                    type="submit"
                    disabled={busy || !playerName.trim() || !roomCodeInput.trim()}
                >
                    Join room
                </button>
            </form>

            {error && <div className="error-banner">{error}</div>}
        </section>
    )
}