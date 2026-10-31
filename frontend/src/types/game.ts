export type GameState = {
  status: 'READY' | 'RUNNING' | 'PAUSED' | 'FINISHED' | string
  lastNumber: number | null
  calledNumbers: number[]
  ticket: number[][]
  prizes: string[]
  remainingNumbers: number
}

export type PlayerTicket = {
  id: number
  ticketNumber: string
  playerName: string
  contactNumber?: string
  numbers: number[][]
}

export type PrizeWinner = {
  prizeName: string
  playerName: string
  ticketNumber: string
  ticketId: number
  calledAtNumber: number
}

export type PrizeClaimResult = {
  accepted: boolean
  message: string
  winner: PrizeWinner | null
}

export type RoomPlayer = {
  playerId: string
  playerName: string
  contactNumber?: string
  ticketId: number
  ticketNumber: string
  host: boolean
}

export type RemoteRoomState = {
  roomCode: string
  hostName: string
  status: string
  currentNumber: number | null
  lastNumber: number | null
  calledNumbers: number[]
  players: RoomPlayer[]
  tickets: PlayerTicket[]
  winners: Record<string, PrizeWinner>
  remainingNumbers: number
}

export type RoomSession = {
  roomCode: string
  playerId: string
  token: string
  player: RoomPlayer
}
