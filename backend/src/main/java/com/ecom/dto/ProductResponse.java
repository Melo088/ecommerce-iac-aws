package com.ecom.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ProductResponse(
        Long id,
        String name,
        String description,
        String category,
        BigDecimal price,
        String imageUrl,
        Integer stock,
        LocalDateTime createdAt
) {}
