package com.NoZeroDays.backend.common.controller;

import com.NoZeroDays.backend.common.model.Room;
import com.NoZeroDays.backend.common.model.RoomParticipant;
import com.NoZeroDays.backend.common.model.StudentProfile;
import com.NoZeroDays.backend.common.model.GameSession;
import com.NoZeroDays.backend.common.repository.RoomRepository;
import com.NoZeroDays.backend.common.repository.RoomParticipantRepository;
import com.NoZeroDays.backend.common.repository.StudentProfileRepository;
import com.NoZeroDays.backend.common.repository.GameSessionRepository;
import com.NoZeroDays.backend.common.repository.AttemptLogRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomParticipantRepository participantRepository;

    @Autowired
    private StudentProfileRepository studentRepository;

    @Autowired
    private GameSessionRepository gameSessionRepository;

    @Autowired
    private AttemptLogRepository attemptLogRepository;

    /**
     * POST /api/rooms/create
     * Teacher creates a new room. Optionally accepts a custom room code.
     * Request body: { "teacherName": "...", "section": "...", "roomCode": "(optional)" }
     */
    @PostMapping("/create")
    public ResponseEntity<?> createRoom(@RequestBody Map<String, String> body) {
        String teacherName = body.get("teacherName");
        String section = body.get("section");
        String customCode = body.get("roomCode");

        if (teacherName == null || teacherName.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Teacher name is required."));
        }

        String roomCode;
        if (customCode != null && !customCode.trim().isEmpty()) {
            // Teacher provided a custom room code — validate and use it
            roomCode = customCode.trim().toUpperCase();
            if (roomCode.length() < 3 || roomCode.length() > 10) {
                return ResponseEntity.badRequest().body(Map.of("error", "Room code must be 3-10 characters."));
            }
            if (roomRepository.existsByRoomCode(roomCode)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Room code '" + roomCode + "' is already in use. Please choose a different code."));
            }
        } else {
            // Auto-generate a unique room code
            roomCode = generateUniqueRoomCode();
        }

        Room room = new Room(roomCode, teacherName.trim(), section != null ? section.trim() : "");
        roomRepository.save(room);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("roomCode", roomCode);
        response.put("teacherName", room.getTeacherName());
        response.put("section", room.getSection());
        response.put("status", room.getStatus());
        response.put("createdAt", room.getCreatedAt().toString());

        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/rooms/join
     * Student joins a room by code.
     * Request body: { "roomCode": "...", "studentNumber": "...", "fullName": "...", "section": "..." }
     */
    @PostMapping("/join")
    public ResponseEntity<?> joinRoom(@RequestBody Map<String, String> body) {
        String roomCode = body.get("roomCode");
        String studentNumber = body.get("studentNumber");
        String fullName = body.get("fullName");
        String section = body.get("section");

        if (roomCode == null || roomCode.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Room code is required."));
        }
        if (studentNumber == null || studentNumber.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Student number is required."));
        }
        if (fullName == null || fullName.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Full name is required."));
        }

        Optional<Room> roomOpt = roomRepository.findByRoomCode(roomCode.trim().toUpperCase());
        if (roomOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid room code. No room found."));
        }

        Room room = roomOpt.get();

        // Removed check that prevents joining after session start to allow late-comers.

        // Check for duplicate join (idempotent — return success if already joined)
        if (participantRepository.existsByRoomAndStudentNumber(room, studentNumber.trim())) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "You have already joined this room.");
            response.put("roomCode", room.getRoomCode());
            response.put("roomStatus", room.getStatus());
            return ResponseEntity.ok(response);
        }

        RoomParticipant participant = new RoomParticipant(
            room,
            studentNumber.trim(),
            fullName.trim(),
            section != null ? section.trim() : ""
        );
        participantRepository.save(participant);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "Successfully joined the room.");
        response.put("roomCode", room.getRoomCode());
        response.put("roomStatus", room.getStatus());

        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/rooms/{code}/participants
     * Returns the list of students who have joined the room.
     */
    @GetMapping("/{code}/participants")
    public ResponseEntity<?> getParticipants(@PathVariable("code") String code) {
        Optional<Room> roomOpt = roomRepository.findByRoomCode(code.trim().toUpperCase());
        if (roomOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Room not found."));
        }

        Room room = roomOpt.get();
        List<RoomParticipant> participants = participantRepository.findByRoomOrderByJoinedAtAsc(room);
        long count = participants.size();

        List<Map<String, String>> studentList = new ArrayList<>();
        for (RoomParticipant p : participants) {
            Map<String, String> entry = new LinkedHashMap<>();
            entry.put("studentNumber", p.getStudentNumber());
            entry.put("fullName", p.getFullName());
            entry.put("section", p.getSection());
            entry.put("joinedAt", p.getJoinedAt().toString());
            studentList.add(entry);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("roomCode", room.getRoomCode());
        response.put("teacherName", room.getTeacherName());
        response.put("section", room.getSection());
        response.put("status", room.getStatus());
        response.put("participantCount", count);
        response.put("participants", studentList);

        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/rooms/{code}/start
     * Teacher initiates the session — marks the room as ACTIVE.
     */
    @PostMapping("/{code}/start")
    public ResponseEntity<?> startSession(@PathVariable("code") String code) {
        Optional<Room> roomOpt = roomRepository.findByRoomCode(code.trim().toUpperCase());
        if (roomOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Room not found."));
        }

        Room room = roomOpt.get();
        if ("ACTIVE".equalsIgnoreCase(room.getStatus())) {
            return ResponseEntity.ok(Map.of("status", "ACTIVE", "message", "Session already started."));
        }

        room.setStatus("ACTIVE");
        room.setStartedAt(LocalDateTime.now());
        roomRepository.save(room);

        return ResponseEntity.ok(Map.of("status", "ACTIVE", "message", "Session initiated successfully."));
    }

    /**
     * GET /api/rooms/{code}/status
     * Lightweight endpoint for students to poll whether the session has started.
     * Returns minimal payload to reduce bandwidth.
     */
    @GetMapping("/{code}/status")
    public ResponseEntity<?> getRoomStatus(@PathVariable("code") String code) {
        Optional<Room> roomOpt = roomRepository.findByRoomCode(code.trim().toUpperCase());
        if (roomOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Room not found."));
        }

        Room room = roomOpt.get();
        long count = participantRepository.countByRoom(room);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", room.getStatus());
        response.put("participantCount", count);

        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/rooms/{code}/dashboard
     * Dashboard endpoint for teachers to view live student progress.
     */
    @GetMapping("/{code}/dashboard")
    public ResponseEntity<?> getTeacherDashboard(@PathVariable("code") String code) {
        Optional<Room> roomOpt = roomRepository.findByRoomCode(code.trim().toUpperCase());
        if (roomOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Room not found."));
        }

        Room room = roomOpt.get();
        List<RoomParticipant> participants = participantRepository.findByRoomOrderByJoinedAtAsc(room);
        
        List<Map<String, Object>> studentList = new ArrayList<>();
        for (RoomParticipant p : participants) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("studentNumber", p.getStudentNumber());
            entry.put("fullName", p.getFullName());
            entry.put("section", p.getSection());

            Optional<StudentProfile> studentOpt = studentRepository.findByStudentNumber(p.getStudentNumber());
            int completedPhases = 0; // Phase 1 is active by default, 0 completed
            long attempts = 0;
            String currentStatus = "ACTIVE";
            String currentPhaseTitle = "Phase 1: Basic Gross Pay";

            if (studentOpt.isPresent()) {
                StudentProfile student = studentOpt.get();
                List<GameSession> activeSessions = gameSessionRepository.findByStudentProfileAndStatus(student, "ACTIVE");
                GameSession activeSession = activeSessions.isEmpty() ? null : activeSessions.get(0);

                if (activeSession != null) {
                    int phaseIndex = activeSession.getCurrentPhase();
                    String module = activeSession.getCurrentModule();
                    
                    if ("M1_MATH".equals(module)) completedPhases = (phaseIndex == 1) ? 0 : 1;
                    else if ("M2_MULTIPLIERS".equals(module)) completedPhases = (phaseIndex == 1) ? 2 : 3;
                    else if ("M3_BUREAUCRACY".equals(module)) completedPhases = (phaseIndex == 1) ? 4 : 5;
                    else if ("M4_TRIBUNAL".equals(module)) completedPhases = 6;
                    
                    if ("COMPLETED".equals(activeSession.getStatus())) {
                        completedPhases = 7;
                        currentStatus = "COMPLETED";
                        currentPhaseTitle = "Simulation Complete";
                    } else {
                        String[] titles = {
                            "Phase 1: Basic Gross Pay",
                            "Phase 2: Tardiness Deductions",
                            "Phase 3: Overtime Premiums",
                            "Phase 4: Regular Holiday Pay",
                            "Phase 5: SSS Deductions",
                            "Phase 6: PhilHealth Premiums",
                            "Phase 7: Net Payroll Boardroom"
                        };
                        currentPhaseTitle = (completedPhases >= 0 && completedPhases < 7) ? titles[completedPhases] : "Unknown";
                    }

                    if (activeSession.getStartTime() != null) {
                        attempts = attemptLogRepository.countAttemptsSince(student, activeSession.getStartTime());
                    }
                }
            }

            entry.put("completedPhases", completedPhases);
            entry.put("currentPhaseTitle", currentPhaseTitle);
            entry.put("attempts", attempts);
            entry.put("status", currentStatus);

            studentList.add(entry);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("roomCode", room.getRoomCode());
        response.put("status", room.getStatus());
        response.put("students", studentList);

        return ResponseEntity.ok(response);
    }

    // --- Internal Helpers ---

    private String generateUniqueRoomCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excludes confusable chars: I, O, 0, 1
        int maxAttempts = 20;
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                sb.append(chars.charAt(ThreadLocalRandom.current().nextInt(chars.length())));
            }
            String code = sb.toString();
            if (!roomRepository.existsByRoomCode(code)) {
                return code;
            }
        }
        // Extremely unlikely fallback: use timestamp-based code
        return "R" + System.currentTimeMillis() % 100000;
    }
}
