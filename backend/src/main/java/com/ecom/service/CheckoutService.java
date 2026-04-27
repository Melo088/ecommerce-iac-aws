package com.ecom.service;

import com.ecom.dto.CheckoutRequest;
import com.ecom.dto.CheckoutResponse;

public interface CheckoutService {
    CheckoutResponse checkout(CheckoutRequest request);
}
