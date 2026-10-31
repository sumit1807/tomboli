package com.tomboli.model;

public record PrizeClaimResult(
        boolean accepted,
        String message,
        PrizeWinner winner
) {}
