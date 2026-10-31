package com.tomboli.service;

import com.tomboli.model.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.RowMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;

import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RoomService {
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final List<String> PRIZES = List.of("Early Five", "Top Line", "Middle Line", "Bottom Line", "Full House");
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public RoomService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @PostConstruct
    public synchronized void restoreRooms() {
        jdbc.query("SELECT payload FROM tomboli_rooms", (rs, row) -> rs.getString(1)).forEach(json -> {
            try {
                PersistedRoom saved = mapper.readValue(json, PersistedRoom.class);
                Room room = new Room(saved.code(), saved.hostName());
                room.hostToken = saved.hostToken();
                room.game.restoreState(saved.game());
                saved.players().forEach(p -> room.players.put(p.token(), new PlayerEntry(p.token(), p.player())));
                rooms.put(room.code, room);
            } catch (Exception ex) {
                throw new IllegalStateException("Could not restore a saved Tomboli room", ex);
            }
        });
    }

    private void persist(Room room) {
        try {
            PersistedRoom saved = new PersistedRoom(room.code, room.hostName, room.hostToken,
                    room.players.values().stream().map(e -> new PersistedPlayer(e.token, e.player)).toList(), room.game.exportState());
            String json = mapper.writeValueAsString(saved);
            jdbc.update("INSERT INTO tomboli_rooms (room_code, payload, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT (room_code) DO UPDATE SET payload = EXCLUDED.payload, updated_at = CURRENT_TIMESTAMP", room.code, json);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not save room state", ex);
        }
    }


    public synchronized RoomSession createRoom(String hostName, String contactNumber) {
        String cleanName = validateName(hostName);
        String code;
        do { code = randomCode(); } while (rooms.containsKey(code));
        Room room = new Room(code, cleanName);
        rooms.put(code, room);
        RoomSession session = addPlayer(room, cleanName, cleanContact(contactNumber), true);
        persist(room);
        return session;
    }

    public synchronized RoomSession joinRoom(String roomCode, String playerName, String contactNumber) {
        Room room = getRoom(roomCode);
        RoomSession session = addPlayer(room, validateName(playerName), cleanContact(contactNumber), false);
        persist(room);
        return session;
    }

    public synchronized RemoteRoomState state(String roomCode) { return snapshot(getRoom(roomCode)); }

    public synchronized RemoteRoomState start(String roomCode, String token) {
        Room room = authorizeHost(roomCode, token);
        room.game.startRound();
        persist(room);
        return snapshot(room);
    }

    public synchronized RemoteRoomState next(String roomCode, String token) {
        Room room = authorizeHost(roomCode, token);
        room.game.next();
        persist(room);
        return snapshot(room);
    }

    public synchronized RemoteRoomState pause(String roomCode, String token) {
        Room room = authorizeHost(roomCode, token);
        room.game.pause();
        persist(room);
        return snapshot(room);
    }

    public synchronized RemoteRoomState reset(String roomCode, String token) {
        Room room = authorizeHost(roomCode, token);
        room.game.reset();
        persist(room);
        return snapshot(room);
    }

    public synchronized PrizeClaimResult claim(String roomCode, String token, long ticketId, String prizeName) {
        Room room = getRoom(roomCode);
        requirePlayer(room, token);
        if (!PRIZES.contains(prizeName)) throw new IllegalArgumentException("Unknown prize.");
        if (!ownsTicket(room, token, ticketId)) throw new IllegalArgumentException("You can only claim a prize for your own ticket.");
        PrizeClaimResult result = room.game.claimPrize(ticketId, prizeName);
        if (result.accepted()) persist(room);
        return result;
    }

    private boolean ownsTicket(Room room, String token, long ticketId) {
        return room.players.values().stream().anyMatch(p -> p.token.equals(token) && p.player.ticketId() == ticketId);
    }

    private Room authorizeHost(String code, String token) {
        Room room = getRoom(code);
        if (!room.hostToken.equals(token)) throw new IllegalArgumentException("Only the room host can control the game.");
        return room;
    }

    private RoomPlayer requirePlayer(Room room, String token) {
        PlayerEntry entry = room.players.get(token);
        if (entry == null) throw new IllegalArgumentException("Invalid room session. Please join the room again.");
        return entry.player;
    }

    private RoomSession addPlayer(Room room, String name, String contact, boolean host) {
        PlayerTicket ticket = room.game.createPlayerTicket(name, contact);
        String playerId = UUID.randomUUID().toString().substring(0, 8);
        String token = UUID.randomUUID().toString();
        RoomPlayer player = new RoomPlayer(playerId, name, contact, ticket.id(), ticket.ticketNumber(), host);
        room.players.put(token, new PlayerEntry(token, player));
        if (host) room.hostToken = token;
        return new RoomSession(room.code, playerId, token, player);
    }

    private RemoteRoomState snapshot(Room room) {
        GameState game = room.game.state();
        Integer current = game.lastNumber();
        Integer previous = game.calledNumbers().size() > 1 ? game.calledNumbers().get(game.calledNumbers().size() - 2) : null;
        return new RemoteRoomState(room.code, room.hostName, game.status(), current, previous,
                game.calledNumbers(), room.players.values().stream().map(e -> new RoomPlayer(e.player.playerId(), e.player.playerName(), "", e.player.ticketId(), e.player.ticketNumber(), e.player.host())).toList(),
                room.game.listPlayerTickets(), room.game.listPrizeWinners(), game.remainingNumbers());
    }

    private Room getRoom(String code) {
        if (code == null || !rooms.containsKey(code.trim().toUpperCase(Locale.ROOT))) throw new IllegalArgumentException("Room not found. Check the room code.");
        return rooms.get(code.trim().toUpperCase(Locale.ROOT));
    }

    private String validateName(String value) {
        String name = value == null ? "" : value.trim();
        if (name.isEmpty()) throw new IllegalArgumentException("Player name is required.");
        if (name.length() > 40) throw new IllegalArgumentException("Player name must be 40 characters or fewer.");
        return name;
    }

    private String cleanContact(String value) {
        String contact = value == null ? "" : value.trim();
        if (contact.length() > 20) throw new IllegalArgumentException("Contact number must be 20 characters or fewer.");
        return contact;
    }

    private String randomCode() {
        StringBuilder b = new StringBuilder(6);
        for (int i = 0; i < 6; i++) b.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        return b.toString();
    }

    private static class Room {
        final String code;
        final String hostName;
        final GameService game = new GameService();
        final Map<String, PlayerEntry> players = new LinkedHashMap<>();
        String hostToken;
        Room(String code, String hostName) { this.code = code; this.hostName = hostName; }
    }

    private record PlayerEntry(String token, RoomPlayer player) {}
    private record PersistedPlayer(String token, RoomPlayer player) {}
    private record PersistedRoom(String code, String hostName, String hostToken,
                                 List<PersistedPlayer> players, GameService.PersistedGame game) {}
}
