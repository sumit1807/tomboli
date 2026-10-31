package com.tomboli.service;

import com.tomboli.model.GameState;
import com.tomboli.model.PlayerTicket;
import com.tomboli.model.PrizeWinner;
import com.tomboli.model.PrizeClaimResult;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
public class GameService {
    private final SecureRandom random = new SecureRandom();
    private final List<Integer> calledNumbers = new ArrayList<>();
    private List<List<Integer>> ticket = new ArrayList<>();
    private final Set<String> prizes = new LinkedHashSet<>();

    // Player tickets and prize winners
    private final Map<Long, PlayerTicket> playerTickets = new LinkedHashMap<>();
    private final Map<String, PrizeWinner> prizeWinners = new LinkedHashMap<>();
    private long nextTicketId = 1;

    private String status = "READY";


    public synchronized PersistedGame exportState() {
        return new PersistedGame(status, List.copyOf(calledNumbers), listPlayerTickets(), listPrizeWinners(), nextTicketId);
    }

    public synchronized void restoreState(PersistedGame saved) {
        resetInternal();
        calledNumbers.clear();
        calledNumbers.addAll(saved.calledNumbers());
        playerTickets.clear();
        for (PlayerTicket ticket : saved.tickets()) playerTickets.put(ticket.id(), ticket);
        prizeWinners.clear();
        prizeWinners.putAll(saved.winners());
        prizes.addAll(saved.winners().keySet());
        nextTicketId = Math.max(saved.nextTicketId(), saved.tickets().stream().mapToLong(PlayerTicket::id).max().orElse(0) + 1);
        status = saved.status();
        ticket = new ArrayList<>();
    }

    public record PersistedGame(String status, List<Integer> calledNumbers, List<PlayerTicket> tickets,
                                Map<String, PrizeWinner> winners, long nextTicketId) {}

    public synchronized GameState state() {
        Integer last = calledNumbers.isEmpty() ? null : calledNumbers.get(calledNumbers.size() - 1);
        return new GameState(status, last, List.copyOf(calledNumbers),
                ticket.stream().map(List::copyOf).toList(),
                List.copyOf(prizes), 90 - calledNumbers.size());
    }

    public synchronized GameState startRound() {
        resetInternal();
        ticket = generateTicket();
        status = "RUNNING";
        return state();
    }

    public synchronized GameState start() {
        resetInternal();
        playerTickets.clear();
        prizeWinners.clear();
        nextTicketId = 1;
        ticket = generateTicket();
        status = "RUNNING";
        return state();
    }

    public synchronized List<PlayerTicket> listPlayerTickets() {
        return List.copyOf(playerTickets.values());
    }

    public synchronized PlayerTicket createPlayerTicket(String playerName, String contactNumber) {
        if (playerName == null || playerName.trim().isEmpty()) {
            throw new IllegalArgumentException("Please enter the player's name.");
        }
        String cleanName = playerName.trim();
        String cleanContact = contactNumber == null ? "" : contactNumber.trim();
        if (cleanName.length() > 40) {
            throw new IllegalArgumentException("Player name must be 40 characters or fewer.");
        }
        if (cleanContact.length() > 20) {
            throw new IllegalArgumentException("Contact number must be 20 characters or fewer.");
        }
        long id = nextTicketId++;
        PlayerTicket created = new PlayerTicket(
                id,
                String.format(Locale.ROOT, "%04d", id),
                cleanName,
                cleanContact,
                generateTicket()
        );
        playerTickets.put(id, created);
        return created;
    }

    public synchronized Map<String, PrizeWinner> listPrizeWinners() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(prizeWinners));
    }

    public synchronized PrizeClaimResult claimPrize(long ticketId, String prizeName) {
        PlayerTicket playerTicket = playerTickets.get(ticketId);
        if (playerTicket == null) {
            throw new IllegalArgumentException("Ticket not found. Create a ticket first.");
        }
        if (!List.of("Early Five", "Top Line", "Middle Line", "Bottom Line", "Full House").contains(prizeName)) {
            throw new IllegalArgumentException("Unknown prize.");
        }

        PrizeWinner existingWinner = prizeWinners.get(prizeName);
        if (existingWinner != null) {
            return new PrizeClaimResult(false,
                    prizeName + " was already claimed by " + existingWinner.playerName()
                            + " (ticket #" + existingWinner.ticketNumber() + ").",
                    existingWinner);
        }

        if (!isEligible(playerTicket, prizeName)) {
            return new PrizeClaimResult(false,
                    "Not eligible yet. Wait until the required numbers are called.",
                    null);
        }

        int calledAt = calledNumbers.isEmpty() ? 0 : calledNumbers.get(calledNumbers.size() - 1);
        PrizeWinner winner = new PrizeWinner(prizeName, playerTicket.playerName(),
                playerTicket.ticketNumber(), playerTicket.id(), calledAt);
        prizeWinners.put(prizeName, winner);
        prizes.add(prizeName);
        return new PrizeClaimResult(true,
                "Congratulations! " + winner.playerName() + " is the first winner of " + prizeName + ".",
                winner);
    }

    private boolean isEligible(PlayerTicket playerTicket, String prizeName) {
        Set<Integer> called = new HashSet<>(calledNumbers);
        List<List<Integer>> rows = playerTicket.numbers();
        List<Integer> allNumbers = rows.stream().flatMap(Collection::stream)
                .filter(n -> n > 0).toList();
        long marked = allNumbers.stream().filter(called::contains).count();

        return switch (prizeName) {
            case "Early Five" -> marked >= 5;
            case "Top Line" -> rowIsComplete(rows.get(0), called);
            case "Middle Line" -> rowIsComplete(rows.get(1), called);
            case "Bottom Line" -> rowIsComplete(rows.get(2), called);
            case "Full House" -> marked == 15;
            default -> false;
        };
    }

    private boolean rowIsComplete(List<Integer> row, Set<Integer> called) {
        return row.stream().filter(n -> n > 0).allMatch(called::contains);
    }

    public synchronized GameState next() {
        if ("READY".equals(status)) {
            ticket = generateTicket();
            status = "RUNNING";
        }
        if ("PAUSED".equals(status)) {
            throw new IllegalStateException("Game is paused. Resume it before calling a number.");
        }
        if (!"RUNNING".equals(status)) {
            throw new IllegalStateException("No active game. Start a new game first.");
        }
        if (calledNumbers.size() >= 90) {
            status = "FINISHED";
            throw new IllegalStateException("All 90 numbers have been called.");
        }

        List<Integer> remaining = IntStream.rangeClosed(1, 90)
                .boxed().filter(n -> !calledNumbers.contains(n)).collect(Collectors.toList());
        int number = remaining.get(random.nextInt(remaining.size()));
        calledNumbers.add(number);
        updatePrizes();
        if (calledNumbers.size() == 90) status = "FINISHED";
        return state();
    }

    public synchronized GameState pause() {
        if ("RUNNING".equals(status)) status = "PAUSED";
        else if ("PAUSED".equals(status)) status = "RUNNING";
        else throw new IllegalStateException("Only an active game can be paused or resumed.");
        return state();
    }

    public synchronized GameState reset() {
        resetInternal();
        ticket = generateTicket();
        return state();
    }

    private void resetInternal() {
        calledNumbers.clear();
        prizes.clear();
        status = "READY";
        prizeWinners.clear();
    }

    private List<List<Integer>> generateTicket() {
        // Traditional 3 x 9 Tambola ticket: exactly five playable numbers per row.
        // Every cell also gets a number for display. Non-playable cells are stored
        // as negative values so the UI can show them crossed out while game rules
        // continue to consider only positive values.
        int[][] active = new int[3][9];
        while (true) {
            for (int[] row : active) Arrays.fill(row, 0);
            for (int r = 0; r < 3; r++) {
                List<Integer> cols = IntStream.range(0, 9).boxed().collect(Collectors.toList());
                Collections.shuffle(cols, random);
                for (int i = 0; i < 5; i++) active[r][cols.get(i)] = 1;
            }
            boolean allColumnsUsed = true;
            for (int c = 0; c < 9; c++) {
                if (active[0][c] + active[1][c] + active[2][c] == 0) {
                    allColumnsUsed = false;
                    break;
                }
            }
            if (allColumnsUsed) break;
        }

        int[][] values = new int[3][9];
        for (int c = 0; c < 9; c++) {
            int from = c == 0 ? 1 : c * 10;
            int to = c == 8 ? 90 : c * 10 + 9;
            List<Integer> pool = IntStream.rangeClosed(from, to).boxed().collect(Collectors.toList());
            Collections.shuffle(pool, random);

            // Use three different numbers in each column so every visible cell has a number.
            List<Integer> columnNumbers = new ArrayList<>(pool.subList(0, 3));
            Collections.sort(columnNumbers);

            List<Integer> activeRows = new ArrayList<>();
            List<Integer> disabledRows = new ArrayList<>();
            for (int r = 0; r < 3; r++) {
                if (active[r][c] == 1) activeRows.add(r);
                else disabledRows.add(r);
            }

            // Active numbers are sorted top-to-bottom, as in a normal Tambola ticket.
            for (int i = 0; i < activeRows.size(); i++) {
                values[activeRows.get(i)][c] = columnNumbers.get(i);
            }

            // Remaining visible numbers are crossed/disabled in the UI.
            List<Integer> remaining = new ArrayList<>(columnNumbers.subList(activeRows.size(), 3));
            Collections.shuffle(remaining, random);
            for (int i = 0; i < disabledRows.size(); i++) {
                values[disabledRows.get(i)][c] = -remaining.get(i);
            }
        }

        List<List<Integer>> result = new ArrayList<>();
        for (int r = 0; r < 3; r++) {
            List<Integer> row = new ArrayList<>();
            for (int c = 0; c < 9; c++) row.add(values[r][c]);
            result.add(row);
        }
        return result;
    }

    private void updatePrizes() {
        Set<Integer> called = new HashSet<>(calledNumbers);
        List<Integer> ticketNumbers = ticket.stream().flatMap(Collection::stream)
                .filter(n -> n > 0).toList();
        long marked = ticketNumbers.stream().filter(called::contains).count();

        if (marked >= 5) prizes.add("Early Five");
        if (rowComplete(0, called)) prizes.add("Top Line");
        if (rowComplete(1, called)) prizes.add("Middle Line");
        if (rowComplete(2, called)) prizes.add("Bottom Line");
        if (marked == 15) prizes.add("Full House");
    }

    private boolean rowComplete(int row, Set<Integer> called) {
        return ticket.get(row).stream().filter(n -> n > 0).allMatch(called::contains);
    }
}

