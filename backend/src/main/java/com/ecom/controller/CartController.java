package com.ecom.controller;

import com.ecom.model.CartItem;
import com.ecom.model.Product;
import com.ecom.model.User;
import com.ecom.repository.CartItemRepository;
import com.ecom.repository.ProductRepository;
import com.ecom.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/cart")
public class CartController {

    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;

    public CartController(CartItemRepository cartItemRepository,
                          UserRepository userRepository,
                          ProductRepository productRepository) {
        this.cartItemRepository = cartItemRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<List<CartItem>> getCart(@PathVariable Long userId) {
        if (!userRepository.existsById(userId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(cartItemRepository.findByUserId(userId));
    }

    @PostMapping
    public ResponseEntity<?> addItem(@RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        Long productId = body.get("productId");
        Long quantity = body.getOrDefault("quantity", 1L);

        User user = userRepository.findById(userId).orElse(null);
        Product product = productRepository.findById(productId).orElse(null);

        if (user == null || product == null) {
            return ResponseEntity.badRequest().body("Usuario o producto no encontrado");
        }

        CartItem item = new CartItem();
        item.setUser(user);
        item.setProduct(product);
        item.setQuantity(quantity.intValue());

        return ResponseEntity.ok(cartItemRepository.save(item));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> removeItem(@PathVariable Long id) {
        if (!cartItemRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        cartItemRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
