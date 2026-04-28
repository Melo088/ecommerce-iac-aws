package com.ecom.controller;

import com.ecom.dto.CartItemRequest;
import com.ecom.dto.CartItemResponse;
import com.ecom.dto.UpdateQuantityRequest;
import com.ecom.service.CartService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/cart")
public class CartController {

    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    public List<CartItemResponse> getCart(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return cartService.getCart(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CartItemResponse addItem(Authentication authentication,
                                    @Valid @RequestBody CartItemRequest request) {
        Long userId = (Long) authentication.getPrincipal();
        return cartService.addItem(userId, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeItem(@PathVariable Long id) {
        cartService.removeItem(id);
    }

    @PatchMapping("/{id}/quantity")
    public ResponseEntity<CartItemResponse> updateQuantity(
            @PathVariable Long id,
            @Valid @RequestBody UpdateQuantityRequest request) {
        return cartService.updateItemQuantity(id, request.quantity())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }
}
