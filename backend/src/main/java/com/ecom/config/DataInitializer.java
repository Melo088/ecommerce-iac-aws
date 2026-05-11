package com.ecom.config;

import com.ecom.model.User;
import com.ecom.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepository.findByEmail("admin@ecom.com").isEmpty()) {
            User admin = new User();
            admin.setEmail("admin@ecom.com");
            admin.setName("Admin");
            admin.setPasswordHash(passwordEncoder.encode("Admin123!"));
            admin.setRole("ADMIN");
            userRepository.save(admin);
        }
    }
}
