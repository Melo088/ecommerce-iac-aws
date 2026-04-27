package com.ecom.service.impl;

import com.ecom.dto.UserRequest;
import com.ecom.dto.UserResponse;
import com.ecom.exception.ResourceNotFoundException;
import com.ecom.model.User;
import com.ecom.repository.UserRepository;
import com.ecom.service.UserService;
import org.springframework.stereotype.Service;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;

    public UserServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserResponse register(UserRequest request) {
        User user = new User();
        user.setEmail(request.email());
        // En producción reemplazar por BCryptPasswordEncoder.encode(request.password())
        user.setPasswordHash(request.password());
        user.setName(request.name());
        return toResponse(userRepository.save(user));
    }

    @Override
    public UserResponse findById(Long id) {
        return userRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado: " + id));
    }

    private UserResponse toResponse(User u) {
        return new UserResponse(u.getId(), u.getEmail(), u.getName(), u.getCreatedAt());
    }
}
