package com.ecom.service.impl;

import com.ecom.dto.CartItemResponse;
import com.ecom.dto.CheckoutResponse;
import com.ecom.exception.ResourceNotFoundException;
import com.ecom.repository.CartItemRepository;
import com.ecom.repository.UserRepository;
import com.ecom.service.CartService;
import com.ecom.service.CheckoutService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class CheckoutServiceImpl implements CheckoutService {

    private final CartService cartService;
    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;

    public CheckoutServiceImpl(CartService cartService,
                               CartItemRepository cartItemRepository,
                               UserRepository userRepository) {
        this.cartService = cartService;
        this.cartItemRepository = cartItemRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public CheckoutResponse checkout(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Usuario no encontrado: " + userId);
        }

        List<CartItemResponse> items = cartService.getCart(userId);
        if (items.isEmpty()) {
            throw new IllegalStateException("El carrito está vacío");
        }

        BigDecimal total = items.stream()
                .map(item -> item.price().multiply(BigDecimal.valueOf(item.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        cartItemRepository.deleteByUserId(userId);

        return new CheckoutResponse(
                UUID.randomUUID().toString(),
                total,
                items,
                "Pago procesado exitosamente"
        );
    }
}
