import type { RemoteRoomState } from '../types/game'

export function subscribeRoom(roomCode: string, onState: (state: RemoteRoomState) => void, onStatus?: (status: string) => void): () => void {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`)
  let connected = false
  let buffer = ''
  const sendFrame = (frame: string) => { if (socket.readyState === WebSocket.OPEN) socket.send(`${frame}\u0000`) }
  socket.onopen = () => sendFrame('CONNECT\naccept-version:1.2\nheart-beat:10000,10000\n\n')
  socket.onmessage = event => {
    buffer += String(event.data)
    const frames = buffer.split('\u0000')
    buffer = frames.pop() ?? ''
    for (const raw of frames) {
      const split = raw.indexOf('\n\n')
      if (split < 0) continue
      const command = raw.slice(0, split).split('\n')[0]
      const body = raw.slice(split + 2).replace(/\n$/, '')
      if (command === 'CONNECTED' && !connected) {
        connected = true
        sendFrame(`SUBSCRIBE\nid:room-${roomCode}\ndestination:/topic/rooms/${roomCode}\nack:auto\n\n`)
        onStatus?.('connected')
      } else if (command === 'MESSAGE') {
        try { onState(JSON.parse(body) as RemoteRoomState) } catch { /* ignore malformed frame */ }
      } else if (command === 'ERROR') onStatus?.('error')
    }
  }
  socket.onerror = () => onStatus?.('error')
  socket.onclose = () => onStatus?.('disconnected')
  return () => { if (socket.readyState === WebSocket.OPEN) sendFrame('DISCONNECT\n\n'); socket.close() }
}
