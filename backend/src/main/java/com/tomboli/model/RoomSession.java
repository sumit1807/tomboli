package com.tomboli.model;

public record RoomSession(
        String roomCode,
        String playerId,
        String token,
        RoomPlayer player
) {}
