package com.tomboli.service;

import com.tomboli.model.RemoteRoomState;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class RoomBroadcaster {
    private final SimpMessagingTemplate messaging;
    private final RoomService rooms;
    public RoomBroadcaster(SimpMessagingTemplate messaging, RoomService rooms) {
        this.messaging = messaging; this.rooms = rooms;
    }
    public void publish(String roomCode) {
        messaging.convertAndSend("/topic/rooms/" + roomCode.toUpperCase(), rooms.state(roomCode));
    }
}
