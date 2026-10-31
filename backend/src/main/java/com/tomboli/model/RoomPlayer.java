package com.tomboli.model;

public record RoomPlayer(
        String playerId,
        String playerName,
        String contactNumber,
        long ticketId,
        String ticketNumber,
        boolean host
) {}
