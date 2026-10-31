package com.tomboli.model;

import java.util.List;
import java.util.Map;

public record RemoteRoomState(
        String roomCode,
        String hostName,
        String status,
        Integer currentNumber,
        Integer lastNumber,
        List<Integer> calledNumbers,
        List<RoomPlayer> players,
        List<PlayerTicket> tickets,
        Map<String, PrizeWinner> winners,
        int remainingNumbers
) {}
