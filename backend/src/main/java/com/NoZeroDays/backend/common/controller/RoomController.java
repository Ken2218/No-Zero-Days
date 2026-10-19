package com.NoZeroDays.backend.common.controller;

import com.NoZeroDays.backend.common.model.AttemptLog;
import com.NoZeroDays.backend.common.model.GameSession;
import com.NoZeroDays.backend.common.model.Room;
import com.NoZeroDays.backend.common.model.RoomParticipant;
import com.NoZeroDays.backend.common.model.StudentProfile;
import com.NoZeroDays.backend.common.repository.AttemptLogRepository;
import com.NoZeroDays.backend.common.repository.GameSessionRepository;
import com.NoZeroDays.backend.common.repository.RoomParticipantRepository;
import com.NoZeroDays.backend.common.repository.RoomRepository;
import com.NoZeroDays.backend.common.repository.StudentProfileRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class RoomController {

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomParticipantRepository roomParticipantRepository;

    @Autowired
    private StudentProfileRepository studentRepository;

    @Autowired
    private GameSessionRepository gameSessionRepository;

    @Autowired
    private AttemptLogRepository attemptLogRepository;

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final String[] MODULES = {
        "M1_MATH", "M1_MATH",
        "M2_MULTIPLIERS", "M2_MULTIPLIERS",
        "M3_BUREAUCRACY", "M3_BUREAUCRACY",
        "M4_TRIBUNAL"
    };
    private static final int[] PHASES = {1, 2, 1, 2, 1, 2, 1};
    private static final String[] PHASE_TITLES = {
        "Phase 1: Basic Gross Pay",
        "Phase 2: Tardiness Deductions",
        "Phase 3: Overtime Premiums",
        "Phase 4: Regular Holiday Pay",
        "Phase 5: SSS Deductions",
        "Phase 6: PhilHealth Premiums",
        "Phase 7: Net Payroll Boardroom"
    };

    // -------------------------------------------------------------------------
    // 1. CREATE ROOM
    // -------------------------------------------------------------------------
    @PostMapping("/rooms/create")
    public ResponseEntity<?> createRoom(@RequestBody Map<String, String> body) {
        String teacherName = body.getOrDefault("teacherName", "Instructor");
        String section = body.getOrDefault("section", "");
        String customCode = body.get("roomCode");

        String roomCode;
        if (customCode != null && !customCode.trim().isEmpty()) {
            roomCode = customCode.trim().toUpperCase();
        } else {
            roomCode = generateUniqueRoomCode();
        }

        // Check if room code already exists
        Optional<Room> existing = roomRepository.findByRoomCodeIgnoreCase(roomCode);
        Room room;
        if (existing.isPresent()) {
            room = existing.get();
            room.setTeacherName(teacherName);
            room.setSection(section);
            room.setStatus("WAITING");
            room.setCreatedAt(LocalDateTime.now());
            room.setStartedAt(null);
        } else {
            room = new Room(roomCode, teacherName, section);
        }
        room = roomRepository.save(room);

        Map<String, Object> resp = new HashMap<>();
        resp.put("roomCode", room.getRoomCode());
        resp.put("teacherName", room.getTeacherName());
        resp.put("section", room.getSection());
        resp.put("status", room.getStatus());
        resp.put("createdAt", room.getCreatedAt());

        return ResponseEntity.ok(resp);
    }

    // -------------------------------------------------------------------------
    // 2. GET ROOM STATUS (Polled by StudentWaiting)
    // -------------------------------------------------------------------------
    @GetMapping("/rooms/{roomCode}/status")
    public ResponseEntity<?> getRoomStatus(@PathVariable String roomCode) {
        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode);
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Room not found: " + roomCode));
        }

        Room room = roomOpt.get();
        long count = roomParticipantRepository.countByRoom(room);

        Map<String, Object> resp = new HashMap<>();
        resp.put("roomCode", room.getRoomCode());
        resp.put("status", room.getStatus());
        resp.put("participantCount", count);
        resp.put("teacherName", room.getTeacherName());
        resp.put("section", room.getSection());
        resp.put("startedAt", room.getStartedAt());

        return ResponseEntity.ok(resp);
    }

    // -------------------------------------------------------------------------
    // 3. GET ROOM PARTICIPANTS (Polled by TeacherLobby)
    // -------------------------------------------------------------------------
    @GetMapping("/rooms/{roomCode}/participants")
    public ResponseEntity<?> getRoomParticipants(@PathVariable String roomCode) {
        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode);
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Room not found: " + roomCode));
        }

        Room room = roomOpt.get();
        List<RoomParticipant> participants = roomParticipantRepository.findByRoomOrderByJoinedAtAsc(room);

        List<Map<String, Object>> participantList = participants.stream().map(p -> {
            Map<String, Object> item = new HashMap<>();
            StudentProfile s = p.getStudentProfile();
            item.put("studentNumber", s.getStudentNumber());
            item.put("fullName", s.getFullName());
            item.put("section", s.getSection() != null ? s.getSection() : room.getSection());
            item.put("joinedAt", p.getJoinedAt());
            return item;
        }).collect(Collectors.toList());

        Map<String, Object> resp = new HashMap<>();
        resp.put("roomCode", room.getRoomCode());
        resp.put("participantCount", participantList.size());
        resp.put("participants", participantList);

        return ResponseEntity.ok(resp);
    }

    // -------------------------------------------------------------------------
    // 4. START ROOM SESSION (Triggered by TeacherLobby)
    // -------------------------------------------------------------------------
    @PostMapping("/rooms/{roomCode}/start")
    public ResponseEntity<?> startRoom(@PathVariable String roomCode) {
        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode);
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Room not found: " + roomCode));
        }

        Room room = roomOpt.get();
        room.setStatus("ACTIVE");
        room.setStartedAt(LocalDateTime.now());
        roomRepository.save(room);

        // Ensure all registered participants have an active GameSession initialized
        List<RoomParticipant> participants = roomParticipantRepository.findByRoomOrderByJoinedAtAsc(room);
        for (RoomParticipant p : participants) {
            StudentProfile profile = p.getStudentProfile();
            List<GameSession> activeSessions = gameSessionRepository.findByStudentProfileAndStatus(profile, "ACTIVE");
            if (activeSessions.isEmpty()) {
                GameSession newSession = new GameSession(profile);
                newSession.setCurrentModule("M1_MATH");
                newSession.setCurrentPhase(1);
                newSession.setStatus("ACTIVE");
                newSession.setStartTime(room.getStartedAt());
                gameSessionRepository.save(newSession);
            }
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("roomCode", room.getRoomCode());
        resp.put("status", "ACTIVE");
        resp.put("startedAt", room.getStartedAt());

        return ResponseEntity.ok(resp);
    }

    // -------------------------------------------------------------------------
    // 5. STUDENT JOINS ROOM
    // -------------------------------------------------------------------------
    @PostMapping("/rooms/join")
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

        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode.trim());
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Room code '" + roomCode.toUpperCase() + "' does not exist. Check with your teacher."));
        }
        Room room = roomOpt.get();

        StudentProfile profile = resolveOrCreateStudent(studentNumber.trim(), fullName, section, room.getSection());

        // Add to room participants if not already present
        Optional<RoomParticipant> participantOpt = roomParticipantRepository.findByRoomAndStudentProfile(room, profile);
        if (participantOpt.isEmpty()) {
            RoomParticipant participant = new RoomParticipant(room, profile);
            roomParticipantRepository.save(participant);
        }

        // Initialize active game session if none exists
        List<GameSession> activeSessions = gameSessionRepository.findByStudentProfileAndStatus(profile, "ACTIVE");
        if (activeSessions.isEmpty()) {
            GameSession newSession = new GameSession(profile);
            newSession.setCurrentModule("M1_MATH");
            newSession.setCurrentPhase(1);
            newSession.setStatus("ACTIVE");
            if (room.getStartedAt() != null) {
                newSession.setStartTime(room.getStartedAt());
            }
            gameSessionRepository.save(newSession);
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("roomCode", room.getRoomCode());
        resp.put("student", profile);
        resp.put("roomStatus", room.getStatus());

        return ResponseEntity.ok(resp);
    }

    // -------------------------------------------------------------------------
    // 6. TEACHER ADDS STUDENT TO ROOM
    // -------------------------------------------------------------------------
    @PostMapping("/rooms/{roomCode}/students")
    public ResponseEntity<?> addStudentToRoom(@PathVariable String roomCode, @RequestBody Map<String, String> body) {
        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode);
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Room not found: " + roomCode));
        }
        Room room = roomOpt.get();

        String studentNumber = body.get("studentNumber");
        String fullName = body.get("fullName");
        String section = body.get("section");

        if (studentNumber == null || studentNumber.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Student number is required."));
        }
        if (fullName == null || fullName.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Student full name is required."));
        }

        StudentProfile profile = resolveOrCreateStudent(studentNumber.trim(), fullName.trim(), section, room.getSection());

        // Check if participant already exists in this room
        Optional<RoomParticipant> participantOpt = roomParticipantRepository.findByRoomAndStudentProfile(room, profile);
        if (participantOpt.isPresent()) {
            return ResponseEntity.ok(Map.of("success", true, "message", "Student is already in this room.", "student", profile));
        }

        RoomParticipant participant = new RoomParticipant(room, profile);
        roomParticipantRepository.save(participant);

        // Ensure active game session
        List<GameSession> activeSessions = gameSessionRepository.findByStudentProfileAndStatus(profile, "ACTIVE");
        if (activeSessions.isEmpty()) {
            GameSession newSession = new GameSession(profile);
            newSession.setCurrentModule("M1_MATH");
            newSession.setCurrentPhase(1);
            newSession.setStatus("ACTIVE");
            if (room.getStartedAt() != null) {
                newSession.setStartTime(room.getStartedAt());
            }
            gameSessionRepository.save(newSession);
        }

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Student added successfully.",
            "student", profile
        ));
    }

    // -------------------------------------------------------------------------
    // 7. TEACHER DELETES / REMOVES STUDENT FROM ROOM
    // -------------------------------------------------------------------------
    @DeleteMapping("/rooms/{roomCode}/students/{studentNumber}")
    @Transactional
    public ResponseEntity<?> removeStudentFromRoom(@PathVariable String roomCode, @PathVariable String studentNumber) {
        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode);
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Room not found: " + roomCode));
        }
        Room room = roomOpt.get();

        Optional<StudentProfile> studentOpt = studentRepository.findByStudentNumber(studentNumber);
        if (studentOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Student not found: " + studentNumber));
        }
        StudentProfile student = studentOpt.get();

        roomParticipantRepository.deleteByRoomAndStudentProfile(room, student);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Student " + student.getFullName() + " (" + studentNumber + ") removed from room " + roomCode
        ));
    }

    // -------------------------------------------------------------------------
    // 8. DELETE STUDENT PROFILE (Global)
    // -------------------------------------------------------------------------
    @DeleteMapping("/students/{studentNumber}")
    @Transactional
    public ResponseEntity<?> deleteStudentEntirely(@PathVariable String studentNumber) {
        Optional<StudentProfile> studentOpt = studentRepository.findByStudentNumber(studentNumber);
        if (studentOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Student not found: " + studentNumber));
        }
        StudentProfile student = studentOpt.get();

        roomParticipantRepository.deleteByStudentProfile(student);
        attemptLogRepository.deleteByStudentProfile(student);
        gameSessionRepository.deleteByStudentProfile(student);
        studentRepository.delete(student);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Student " + studentNumber + " permanently deleted."
        ));
    }

    // -------------------------------------------------------------------------
    // 9. TEACHER DASHBOARD ANALYTICS WITH PER-PHASE TIME & ATTEMPTS & SUMMARY
    // -------------------------------------------------------------------------
    @GetMapping("/rooms/{roomCode}/dashboard")
    public ResponseEntity<?> getRoomDashboard(@PathVariable String roomCode) {
        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode);
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Room not found: " + roomCode));
        }
        Room room = roomOpt.get();

        List<RoomParticipant> participants = roomParticipantRepository.findByRoomOrderByJoinedAtAsc(room);
        LocalDateTime roomStartedAt = room.getStartedAt() != null ? room.getStartedAt() : room.getCreatedAt();

        List<Map<String, Object>> studentResults = new ArrayList<>();

        // Aggregators for Class Summary & Charts
        int[] classPhaseCompletedCounts = new int[7];
        int[] classPhaseActiveCounts = new int[7];
        long[] classPhaseTotalAttempts = new long[7];
        long[] classPhaseTotalSeconds = new long[7];
        int[] classPhaseTimeContributors = new int[7];

        int totalRoomAttempts = 0;
        int completedStudentsCount = 0;

        for (RoomParticipant p : participants) {
            StudentProfile student = p.getStudentProfile();

            // Fetch active session
            List<GameSession> activeSessions = gameSessionRepository.findByStudentProfileAndStatus(student, "ACTIVE");
            GameSession session = activeSessions.isEmpty() ? null : activeSessions.get(0);
            int currentPhaseIndex = session != null ? session.getCurrentPhase() : 1;
            boolean isSessionCompleted = session != null && "COMPLETED".equalsIgnoreCase(session.getStatus());

            // Fetch all attempts for this student sorted chronologically
            List<AttemptLog> allAttempts = attemptLogRepository.findByStudentProfileOrderByAttemptTimeAsc(student);

            // Group attempts by (module + "_" + phase)
            Map<String, List<AttemptLog>> phaseAttemptsMap = new HashMap<>();
            for (AttemptLog log : allAttempts) {
                String key = (log.getModule() != null ? log.getModule().toUpperCase() : "") + "_" + log.getPhase();
                phaseAttemptsMap.computeIfAbsent(key, k -> new ArrayList<>()).add(log);
            }

            List<Map<String, Object>> studentPhases = new ArrayList<>();
            LocalDateTime previousPhaseCompletedTime = roomStartedAt;
            int studentCompletedPhases = 0;
            long studentTotalSeconds = 0;
            int studentTotalAttempts = 0;

            for (int i = 0; i < 7; i++) {
                int phaseId = i + 1;
                String module = MODULES[i];
                int phaseIndex = PHASES[i];
                String phaseKey = module.toUpperCase() + "_" + phaseIndex;
                List<AttemptLog> attempts = phaseAttemptsMap.getOrDefault(phaseKey, Collections.emptyList());

                int attemptsCount = attempts.size();
                studentTotalAttempts += attemptsCount;
                classPhaseTotalAttempts[i] += attemptsCount;

                int failedCount = 0;
                LocalDateTime lastSuccessfulTime = null;
                LocalDateTime firstAttemptTime = attempts.isEmpty() ? null : attempts.get(0).getAttemptTime();
                LocalDateTime lastAttemptTime = attempts.isEmpty() ? null : attempts.get(attempts.size() - 1).getAttemptTime();

                for (AttemptLog log : attempts) {
                    if (!log.isSuccessful()) {
                        failedCount++;
                    } else {
                        lastSuccessfulTime = log.getAttemptTime();
                    }
                }

                // Check phase completion
                boolean isCompleted = false;
                if (isSessionCompleted || phaseId < currentPhaseIndex) {
                    isCompleted = true;
                } else if (lastSuccessfulTime != null && isPhaseCompleteBySteps(attempts, module, phaseIndex)) {
                    isCompleted = true;
                }

                String status = "LOCKED";
                if (isCompleted) {
                    status = "COMPLETED";
                    studentCompletedPhases++;
                    classPhaseCompletedCounts[i]++;
                } else if (phaseId == currentPhaseIndex || (phaseId == 1 && studentCompletedPhases == 0)) {
                    status = "ACTIVE";
                    classPhaseActiveCounts[i]++;
                }

                // Calculate time spent in this phase
                long phaseSeconds = 0;
                if (isCompleted) {
                    LocalDateTime startRef = (firstAttemptTime != null && firstAttemptTime.isBefore(previousPhaseCompletedTime))
                            ? firstAttemptTime : previousPhaseCompletedTime;
                    LocalDateTime endRef = lastSuccessfulTime != null ? lastSuccessfulTime : (lastAttemptTime != null ? lastAttemptTime : startRef);

                    long diff = ChronoUnit.SECONDS.between(startRef, endRef);
                    if (diff <= 0) {
                        diff = Math.max(attemptsCount * 45L, 30L);
                    }
                    phaseSeconds = diff;
                    previousPhaseCompletedTime = endRef;
                    studentTotalSeconds += phaseSeconds;

                    classPhaseTotalSeconds[i] += phaseSeconds;
                    classPhaseTimeContributors[i]++;
                } else if ("ACTIVE".equals(status)) {
                    LocalDateTime startRef = (firstAttemptTime != null && firstAttemptTime.isBefore(previousPhaseCompletedTime))
                            ? firstAttemptTime : previousPhaseCompletedTime;
                    long diff = ChronoUnit.SECONDS.between(startRef, LocalDateTime.now());
                    phaseSeconds = Math.max(diff, 0L);
                    studentTotalSeconds += phaseSeconds;
                }

                int bestScore = 0;
                if (isCompleted) {
                    bestScore = Math.max(100 - (failedCount * 10), 50);
                }

                Map<String, Object> phaseObj = new HashMap<>();
                phaseObj.put("phaseId", phaseId);
                phaseObj.put("title", PHASE_TITLES[i]);
                phaseObj.put("module", module);
                phaseObj.put("phaseIndex", phaseIndex);
                phaseObj.put("status", status);
                phaseObj.put("attempts", attemptsCount);
                phaseObj.put("failedAttempts", failedCount);
                phaseObj.put("bestScore", bestScore);
                phaseObj.put("timeSpentSeconds", phaseSeconds);
                phaseObj.put("timeSpentFormatted", formatDuration(phaseSeconds, status));

                studentPhases.add(phaseObj);
            }

            if (studentCompletedPhases >= 7) {
                completedStudentsCount++;
            }
            totalRoomAttempts += studentTotalAttempts;

            String currentPhaseTitle = (currentPhaseIndex <= 7)
                    ? PHASE_TITLES[currentPhaseIndex - 1]
                    : "Final Audit Complete";

            Map<String, Object> stuMap = new HashMap<>();
            stuMap.put("studentNumber", student.getStudentNumber());
            stuMap.put("fullName", student.getFullName());
            stuMap.put("section", student.getSection() != null ? student.getSection() : room.getSection());
            stuMap.put("completedPhases", studentCompletedPhases);
            stuMap.put("currentPhase", currentPhaseIndex);
            stuMap.put("currentPhaseTitle", currentPhaseTitle);
            stuMap.put("attempts", studentTotalAttempts);
            stuMap.put("status", (studentCompletedPhases >= 7 || isSessionCompleted) ? "COMPLETED" : "ACTIVE");
            stuMap.put("totalTimeSpentSeconds", studentTotalSeconds);
            stuMap.put("totalTimeFormatted", formatDuration(studentTotalSeconds, "ACTIVE"));
            stuMap.put("phases", studentPhases);

            studentResults.add(stuMap);
        }

        // Build Class Summary and Chart Metrics
        List<Map<String, Object>> summaryPhases = new ArrayList<>();
        int totalStudents = studentResults.size();

        for (int i = 0; i < 7; i++) {
            Map<String, Object> sp = new HashMap<>();
            sp.put("phaseId", i + 1);
            sp.put("title", PHASE_TITLES[i]);
            sp.put("completedCount", classPhaseCompletedCounts[i]);
            sp.put("activeCount", classPhaseActiveCounts[i]);
            sp.put("totalAttempts", classPhaseTotalAttempts[i]);

            double avgAttempts = totalStudents > 0
                    ? Math.round((double) classPhaseTotalAttempts[i] / totalStudents * 10.0) / 10.0
                    : 0.0;
            sp.put("avgAttempts", avgAttempts);

            long avgSeconds = classPhaseTimeContributors[i] > 0
                    ? classPhaseTotalSeconds[i] / classPhaseTimeContributors[i]
                    : 0;
            sp.put("avgTimeSeconds", avgSeconds);
            sp.put("avgTimeFormatted", formatDuration(avgSeconds, "COMPLETED"));

            summaryPhases.add(sp);
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalStudents", totalStudents);
        summary.put("completedStudents", completedStudentsCount);
        summary.put("activeStudents", Math.max(0, totalStudents - completedStudentsCount));
        summary.put("totalAttempts", totalRoomAttempts);
        summary.put("phaseStats", summaryPhases);

        Map<String, Object> response = new HashMap<>();
        response.put("roomCode", room.getRoomCode());
        response.put("teacherName", room.getTeacherName());
        response.put("section", room.getSection());
        response.put("status", room.getStatus());
        response.put("startedAt", room.getStartedAt());
        response.put("summary", summary);
        response.put("students", studentResults);

        return ResponseEntity.ok(response);
    }

    // -------------------------------------------------------------------------
    // HELPER METHODS
    // -------------------------------------------------------------------------

    private StudentProfile resolveOrCreateStudent(String studentNumber, String fullName, String section, String defaultSection) {
        Optional<StudentProfile> existing = studentRepository.findByStudentNumber(studentNumber);
        if (existing.isPresent()) {
            StudentProfile s = existing.get();
            if (fullName != null && !fullName.trim().isEmpty()) {
                s.setFullName(fullName.trim());
            }
            if (section != null && !section.trim().isEmpty()) {
                s.setSection(section.trim());
            }
            return studentRepository.save(s);
        }

        String actualSection = (section != null && !section.trim().isEmpty()) ? section.trim() : defaultSection;
        StudentProfile newProfile = new StudentProfile(
                studentNumber,
                (fullName != null && !fullName.trim().isEmpty()) ? fullName.trim() : "Student " + studentNumber,
                actualSection
        );
        return studentRepository.save(newProfile);
    }

    private boolean isPhaseCompleteBySteps(List<AttemptLog> attempts, String module, int phase) {
        List<String> requiredSteps = getRequiredStepsForPhase(module, phase);
        if (requiredSteps.isEmpty()) return false;

        Set<String> successfulSteps = attempts.stream()
                .filter(AttemptLog::isSuccessful)
                .map(a -> a.getStep() != null ? a.getStep().toUpperCase() : "")
                .collect(Collectors.toSet());

        return requiredSteps.stream().allMatch(step -> successfulSteps.contains(step.toUpperCase()));
    }

    private List<String> getRequiredStepsForPhase(String module, int phase) {
        if ("M1_MATH".equalsIgnoreCase(module) && phase == 1) {
            return Arrays.asList("EXTRACT", "IDENTIFY_RULE", "EXECUTE");
        } else if ("M1_MATH".equalsIgnoreCase(module) && phase == 2) {
            return Arrays.asList("EXTRACT", "IDENTIFY_RULE", "EXECUTE", "COMPUTE_GROSS", "NET_PAY_FORMULA", "SYNTHESIS");
        } else if ("M2_MULTIPLIERS".equalsIgnoreCase(module)) {
            if (phase == 1) {
                return Arrays.asList("EXTRACT", "FILTER_LUNCH", "ESTABLISH_PREMIUM", "ESTABLISH_FORMULA", "EXECUTE", "COMPUTE_GROSS", "NET_PAY_FORMULA", "SYNTHESIS");
            } else {
                return Arrays.asList("EXTRACT", "ESTABLISH_PREMIUM", "ESTABLISH_FORMULA", "EXECUTE", "COMPUTE_GROSS", "NET_PAY_FORMULA", "SYNTHESIS");
            }
        } else if ("M3_BUREAUCRACY".equalsIgnoreCase(module)) {
            if (phase == 1) {
                return Arrays.asList("EXTRACT", "PAGIBIG_DEDUCTION", "BASIC_SALARY", "IDENTIFY_RULE", "SYNTHESIS");
            } else {
                return Arrays.asList("EXTRACT", "PHILHEALTH_EE", "TAX_BRACKET", "WITHHOLDING_TAX", "SYNTHESIS");
            }
        } else if ("M4_TRIBUNAL".equalsIgnoreCase(module)) {
            return Collections.singletonList("SUBMIT");
        }
        return Collections.emptyList();
    }

    private String formatDuration(long totalSeconds, String status) {
        if ("LOCKED".equals(status) || totalSeconds <= 0) {
            return "--";
        }
        long hours = totalSeconds / 3600;
        long minutes = (totalSeconds % 3600) / 60;
        long seconds = totalSeconds % 60;

        if (hours > 0) {
            return String.format("%dh %02dm", hours, minutes);
        } else if (minutes > 0) {
            return String.format("%dm %02ds", minutes, seconds);
        } else {
            return String.format("%ds", seconds);
        }
    }

    private String generateUniqueRoomCode() {
        for (int attempts = 0; attempts < 50; attempts++) {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
            }
            String code = sb.toString();
            if (!roomRepository.existsByRoomCodeIgnoreCase(code)) {
                return code;
            }
        }
        return "NZD" + (100 + RANDOM.nextInt(900));
    }
}
