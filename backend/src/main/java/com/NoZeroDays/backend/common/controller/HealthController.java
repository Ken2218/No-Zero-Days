package com.NoZeroDays.backend.common.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(originPatterns = {"http://localhost:3000", "https://*.railway.app"})
public class HealthController {

    @Autowired
    private DataSource dataSource;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("app", "No Zero Days Backend");
        status.put("status", "UP");

        // Test DB connection
        try (Connection conn = dataSource.getConnection()) {
            status.put("database", "CONNECTED");
            status.put("db_url", conn.getMetaData().getURL());
        } catch (Exception e) {
            status.put("database", "ERROR: " + e.getMessage());
        }

        return ResponseEntity.ok(status);
    }
}
