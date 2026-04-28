package com.ecom.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UpdateQuantityRequest(
        @NotNull(message = "La cantidad es obligatoria")
        @Min(value = 0, message = "La cantidad mínima es 0")
        Integer quantity
) {}
