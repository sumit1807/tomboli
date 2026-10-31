package com.tomboli.controller;

import com.tomboli.model.*;
import com.tomboli.service.RoomService;
import com.tomboli.service.RoomBroadcaster;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class RoomController {
    private final RoomService rooms;
    private final RoomBroadcaster broadcaster;
    public RoomController(RoomService rooms, RoomBroadcaster broadcaster) { this.rooms = rooms; this.broadcaster = broadcaster; }

    @PostMapping public RoomSession create(@RequestBody RoomRequest request) {
        RoomSession session = run(() -> rooms.createRoom(request.playerName(), request.contactNumber()));
        broadcaster.publish(session.roomCode()); return session;
    }
    @PostMapping("/{code}/join") public RoomSession join(@PathVariable String code, @RequestBody RoomRequest request) {
        RoomSession session = run(() -> rooms.joinRoom(code, request.playerName(), request.contactNumber()));
        broadcaster.publish(code); return session;
    }
    @GetMapping("/{code}") public RemoteRoomState state(@PathVariable String code) { return run(() -> rooms.state(code)); }
    @PostMapping("/{code}/start") public RemoteRoomState start(@PathVariable String code, @RequestHeader("X-Room-Token") String token) { return mutate(code, () -> rooms.start(code, token)); }
    @PostMapping("/{code}/next") public RemoteRoomState next(@PathVariable String code, @RequestHeader("X-Room-Token") String token) { return mutate(code, () -> rooms.next(code, token)); }
    @PostMapping("/{code}/pause") public RemoteRoomState pause(@PathVariable String code, @RequestHeader("X-Room-Token") String token) { return mutate(code, () -> rooms.pause(code, token)); }
    @PostMapping("/{code}/reset") public RemoteRoomState reset(@PathVariable String code, @RequestHeader("X-Room-Token") String token) { return mutate(code, () -> rooms.reset(code, token)); }
    @PostMapping("/{code}/tickets/{ticketId}/claim") public PrizeClaimResult claim(@PathVariable String code, @PathVariable long ticketId, @RequestHeader("X-Room-Token") String token, @RequestBody ClaimRequest request) {
        PrizeClaimResult result = run(() -> rooms.claim(code, token, ticketId, request.prizeName()));
        if (result.accepted()) broadcaster.publish(code); return result;
    }
    private RemoteRoomState mutate(String code, java.util.function.Supplier<RemoteRoomState> action) {
        RemoteRoomState state = run(action); broadcaster.publish(code); return state;
    }
    private <T> T run(java.util.function.Supplier<T> action) {
        try { return action.get(); }
        catch (IllegalArgumentException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage()); }
        catch (IllegalStateException ex) { throw new ResponseStatusException(HttpStatus.CONFLICT, ex.getMessage()); }
    }
    public record RoomRequest(String playerName, String contactNumber) {}
    public record ClaimRequest(String prizeName) {}
}
