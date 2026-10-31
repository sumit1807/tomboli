import type { GameState, PlayerTicket, PrizeClaimResult, PrizeWinner, RemoteRoomState, RoomSession } from '../types/game'

async function request<T>(path: string, method = 'GET', body?: unknown, token?: string): Promise<T> {
  const headers: HeadersInit = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['X-Room-Token'] = token
  const response = await fetch(path.startsWith('/rooms') ? `/api${path}` : `/api/game${path}`, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    let message = text || `Request failed (${response.status})`
    try {
      const parsed = JSON.parse(text)
      message = parsed.message || parsed.detail || message
    } catch {
      message = message.replace(/<[^>]*>/g, ' ').trim()
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export const gameApi = {
  state: () => request<GameState>(''),
  start: () => request<GameState>('/start', 'POST'),
  next: () => request<GameState>('/next', 'POST'),
  pause: () => request<GameState>('/pause', 'POST'),
  reset: () => request<GameState>('/reset', 'POST'),
  tickets: () => request<PlayerTicket[]>('/tickets'),
  createTicket: (playerName: string, contactNumber = '') =>
    request<PlayerTicket>('/tickets', 'POST', { playerName, contactNumber }),
  winners: () => request<Record<string, PrizeWinner>>('/winners'),
  claimPrize: (ticketId: number, prizeName: string) =>
    request<PrizeClaimResult>(`/tickets/${ticketId}/claim`, 'POST', { prizeName }),
}


export const roomApi = {
  create: (playerName: string, contactNumber = '') => request<RoomSession>('/rooms', 'POST', { playerName, contactNumber }),
  join: (roomCode: string, playerName: string, contactNumber = '') => request<RoomSession>(`/rooms/${roomCode}/join`, 'POST', { playerName, contactNumber }),
  state: (roomCode: string) => request<RemoteRoomState>(`/rooms/${roomCode}`),
  start: (roomCode: string, token: string) => request<RemoteRoomState>(`/rooms/${roomCode}/start`, 'POST', undefined, token),
  next: (roomCode: string, token: string) => request<RemoteRoomState>(`/rooms/${roomCode}/next`, 'POST', undefined, token),
  pause: (roomCode: string, token: string) => request<RemoteRoomState>(`/rooms/${roomCode}/pause`, 'POST', undefined, token),
  reset: (roomCode: string, token: string) => request<RemoteRoomState>(`/rooms/${roomCode}/reset`, 'POST', undefined, token),
  claimPrize: (roomCode: string, token: string, ticketId: number, prizeName: string) => request<PrizeClaimResult>(`/rooms/${roomCode}/tickets/${ticketId}/claim`, 'POST', { prizeName }, token),
}
