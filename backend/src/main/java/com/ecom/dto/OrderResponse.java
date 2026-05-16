package com.ecom.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record OrderResponse(
        String id,
        String shortId,
        LocalDateTime createdAt,
        BigDecimal total,
        String status,
        List<OrderItemResponse> items
) {}
