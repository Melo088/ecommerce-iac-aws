package com.ecom.service;

import com.ecom.dto.ProductRequest;
import com.ecom.dto.ProductResponse;

import java.util.List;

public interface ProductService {
    List<ProductResponse> findAll();
    List<ProductResponse> findByCategory(String category);
    List<String> findCategories();
    ProductResponse findById(Long id);
    ProductResponse create(ProductRequest request);
    ProductResponse update(Long id, ProductRequest request);
    void delete(Long id);
}
