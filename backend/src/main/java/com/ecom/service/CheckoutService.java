package com.ecom.service;

import com.ecom.dto.CheckoutResponse;

public interface CheckoutService {
    CheckoutResponse checkout(Long userId);
}
