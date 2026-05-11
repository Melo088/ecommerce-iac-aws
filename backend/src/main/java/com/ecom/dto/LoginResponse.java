package com.ecom.dto;

public record LoginResponse(
        String token,
        Long userId,
        String name,
        String role
) {}
