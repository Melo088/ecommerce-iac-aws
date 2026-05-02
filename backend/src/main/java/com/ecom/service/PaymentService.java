package com.ecom.service;

import com.ecom.dto.PaymentCreateResponse;

import java.util.Map;

public interface PaymentService {
    PaymentCreateResponse createPreference(Long userId);
    void handleWebhook(Map<String, Object> body);
    void confirmPayment(Long userId, String orderId, String paymentId);
}
