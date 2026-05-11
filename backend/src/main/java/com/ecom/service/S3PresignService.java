package com.ecom.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class S3PresignService {

    @Value("${s3.media-bucket:}")
    private String mediaBucket;

    @Value("${aws.region:us-east-1}")
    private String awsRegion;

    public Map<String, String> generateUploadUrls(Long productId) {
        Map<String, String> urls = new LinkedHashMap<>();
        if ("local".equals(mediaBucket) || mediaBucket == null || mediaBucket.isBlank()) {
            return urls;
        }
        try (S3Presigner presigner = S3Presigner.builder()
                .region(Region.of(awsRegion))
                .build()) {
            urls.put("main",      presign(presigner, "products/" + productId + "/main.png"));
            urls.put("gallery_1", presign(presigner, "products/" + productId + "/gallery/1.png"));
            urls.put("gallery_2", presign(presigner, "products/" + productId + "/gallery/2.png"));
            urls.put("gallery_3", presign(presigner, "products/" + productId + "/gallery/3.png"));
            urls.put("gallery_4", presign(presigner, "products/" + productId + "/gallery/4.png"));
        }
        return urls;
    }

    private String presign(S3Presigner presigner, String key) {
        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(mediaBucket)
                .key(key)
                .build();
        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(5))
                .putObjectRequest(putRequest)
                .build();
        return presigner.presignPutObject(presignRequest).url().toString();
    }
}
