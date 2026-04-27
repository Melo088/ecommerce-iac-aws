package com.ecom.dto;

import java.math.BigDecimal;
import java.util.List;

public record CheckoutResponse(
        String orderId,
        BigDecimal total,
        List<CartItemResponse> items,
        String message
) {}
