package com.ecom.dto;

import jakarta.validation.constraints.NotNull;

public record CheckoutRequest(
        @NotNull(message = "El userId es obligatorio") Long userId
) {}
