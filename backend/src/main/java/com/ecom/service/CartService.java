package com.ecom.service;

import com.ecom.dto.CartItemRequest;
import com.ecom.dto.CartItemResponse;

import java.util.List;

public interface CartService {
    List<CartItemResponse> getCart(Long userId);
    CartItemResponse addItem(CartItemRequest request);
    void removeItem(Long id);
}
