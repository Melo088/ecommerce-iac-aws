package com.ecom.service.impl;

import com.ecom.dto.CartItemResponse;
import com.ecom.dto.PaymentCreateResponse;
import com.ecom.model.Order;
import com.ecom.repository.CartItemRepository;
import com.ecom.repository.OrderRepository;
import com.ecom.service.CartService;
import com.ecom.service.PaymentService;
import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.client.preference.PreferenceBackUrlsRequest;
import com.mercadopago.client.preference.PreferenceClient;
import com.mercadopago.client.preference.PreferenceItemRequest;
import com.mercadopago.client.preference.PreferenceRequest;
import com.mercadopago.exceptions.MPApiException;
import com.mercadopago.exceptions.MPException;
import com.mercadopago.resources.payment.Payment;
import com.mercadopago.resources.preference.Preference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PaymentServiceImpl implements PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentServiceImpl.class);

    private static final Set<String> TERMINAL_FAILED = Set.of(
            "rejected", "cancelled", "refunded", "charged_back");
    private static final Set<String> STILL_PENDING = Set.of(
            "in_process", "pending", "authorized");

    private final CartService cartService;
    private final CartItemRepository cartItemRepository;
    private final OrderRepository orderRepository;

    @Value("${app.backend-url:http://localhost:8080}")
    private String backendUrl;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    public PaymentServiceImpl(CartService cartService,
                              CartItemRepository cartItemRepository,
                              OrderRepository orderRepository) {
        this.cartService = cartService;
        this.cartItemRepository = cartItemRepository;
        this.orderRepository = orderRepository;
    }

    @Override
    @Transactional
    public PaymentCreateResponse createPreference(Long userId) {
        List<CartItemResponse> cartItems = cartService.getCart(userId);
        if (cartItems.isEmpty()) {
            throw new IllegalStateException("El carrito está vacío");
        }

        String orderId = UUID.randomUUID().toString();

        List<PreferenceItemRequest> mpItems = cartItems.stream()
                .map(item -> PreferenceItemRequest.builder()
                        .title(item.productName())
                        .quantity(item.quantity())
                        .unitPrice(item.price().setScale(0, RoundingMode.HALF_UP))
                        .currencyId("COP")
                        .build())
                .collect(Collectors.toList());

        PreferenceBackUrlsRequest backUrls = PreferenceBackUrlsRequest.builder()
                .success(frontendUrl + "/success")
                .failure(frontendUrl + "/failure")
                .pending(frontendUrl + "/pending")
                .build();

        log.info("backUrls: success={}, failure={}, pending={}",
                backUrls.getSuccess(), backUrls.getFailure(), backUrls.getPending());

        boolean isPublicUrl = backendUrl != null
                && !backendUrl.contains("localhost")
                && !backendUrl.contains("ngrok");

        PreferenceRequest.PreferenceRequestBuilder requestBuilder = PreferenceRequest.builder()
                .items(mpItems)
                .backUrls(backUrls)
                .autoReturn("approved")
                .externalReference(orderId);

        if (isPublicUrl) {
            requestBuilder.notificationUrl(backendUrl + "/api/v1/payments/webhook");
        }

        PreferenceRequest request = requestBuilder.build();

        try {
            PreferenceClient preferenceClient = new PreferenceClient();
            Preference preference = preferenceClient.create(request);

            BigDecimal total = cartItems.stream()
                    .map(i -> i.price().multiply(BigDecimal.valueOf(i.quantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            Order order = new Order();
            order.setId(orderId);
            order.setUserId(userId);
            order.setTotal(total);
            order.setStatus("PENDING");
            order.setMpPreferenceId(preference.getId());
            orderRepository.save(order);

            return new PaymentCreateResponse(preference.getId(), orderId);

        } catch (MPApiException e) {
            log.error("MPApiException al crear preferencia — status: {}, content: {}, message: {}, cause: {}",
                    e.getStatusCode(),
                    e.getApiResponse() != null ? e.getApiResponse().getContent() : "null",
                    e.getMessage(),
                    e.getCause() != null ? e.getCause().getMessage() : "null");
            throw new RuntimeException("Error al crear preferencia en MercadoPago: " + e.getMessage(), e);
        } catch (MPException e) {
            log.error("MPException al crear preferencia — message: {}, cause: {}",
                    e.getMessage(),
                    e.getCause() != null ? e.getCause().getMessage() : "null");
            throw new RuntimeException("Error al crear preferencia en MercadoPago: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public String confirmPayment(Long userId, String orderId, String paymentId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        if (Order.STATUS_PAID.equals(order.getStatus())) {
            return Order.STATUS_PAID;
        }

        long mpPaymentId = Long.parseLong(paymentId);

        try {
            PaymentClient paymentClient = new PaymentClient();
            Payment payment = paymentClient.get(mpPaymentId);
            String result = applyPaymentResult(order, payment);
            return result != null ? result : Order.STATUS_PENDING;
        } catch (MPApiException e) {
            log.error("MPApiException confirming payment — status: {}, content: {}, message: {}",
                    e.getStatusCode(),
                    e.getApiResponse() != null ? e.getApiResponse().getContent() : "null",
                    e.getMessage());
            throw new RuntimeException("Error confirming payment: " + e.getMessage(), e);
        } catch (MPException e) {
            log.error("MPException confirming payment — message: {}", e.getMessage());
            throw new RuntimeException("Error confirming payment: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public void handleWebhook(Map<String, Object> body) {
        String type = (String) body.get("type");
        if (!"payment".equals(type)) {
            return;
        }

        Map<String, Object> data = (Map<String, Object>) body.get("data");
        if (data == null || data.get("id") == null) {
            return;
        }

        long paymentId = Long.parseLong(data.get("id").toString());

        try {
            PaymentClient paymentClient = new PaymentClient();
            Payment payment = paymentClient.get(paymentId);

            String externalReference = payment.getExternalReference();
            if (externalReference == null) {
                log.warn("Webhook: payment {} has no externalReference", paymentId);
                return;
            }

            orderRepository.findById(externalReference).ifPresentOrElse(
                    order -> applyPaymentResult(order, payment),
                    () -> log.warn("Webhook: no order found for externalReference={}", externalReference)
            );

        } catch (MPApiException e) {
            log.error("MPApiException en webhook — status: {}, content: {}, message: {}, cause: {}",
                    e.getStatusCode(),
                    e.getApiResponse() != null ? e.getApiResponse().getContent() : "null",
                    e.getMessage(),
                    e.getCause() != null ? e.getCause().getMessage() : "null");
        } catch (MPException e) {
            log.error("MPException en webhook — message: {}, cause: {}",
                    e.getMessage(),
                    e.getCause() != null ? e.getCause().getMessage() : "null");
        }
    }

    /**
     * Maps the MercadoPago payment status to an order status and persists the change.
     * Returns the resulting order status string, or null if no change was made.
     */
    private String applyPaymentResult(Order order, Payment payment) {
        String mpStatus = payment.getStatus();
        String detail   = payment.getStatusDetail();

        if ("approved".equals(mpStatus)) {
            if (Order.STATUS_PAID.equals(order.getStatus())) return Order.STATUS_PAID;
            order.setStatus(Order.STATUS_PAID);
            order.setMpPaymentId(String.valueOf(payment.getId()));
            orderRepository.save(order);
            cartItemRepository.deleteByUserId(order.getUserId());
            log.info("Order {} → PAID (mpPaymentId={}, detail={})", order.getId(), payment.getId(), detail);
            return Order.STATUS_PAID;
        }

        if (TERMINAL_FAILED.contains(mpStatus)) {
            if (Order.STATUS_PAID.equals(order.getStatus())) {
                log.warn("Order {} already PAID — ignoring terminal status: {}", order.getId(), mpStatus);
                return Order.STATUS_PAID;
            }
            order.setStatus(Order.STATUS_FAILED);
            order.setMpPaymentId(String.valueOf(payment.getId()));
            orderRepository.save(order);
            log.info("Order {} → FAILED (mpStatus={}, detail={})", order.getId(), mpStatus, detail);
            return Order.STATUS_FAILED;
        }

        if (STILL_PENDING.contains(mpStatus)) {
            log.info("Order {} still pending — mpStatus={}, detail={}", order.getId(), mpStatus, detail);
            return Order.STATUS_PENDING;
        }

        log.warn("Order {} — unrecognized MP status: {}, detail: {}", order.getId(), mpStatus, detail);
        return null;
    }
}
