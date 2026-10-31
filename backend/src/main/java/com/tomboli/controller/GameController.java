package com.tomboli.controller;

import com.tomboli.model.GameState;
import com.tomboli.model.PlayerTicket;
import com.tomboli.model.PrizeWinner;
import com.tomboli.model.PrizeClaimResult;
import java.util.List;
import java.util.Map;
import com.tomboli.service.GameService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/game")
@CrossOrigin(origins = "*")
public class GameController {
    private final GameService gameService;

    public GameController(GameService gameService) {
        this.gameService = gameService;
    }

    @GetMapping
    public GameState state() {
        return gameService.state();
    }

    @PostMapping("/start")
    public GameState start() {
        return gameService.start();
    }

    @PostMapping("/next")
    public GameState next() {
        try {
            return gameService.next();
        } catch (IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, ex.getMessage());
        }
    }

    @PostMapping("/pause")
    public GameState pause() {
        try {
            return gameService.pause();
        } catch (IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, ex.getMessage());
        }
    }

    @PostMapping("/reset")
    public GameState reset() {
        return gameService.reset();
    }

    @GetMapping("/tickets")
    public List<PlayerTicket> tickets() {
        return gameService.listPlayerTickets();
    }

    @PostMapping("/tickets")
    public PlayerTicket createTicket(@RequestBody CreateTicketRequest request) {
        try {
            return gameService.createPlayerTicket(request.playerName(), request.contactNumber());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @GetMapping("/winners")
    public Map<String, PrizeWinner> winners() {
        return gameService.listPrizeWinners();
    }

    @PostMapping("/tickets/{ticketId}/claim")
    public PrizeClaimResult claimPrize(@PathVariable long ticketId, @RequestBody ClaimPrizeRequest request) {
        try {
            return gameService.claimPrize(ticketId, request.prizeName());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    public record CreateTicketRequest(String playerName, String contactNumber) {}
    public record ClaimPrizeRequest(String prizeName) {}
}
