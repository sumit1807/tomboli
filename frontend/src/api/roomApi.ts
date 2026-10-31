const API_URL = "http://localhost:8080/api/rooms";

export interface RoomPlayer {
    playerId: string;
    playerName: string;
    ticketCount: number;
}

export interface GameRoom {
    roomCode: string;
    hostPlayerId: string;
    status: "WAITING" | "PLAYING" | "COMPLETED";
    players: RoomPlayer[];
    calledNumbers: number[];
}

export interface RoomResponse {
    room: GameRoom;
    playerId: string;
}

async function request<T>(
    url: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
    }

    return data as T;
}

export function createRoom(
    playerName: string,
    ticketCount: number
) {
    return request<RoomResponse>(API_URL, {
        method: "POST",
        body: JSON.stringify({ playerName, ticketCount }),
    });
}

export function joinRoom(
    roomCode: string,
    playerName: string,
    ticketCount: number
) {
    return request<RoomResponse>(
        `${API_URL}/${encodeURIComponent(roomCode)}/join`,
        {
            method: "POST",
            body: JSON.stringify({ playerName, ticketCount }),
        }
    );
}

export function getRoom(roomCode: string) {
    return request<GameRoom>(
        `${API_URL}/${encodeURIComponent(roomCode)}`
    );
}

export function startRoom(roomCode: string, playerId: string) {
    return request<GameRoom>(
        `${API_URL}/${encodeURIComponent(roomCode)}/start`,
        {
            method: "POST",
            body: JSON.stringify({ playerId }),
        }
    );
}

export function callNextNumber(
    roomCode: string,
    playerId: string
) {
    return request<GameRoom>(
        `${API_URL}/${encodeURIComponent(roomCode)}/next-number`,
        {
            method: "POST",
            body: JSON.stringify({ playerId }),
        }
    );
}