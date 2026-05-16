package com.ecom.controller;

import com.ecom.dto.OrderItemResponse;
import com.ecom.dto.OrderResponse;
import com.ecom.model.Order;
import com.ecom.repository.OrderItemRepository;
import com.ecom.repository.OrderRepository;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    public OrderController(OrderRepository orderRepository, OrderItemRepository orderItemRepository) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
    }

    @GetMapping("/my")
    public List<OrderResponse> myOrders(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return orders.stream().map(order -> {
            List<OrderItemResponse> items = orderItemRepository.findByOrderId(order.getId())
                    .stream()
                    .map(i -> new OrderItemResponse(
                            i.getProductId(),
                            i.getProductName(),
                            i.getPrice(),
                            i.getQuantity()
                    ))
                    .toList();
            String shortId = order.getId().substring(0, 8).toUpperCase();
            return new OrderResponse(
                    order.getId(),
                    shortId,
                    order.getCreatedAt(),
                    order.getTotal(),
                    order.getStatus(),
                    items
            );
        }).toList();
    }
}
