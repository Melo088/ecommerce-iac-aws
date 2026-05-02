package com.ecom.controller;

import com.ecom.dto.PaymentConfirmRequest;
import com.ecom.dto.PaymentCreateResponse;
import com.ecom.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/create")
    public PaymentCreateResponse createPreference(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return paymentService.createPreference(userId);
    }

    @PostMapping("/confirm")
    public ResponseEntity<Void> confirmPayment(
            Authentication authentication,
            @RequestBody PaymentConfirmRequest body) {
        Long userId = (Long) authentication.getPrincipal();
        try {
            paymentService.confirmPayment(userId, body.orderId(), body.paymentId());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> handleWebhook(@RequestBody Map<String, Object> body) {
        paymentService.handleWebhook(body);
        return ResponseEntity.ok().build();
    }
}
