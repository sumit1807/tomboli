package com.tomboli.model;

import java.util.List;

public record PlayerTicket(
        long id,
        String ticketNumber,
        String playerName,
        String contactNumber,
        List<List<Integer>> numbers
) {}
