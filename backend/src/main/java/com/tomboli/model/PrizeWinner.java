package com.tomboli.model;

public record PrizeWinner(
        String prizeName,
        String playerName,
        String ticketNumber,
        long ticketId,
        int calledAtNumber
) {}
