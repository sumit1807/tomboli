package com.tomboli.model;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public class GameRoom {
    private String roomCode;
    private String hostPlayerId;
    private String status = "WAITING";

    private final List<RoomPlayer> players = new ArrayList<>();
    private final Set<Integer> calledNumbers = new LinkedHashSet<>();

    public String getRoomCode() {
        return roomCode;
    }

    public void setRoomCode(String roomCode) {
        this.roomCode = roomCode;
    }

    public String getHostPlayerId() {
        return hostPlayerId;
    }

    public void setHostPlayerId(String hostPlayerId) {
        this.hostPlayerId = hostPlayerId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<RoomPlayer> getPlayers() {
        return players;
    }

    public Set<Integer> getCalledNumbers() {
        return calledNumbers;
    }
}