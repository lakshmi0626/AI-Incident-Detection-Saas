package com.incidentiq.sampleapp.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class OrderController {

    private final List<byte[]> memoryLeaker = new ArrayList<>();

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "UP");
        resp.put("service", "spring-order-service");
        resp.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(resp);
    }

    /**
     * Failure 1: Database Pool Exhaustion / Timeout Simulation
     */
    @PostMapping("/orders/checkout")
    public ResponseEntity<Map<String, Object>> triggerCheckoutFailure(@RequestParam(defaultValue = "true") boolean fail) {
        if (fail) {
            try {
                // Simulate holding thread waiting for saturated DB connection pool
                Thread.sleep(1500);
            } catch (InterruptedException ignored) {}

            throw new RuntimeException("HikariPool-1 - Connection is not available, request timed out after 30000ms. SQLTransientConnectionException");
        }
        Map<String, Object> ok = new HashMap<>();
        ok.put("orderId", "ord_" + UUID.randomUUID().toString().substring(0, 8));
        ok.put("status", "COMPLETED");
        return ResponseEntity.ok(ok);
    }

    /**
     * Failure 2: Cascading HTTP 500 NullPointerException
     */
    @PostMapping("/payments/process")
    public ResponseEntity<Map<String, Object>> trigger500Cascade(@RequestParam(defaultValue = "true") boolean fail) {
        if (fail) {
            String customer = null;
            // Deliberate NullPointerException
            customer.toLowerCase();
        }
        Map<String, Object> ok = new HashMap<>();
        ok.put("transactionId", "txn_" + UUID.randomUUID().toString().substring(0, 8));
        ok.put("status", "APPROVED");
        return ResponseEntity.ok(ok);
    }

    /**
     * Failure 3: Unbounded Memory Allocation & Heap Saturation
     */
    @PostMapping("/inventory/batch-sync")
    public ResponseEntity<Map<String, Object>> triggerMemoryLeak(@RequestParam(defaultValue = "20") int chunksMb) {
        for (int i = 0; i < chunksMb; i++) {
            // Allocate 1MB byte arrays
            memoryLeaker.add(new byte[1024 * 1024]);
        }
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "ALLOCATED");
        resp.put("chunksAddedMb", chunksMb);
        resp.put("totalHeapChunksHeld", memoryLeaker.size());
        return ResponseEntity.ok(resp);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
        Map<String, Object> err = new HashMap<>();
        err.put("error", ex.getClass().getSimpleName());
        err.put("message", ex.getMessage());
        err.put("status", 500);
        err.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
    }
}
