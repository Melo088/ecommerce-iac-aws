package com.ecom.controller;

import com.ecom.service.ProductService;
import com.ecom.service.S3PresignService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/products")
public class AdminMediaController {

    private final ProductService productService;
    private final S3PresignService s3PresignService;

    public AdminMediaController(ProductService productService, S3PresignService s3PresignService) {
        this.productService = productService;
        this.s3PresignService = s3PresignService;
    }

    @PostMapping("/{id}/upload-urls")
    public ResponseEntity<Map<String, String>> getUploadUrls(@PathVariable Long id) {
        productService.findById(id);
        Map<String, String> urls = s3PresignService.generateUploadUrls(id);
        return ResponseEntity.ok(urls);
    }
}
