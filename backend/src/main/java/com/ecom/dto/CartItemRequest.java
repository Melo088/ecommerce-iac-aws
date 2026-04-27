package com.ecom.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CartItemRequest(
        @NotNull(message = "El userId es obligatorio") Long userId,
        @NotNull(message = "El productId es obligatorio") Long productId,
        @NotNull(message = "La cantidad es obligatoria")
        @Min(value = 1, message = "La cantidad mínima es 1") Integer quantity
) {}
