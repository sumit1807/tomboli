package com.tomboli.model;

import java.util.List;

public record GameState(
        String status,
        Integer lastNumber,
        List<Integer> calledNumbers,
        List<List<Integer>> ticket,
        List<String> prizes,
        int remainingNumbers
) {}
