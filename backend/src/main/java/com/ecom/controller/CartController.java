package com.ecom.controller;

import com.ecom.dto.CartItemRequest;
import com.ecom.dto.CartItemResponse;
import com.ecom.service.CartService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/cart")
public class CartController {

    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping("/{userId}")
    public List<CartItemResponse> getCart(@PathVariable Long userId) {
        return cartService.getCart(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CartItemResponse addItem(@Valid @RequestBody CartItemRequest request) {
        return cartService.addItem(request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeItem(@PathVariable Long id) {
        cartService.removeItem(id);
    }
}
