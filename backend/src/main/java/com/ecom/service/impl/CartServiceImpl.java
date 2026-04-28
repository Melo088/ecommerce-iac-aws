package com.ecom.service.impl;

import com.ecom.dto.CartItemRequest;
import com.ecom.dto.CartItemResponse;
import com.ecom.exception.ResourceNotFoundException;
import com.ecom.model.CartItem;
import com.ecom.model.Product;
import com.ecom.model.User;
import com.ecom.repository.CartItemRepository;
import com.ecom.repository.ProductRepository;
import com.ecom.repository.UserRepository;
import com.ecom.service.CartService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CartServiceImpl implements CartService {

    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;

    public CartServiceImpl(CartItemRepository cartItemRepository,
                           UserRepository userRepository,
                           ProductRepository productRepository) {
        this.cartItemRepository = cartItemRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
    }

    @Override
    public List<CartItemResponse> getCart(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Usuario no encontrado: " + userId);
        }
        return cartItemRepository.findByUserId(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public CartItemResponse addItem(Long userId, CartItemRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado: " + userId));
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado: " + request.productId()));

        CartItem item = cartItemRepository
                .findByUserIdAndProductId(userId, request.productId())
                .orElseGet(() -> {
                    CartItem newItem = new CartItem();
                    newItem.setUser(user);
                    newItem.setProduct(product);
                    newItem.setQuantity(0);
                    return newItem;
                });

        item.setQuantity(item.getQuantity() + request.quantity());
        return toResponse(cartItemRepository.save(item));
    }

    @Override
    public void removeItem(Long id) {
        if (!cartItemRepository.existsById(id)) {
            throw new ResourceNotFoundException("Item del carrito no encontrado: " + id);
        }
        cartItemRepository.deleteById(id);
    }

    @Override
    public Optional<CartItemResponse> updateItemQuantity(Long itemId, int quantity) {
        CartItem item = cartItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item del carrito no encontrado: " + itemId));

        if (quantity <= 0) {
            cartItemRepository.deleteById(itemId);
            return Optional.empty();
        }

        item.setQuantity(quantity);
        return Optional.of(toResponse(cartItemRepository.save(item)));
    }

    private CartItemResponse toResponse(CartItem item) {
        return new CartItemResponse(
                item.getId(),
                item.getProduct().getId(),
                item.getProduct().getName(),
                item.getProduct().getPrice(),
                item.getQuantity()
        );
    }
}
