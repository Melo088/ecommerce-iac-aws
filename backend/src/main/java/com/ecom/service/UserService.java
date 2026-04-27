package com.ecom.service;

import com.ecom.dto.UserRequest;
import com.ecom.dto.UserResponse;

public interface UserService {
    UserResponse register(UserRequest request);
    UserResponse findById(Long id);
}
