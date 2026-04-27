package com.ecom.controller;

import com.ecom.dto.CheckoutResponse;
import com.ecom.service.CheckoutService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/checkout")
public class CheckoutController {

    private final CheckoutService checkoutService;

    public CheckoutController(CheckoutService checkoutService) {
        this.checkoutService = checkoutService;
    }

    @PostMapping
    public CheckoutResponse checkout(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return checkoutService.checkout(userId);
    }
}
