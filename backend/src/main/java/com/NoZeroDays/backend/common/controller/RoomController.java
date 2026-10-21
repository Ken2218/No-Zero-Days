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

import com.NoZeroDays.backend.common.model.Teacher;
import com.NoZeroDays.backend.common.repository.TeacherRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
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
    private TeacherRepository teacherRepository;

    @Autowired
    private RoomParticipantRepository roomParticipantRepository;

    @Autowired
    private StudentProfileRepository studentRepository;

    @Autowired
    private GameSessionRepository gameSessionRepository;

    @Autowired
    private AttemptLogRepository attemptLogRepository;

    @Autowired
    private com.NoZeroDays.backend.common.service.EmailReportService emailReportService;

    @Autowired
    private com.NoZeroDays.backend.common.service.AuthService authService;

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
    // -------------------------------------------------------------------------
    // 0A. TEACHER REGISTRATION (Master Account Creation)
    // -------------------------------------------------------------------------
    @PostMapping(value = {"/teachers/register", "/teachers/register/"})
    public ResponseEntity<?> registerTeacher(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", body.getOrDefault("teacherEmail", "")).trim();
        String fullName = body.getOrDefault("fullName", body.getOrDefault("teacherName", "")).trim();

        if (email.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required."));
        }
        if (!email.toLowerCase().endsWith("@gmail.com")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email must be a valid @gmail.com address."));
        }
        if (fullName.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Full name is required."));
        }

        Teacher teacher = teacherRepository.findByEmailIgnoreCase(email)
                .orElseGet(() -> new Teacher(email, fullName));
        teacher.setFullName(fullName);
        teacher = teacherRepository.save(teacher);

        Map<String, Object> resp = new HashMap<>();
        resp.put("id", teacher.getId());
        resp.put("email", teacher.getEmail());
        resp.put("fullName", teacher.getFullName());
        resp.put("teacherName", teacher.getFullName());
        resp.put("teacherEmail", teacher.getEmail());
        return ResponseEntity.ok(resp);
    }

    // -------------------------------------------------------------------------
    // 0B. TEACHER LOGIN (Master Account Verification)
    // -------------------------------------------------------------------------
    @PostMapping(value = {"/teachers/login", "/teachers/login/"})
    public ResponseEntity<?> loginTeacher(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", body.getOrDefault("teacherEmail", "")).trim();
        String fullName = body.getOrDefault("fullName", body.getOrDefault("teacherName", "")).trim();

        if (email.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required."));
        }
        if (!email.toLowerCase().endsWith("@gmail.com")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email must be a valid @gmail.com address."));
        }

        Optional<Teacher> opt = teacherRepository.findByEmailIgnoreCase(email);
        Teacher teacher;
        if (opt.isPresent()) {
            teacher = opt.get();
            if (!fullName.isEmpty()) {
                teacher.setFullName(fullName);
                teacher = teacherRepository.save(teacher);
            }
        } else {
            // Check if any rooms exist with this teacher email to auto-sync
            List<Room> existingRooms = roomRepository.findByTeacherEmailIgnoreCaseOrderByCreatedAtDesc(email);
            if (!existingRooms.isEmpty()) {
                String existingName = !fullName.isEmpty() ? fullName : existingRooms.get(0).getTeacherName();
                teacher = teacherRepository.save(new Teacher(email, existingName));
                for (Room r : existingRooms) {
                    if (r.getTeacher() == null) {
                        r.setTeacher(teacher);
                        roomRepository.save(r);
                    }
                }
            } else if (!fullName.isEmpty()) {
                teacher = teacherRepository.save(new Teacher(email, fullName));
            } else {
                return ResponseEntity.status(404).body(Map.of("error", "Teacher account not found for '" + email + "'. Please sign up first."));
            }
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("id", teacher.getId());
        resp.put("email", teacher.getEmail());
        resp.put("fullName", teacher.getFullName());
        resp.put("teacherName", teacher.getFullName());
        resp.put("teacherEmail", teacher.getEmail());
        return ResponseEntity.ok(resp);
    }

    // -------------------------------------------------------------------------
    // 1. CREATE ROOM
    // -------------------------------------------------------------------------
    @PostMapping("/rooms/create")
    public ResponseEntity<?> createRoom(@RequestBody Map<String, String> body) {
        String teacherName = body.getOrDefault("teacherName", "Instructor");
        String section = body.getOrDefault("section", "");
        String teacherEmail = body.getOrDefault("teacherEmail", "");
        String customCode = body.get("roomCode");

        String roomCode;
        if (customCode != null && !customCode.trim().isEmpty()) {
            roomCode = customCode.trim().toUpperCase();
        } else {
            roomCode = generateUniqueRoomCode();
        }

        // Find or create Teacher entity for master association
        Teacher teacher = null;
        if (!teacherEmail.isBlank()) {
            teacher = teacherRepository.findByEmailIgnoreCase(teacherEmail.trim())
                    .orElseGet(() -> teacherRepository.save(new Teacher(teacherEmail.trim(), teacherName)));
        } else if (!teacherName.isBlank()) {
            teacher = teacherRepository.findByFullNameIgnoreCase(teacherName.trim()).orElse(null);
        }

        // Check if room code already exists
        Optional<Room> existing = roomRepository.findByRoomCodeIgnoreCase(roomCode);
        Room room;
        if (existing.isPresent()) {
            room = existing.get();
            room.setTeacherName(teacherName);
            room.setSection(section);
            if (!teacherEmail.isBlank()) {
                room.setTeacherEmail(teacherEmail.trim());
            }
            if (teacher != null) {
                room.setTeacher(teacher);
            }
            room.setStatus("WAITING");
            room.setCreatedAt(LocalDateTime.now());
            room.setStartedAt(null);
        } else {
            room = new Room(roomCode, teacherName, section, teacherEmail.trim());
            if (teacher != null) {
                room.setTeacher(teacher);
            }
        }
        room = roomRepository.save(room);

        Map<String, Object> resp = new HashMap<>();
        resp.put("roomCode", room.getRoomCode());
        resp.put("teacherName", room.getTeacherName());
        resp.put("teacherEmail", room.getTeacherEmail());
        resp.put("section", room.getSection());
        resp.put("status", room.getStatus());
        resp.put("createdAt", room.getCreatedAt());
        if (teacher != null) {
            resp.put("teacherId", teacher.getId());
        }

        return ResponseEntity.ok(resp);
    }

    // -------------------------------------------------------------------------
    // 1B. GET TEACHER ROOMS (List all rooms/sections for persistent teacher)
    // -------------------------------------------------------------------------
    @GetMapping("/teachers/rooms")
    public ResponseEntity<?> getTeacherRooms(
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String teacherEmail,
            @RequestParam(required = false) String teacherName,
            @RequestParam(required = false) Long teacherId) {
        String effectiveEmail = (email != null && !email.isBlank()) ? email.trim() :
                                (teacherEmail != null && !teacherEmail.isBlank()) ? teacherEmail.trim() : null;

        List<Room> rooms = Collections.emptyList();
        if (teacherId != null) {
            rooms = roomRepository.findByTeacherIdOrderByCreatedAtDesc(teacherId);
        }
        if (rooms.isEmpty() && effectiveEmail != null) {
            Optional<Teacher> t = teacherRepository.findByEmailIgnoreCase(effectiveEmail);
            if (t.isPresent()) {
                rooms = roomRepository.findByTeacherOrderByCreatedAtDesc(t.get());
            }
            if (rooms.isEmpty()) {
                rooms = roomRepository.findByTeacherEmailIgnoreCaseOrderByCreatedAtDesc(effectiveEmail);
            }
        }
        if (rooms.isEmpty() && teacherName != null && !teacherName.isBlank()) {
            Optional<Teacher> t = teacherRepository.findByFullNameIgnoreCase(teacherName.trim());
            if (t.isPresent()) {
                rooms = roomRepository.findByTeacherOrderByCreatedAtDesc(t.get());
            }
            if (rooms.isEmpty()) {
                rooms = roomRepository.findByTeacherNameIgnoreCaseOrderByCreatedAtDesc(teacherName.trim());
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Room r : rooms) {
            Map<String, Object> map = new HashMap<>();
            map.put("roomCode", r.getRoomCode());
            map.put("section", r.getSection() != null ? r.getSection() : "Default Section");
            map.put("teacherName", r.getTeacherName());
            map.put("teacherEmail", r.getTeacherEmail());
            map.put("status", r.getStatus());
            map.put("createdAt", r.getCreatedAt());
            map.put("startedAt", r.getStartedAt());
            map.put("participantCount", roomParticipantRepository.countByRoom(r));
            result.add(map);
        }

        return ResponseEntity.ok(result);
    }

    // -------------------------------------------------------------------------
    // 1C. FIND ROOM BY TEACHER (Session recovery & section lookup)
    // -------------------------------------------------------------------------
    @GetMapping("/rooms/find-by-teacher")
    public ResponseEntity<?> findByTeacher(
            @RequestParam(required = false) String teacherEmail,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String teacherName,
            @RequestParam(required = false) String section) {
        String effectiveEmail = (teacherEmail != null && !teacherEmail.isBlank()) ? teacherEmail.trim() :
                                (email != null && !email.isBlank()) ? email.trim() : null;

        List<Room> rooms = Collections.emptyList();
        if (effectiveEmail != null) {
            rooms = roomRepository.findByTeacherEmailIgnoreCaseOrderByCreatedAtDesc(effectiveEmail);
        }
        if (rooms.isEmpty() && teacherName != null && !teacherName.isBlank()) {
            rooms = roomRepository.findByTeacherNameIgnoreCaseOrderByCreatedAtDesc(teacherName.trim());
        }

        if (rooms.isEmpty()) {
            return ResponseEntity.ok(Map.of("found", false));
        }

        Room matched = rooms.get(0);
        if (section != null && !section.isBlank()) {
            for (Room r : rooms) {
                if (section.trim().equalsIgnoreCase(r.getSection())) {
                    matched = r;
                    break;
                }
            }
        }

        List<Map<String, Object>> roomList = new ArrayList<>();
        for (Room r : rooms) {
            Map<String, Object> map = new HashMap<>();
            map.put("roomCode", r.getRoomCode());
            map.put("section", r.getSection());
            map.put("teacherName", r.getTeacherName());
            map.put("teacherEmail", r.getTeacherEmail());
            map.put("status", r.getStatus());
            map.put("createdAt", r.getCreatedAt());
            map.put("participantCount", roomParticipantRepository.countByRoom(r));
            roomList.add(map);
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("found", true);
        resp.put("roomCode", matched.getRoomCode());
        resp.put("section", matched.getSection());
        resp.put("teacherName", matched.getTeacherName());
        resp.put("teacherEmail", matched.getTeacherEmail());
        resp.put("status", matched.getStatus());
        resp.put("rooms", roomList);

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
        resp.put("teacherEmail", room.getTeacherEmail());
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
            item.put("status", p.getStatus() != null ? p.getStatus() : "ACCEPTED");
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
            RoomParticipant participant = new RoomParticipant(room, profile, "ACCEPTED");
            roomParticipantRepository.save(participant);
        } else {
            RoomParticipant participant = participantOpt.get();
            participant.setStatus("ACCEPTED");
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
    // 6. TEACHER ADDS STUDENT TO ROOM (WITH VALIDATION & INVITATION)
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

        if (studentNumber == null || studentNumber.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Student number is required."));
        }
        if (fullName == null || fullName.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Student full name is required."));
        }

        String trimmedNumber = studentNumber.trim();
        String trimmedName = fullName.trim();

        // 1. Validation: student number must exist in database
        Optional<StudentProfile> studentOpt = studentRepository.findByStudentNumber(trimmedNumber);
        if (studentOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of(
                "error", "Student number '" + trimmedNumber + "' does not exist. Student must register an account first."
            ));
        }

        StudentProfile profile = studentOpt.get();

        // 2. Validation: student name must flexibly match registered record
        if (profile.getFullName() == null || !authService.isFlexibleNameMatch(profile.getFullName(), trimmedName)) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Student name '" + trimmedName + "' does not match registered record for ID '" + trimmedNumber + "'. (Expected: " + profile.getFullName() + ")"
            ));
        }

        // 3. Check if participant already exists in this room
        Optional<RoomParticipant> participantOpt = roomParticipantRepository.findByRoomAndStudentProfile(room, profile);
        if (participantOpt.isPresent()) {
            RoomParticipant existing = participantOpt.get();
            if ("ACCEPTED".equalsIgnoreCase(existing.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Student " + profile.getFullName() + " (" + trimmedNumber + ") is already in this room."
                ));
            } else if ("INVITED".equalsIgnoreCase(existing.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Student " + profile.getFullName() + " (" + trimmedNumber + ") has already been invited to this room."
                ));
            } else {
                existing.setStatus("INVITED");
                existing.setJoinedAt(LocalDateTime.now());
                roomParticipantRepository.save(existing);
                return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Invitation re-sent to " + profile.getFullName() + ".",
                    "student", profile
                ));
            }
        }

        RoomParticipant participant = new RoomParticipant(room, profile, "INVITED");
        roomParticipantRepository.save(participant);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Student " + profile.getFullName() + " added and invited to room.",
            "student", profile
        ));
    }

    // -------------------------------------------------------------------------
    // 6A. CHECK STUDENT INVITATIONS (Polled by Student UI)
    // -------------------------------------------------------------------------
    @GetMapping("/students/{studentNumber}/invitations")
    public ResponseEntity<?> getStudentInvitations(@PathVariable String studentNumber) {
        Optional<StudentProfile> studentOpt = studentRepository.findByStudentNumber(studentNumber.trim());
        if (studentOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of("hasInvitation", false));
        }

        StudentProfile student = studentOpt.get();
        Optional<RoomParticipant> inviteOpt =
                roomParticipantRepository.findFirstByStudentProfileAndStatusOrderByJoinedAtDesc(student, "INVITED");

        if (inviteOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of("hasInvitation", false));
        }

        RoomParticipant p = inviteOpt.get();
        Room room = p.getRoom();

        Map<String, Object> resp = new HashMap<>();
        resp.put("hasInvitation", true);
        resp.put("roomCode", room.getRoomCode());
        resp.put("teacherName", room.getTeacherName());
        resp.put("teacherEmail", room.getTeacherEmail());
        resp.put("section", room.getSection());
        resp.put("roomStatus", room.getStatus());

        return ResponseEntity.ok(resp);
    }

    // -------------------------------------------------------------------------
    // 6B. STUDENT ACCEPTS ROOM INVITATION
    // -------------------------------------------------------------------------
    @PostMapping("/rooms/{roomCode}/invitations/accept")
    public ResponseEntity<?> acceptRoomInvitation(@PathVariable String roomCode, @RequestBody Map<String, String> body) {
        String studentNumber = body.get("studentNumber");
        if (studentNumber == null || studentNumber.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Student number is required."));
        }

        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode.trim());
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Room not found: " + roomCode));
        }
        Room room = roomOpt.get();

        Optional<StudentProfile> studentOpt = studentRepository.findByStudentNumber(studentNumber.trim());
        if (studentOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Student not found: " + studentNumber));
        }
        StudentProfile student = studentOpt.get();

        Optional<RoomParticipant> partOpt = roomParticipantRepository.findByRoomAndStudentProfile(room, student);
        if (partOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "No invitation found for room " + roomCode));
        }

        RoomParticipant participant = partOpt.get();
        participant.setStatus("ACCEPTED");
        participant.setJoinedAt(LocalDateTime.now());
        roomParticipantRepository.save(participant);

        // Ensure active game session exists
        List<GameSession> activeSessions = gameSessionRepository.findByStudentProfileAndStatus(student, "ACTIVE");
        if (activeSessions.isEmpty()) {
            GameSession newSession = new GameSession(student);
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
        resp.put("message", "Invitation accepted.");
        resp.put("roomCode", room.getRoomCode());
        resp.put("roomStatus", room.getStatus());
        resp.put("student", student);

        return ResponseEntity.ok(resp);
    }

    // -------------------------------------------------------------------------
    // 6C. STUDENT DECLINES ROOM INVITATION
    // -------------------------------------------------------------------------
    @PostMapping("/rooms/{roomCode}/invitations/decline")
    @Transactional
    public ResponseEntity<?> declineRoomInvitation(@PathVariable String roomCode, @RequestBody Map<String, String> body) {
        String studentNumber = body.get("studentNumber");
        if (studentNumber == null || studentNumber.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Student number is required."));
        }

        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode.trim());
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Room not found: " + roomCode));
        }
        Room room = roomOpt.get();

        Optional<StudentProfile> studentOpt = studentRepository.findByStudentNumber(studentNumber.trim());
        if (studentOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Student not found: " + studentNumber));
        }
        StudentProfile student = studentOpt.get();

        roomParticipantRepository.deleteByRoomAndStudentProfile(room, student);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Room invitation declined."
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
    @DeleteMapping("/students/{studentNumber:^(?!login$|register$).+$}")
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

                int failedCount = 0;
                int drillResets = 0;
                LocalDateTime lastSuccessfulTime = null;
                LocalDateTime firstAttemptTime = attempts.isEmpty() ? null : attempts.get(0).getAttemptTime();
                LocalDateTime lastAttemptTime = attempts.isEmpty() ? null : attempts.get(attempts.size() - 1).getAttemptTime();

                for (AttemptLog log : attempts) {
                    if ("system=DRILL_RESET".equals(log.getUserInputData())) {
                        drillResets++;
                    } else if (!log.isSuccessful()) {
                        failedCount++;
                    } else {
                        lastSuccessfulTime = log.getAttemptTime();
                    }
                }

                // 3 mistakes = 1 attempt; drill resets (e.g. 3 strikes / red-herring) count as 1 attempt
                int attemptsCount = Math.max(drillResets, failedCount / 3);
                studentTotalAttempts += attemptsCount;
                classPhaseTotalAttempts[i] += attemptsCount;

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
        response.put("teacherEmail", room.getTeacherEmail());
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

    // -------------------------------------------------------------------------
    // 10. MANUAL EMAIL CLASSROOM REPORT DISPATCH
    // -------------------------------------------------------------------------
    @PostMapping("/rooms/{roomCode}/send-report")
    public ResponseEntity<?> sendRoomReportEmail(
            @PathVariable String roomCode,
            @RequestBody(required = false) Map<String, String> body) {
        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode);
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Room not found: " + roomCode));
        }
        Room room = roomOpt.get();
        if (body != null && body.containsKey("teacherEmail") && !body.get("teacherEmail").trim().isEmpty()) {
            room.setTeacherEmail(body.get("teacherEmail").trim());
            roomRepository.save(room);
        }
        if (room.getTeacherEmail() == null || room.getTeacherEmail().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No teacher email address configured for room " + roomCode));
        }

        try {
            emailReportService.sendClassroomReportSync(room, null);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Classroom audit report sent to " + room.getTeacherEmail()
            ));
        } catch (org.springframework.mail.MailAuthenticationException mae) {
            return ResponseEntity.status(401).body(Map.of(
                "error", "SMTP Authentication Failed: Gmail rejected login credentials. Please set your Gmail address and 16-character Google App Password in application.properties (spring.mail.username and spring.mail.password)."
            ));
        } catch (IllegalStateException ise) {
            return ResponseEntity.status(400).body(Map.of(
                "error", ise.getMessage()
            ));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to send email to " + room.getTeacherEmail() + ": " + ex.getMessage()
            ));
        }
    }

    // -------------------------------------------------------------------------
    // 11. HTML REPORT PREVIEW IN BROWSER
    // -------------------------------------------------------------------------
    @GetMapping(value = "/rooms/{roomCode}/report/preview", produces = "text/html;charset=UTF-8")
    public ResponseEntity<String> previewRoomReport(@PathVariable String roomCode) {
        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode);
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).body("<h1>Room not found: " + roomCode + "</h1>");
        }
        Room room = roomOpt.get();
        String html = emailReportService.generateClassroomReportHtml(room);
        return ResponseEntity.ok(html);
    }

    // -------------------------------------------------------------------------
    // 12. EXCEL CLASSROOM REPORT DOWNLOAD (.XLSX)
    // -------------------------------------------------------------------------
    @GetMapping("/rooms/{roomCode}/report/excel")
    public ResponseEntity<byte[]> downloadRoomReportExcel(@PathVariable String roomCode) {
        Optional<Room> roomOpt = roomRepository.findByRoomCodeIgnoreCase(roomCode);
        if (roomOpt.isEmpty()) {
            return ResponseEntity.status(404).build();
        }
        Room room = roomOpt.get();
        try {
            byte[] excelBytes = emailReportService.generateClassroomReportExcel(room);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDisposition(ContentDisposition.attachment()
                    .filename("Classroom_Audit_Report_" + room.getRoomCode() + ".xlsx")
                    .build());
            return new ResponseEntity<>(excelBytes, headers, HttpStatus.OK);
        } catch (Exception ex) {
            System.err.println("[RoomController] Error generating Excel report: " + ex.getMessage());
            return ResponseEntity.status(500).build();
        }
    }
}
