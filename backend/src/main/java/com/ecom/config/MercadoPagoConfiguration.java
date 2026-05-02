package com.ecom.config;

import com.mercadopago.MercadoPagoConfig;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MercadoPagoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(MercadoPagoConfiguration.class);

    @Value("${mercadopago.access-token}")
    private String accessToken;

    @PostConstruct
    public void init() {
        log.info("Initializing MercadoPago — token prefix: {} (length: {})",
                accessToken.substring(0, Math.min(15, accessToken.length())),
                accessToken.length());
        MercadoPagoConfig.setAccessToken(accessToken);
        log.info("MercadoPago access token configured successfully");
    }
}
