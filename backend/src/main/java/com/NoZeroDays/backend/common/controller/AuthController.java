package com.NoZeroDays.backend.common.controller;

import com.NoZeroDays.backend.common.dto.LoginRequest;
import com.NoZeroDays.backend.common.model.GameSession;
import com.NoZeroDays.backend.common.model.Room;
import com.NoZeroDays.backend.common.model.StudentProfile;
import com.NoZeroDays.backend.common.model.Teacher;
import com.NoZeroDays.backend.common.repository.GameSessionRepository;
import com.NoZeroDays.backend.common.repository.RoomRepository;
import com.NoZeroDays.backend.common.repository.StudentProfileRepository;
import com.NoZeroDays.backend.common.repository.TeacherRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private StudentProfileRepository studentRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private GameSessionRepository gameSessionRepository;

    @Autowired
    private com.NoZeroDays.backend.common.service.AuthService authService;

    /**
     * Unified Login endpoint:
     * POST /api/auth/login
     * Accepts: studentNumber, name, fullName, role, email (for teachers)
     */
    @PostMapping(value = {"/login", "/login/"})
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (request.isTeacher()) {
            return authenticateTeacher(request);
        } else {
            return authenticateStudent(request);
        }
    }

    /**
     * Unified Register endpoint:
     * POST /api/auth/register
     */
    @PostMapping(value = {"/register", "/register/"})
    public ResponseEntity<?> register(@RequestBody LoginRequest request) {
        if (request.isTeacher()) {
            return registerTeacher(request);
        } else {
            return registerStudent(request);
        }
    }

    private ResponseEntity<?> authenticateStudent(LoginRequest request) {
        String studentNumber = request.getEffectiveStudentNumber();
        String name = request.getEffectiveName();

        if (studentNumber.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Student number cannot be empty."));
        }

        try {
            StudentProfile profile = authService.authenticateStudent(studentNumber, name);
            return ResponseEntity.ok(profile);
        } catch (IllegalArgumentException e) {
            int status = e.getMessage().contains("not found") ? 404 : 400;
            return ResponseEntity.status(status).body(Map.of("error", e.getMessage()));
        }
    }

    private ResponseEntity<?> registerStudent(LoginRequest request) {
        String studentNumber = request.getEffectiveStudentNumber();
        String name = request.getEffectiveName();
        String section = request.getSection() != null ? request.getSection().trim() : "";

        if (studentNumber.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Student number cannot be empty."));
        }
        if (name.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Full name cannot be empty."));
        }

        Optional<StudentProfile> existing = studentRepository.findByStudentNumber(studentNumber);
        StudentProfile profile;
        if (existing.isPresent()) {
            profile = existing.get();
        } else {
            profile = studentRepository.save(new StudentProfile(studentNumber, name, section));
        }

        // Ensure student has an active game session
        List<GameSession> activeSessions = gameSessionRepository.findByStudentProfileAndStatus(profile, "ACTIVE");
        if (activeSessions.isEmpty()) {
            GameSession newSession = new GameSession(profile);
            newSession.setCurrentModule("M1_MATH");
            newSession.setCurrentPhase(1);
            newSession.setStatus("ACTIVE");
            gameSessionRepository.save(newSession);
        }

        return ResponseEntity.ok(profile);
    }

    private ResponseEntity<?> authenticateTeacher(LoginRequest request) {
        String email = request.getEffectiveEmail();
        String fullName = request.getEffectiveName();

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
            } else {
                return ResponseEntity.status(404).body(Map.of("error", 
                    "Teacher account not found for '" + email + "'. Please switch to Sign Up."));
            }
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("id", teacher.getId());
        resp.put("email", teacher.getEmail());
        resp.put("fullName", teacher.getFullName());
        resp.put("teacherName", teacher.getFullName());
        resp.put("teacherEmail", teacher.getEmail());
        resp.put("role", "OM-TEACHER");
        return ResponseEntity.ok(resp);
    }

    private ResponseEntity<?> registerTeacher(LoginRequest request) {
        String email = request.getEffectiveEmail();
        String fullName = request.getEffectiveName();

        if (email.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required."));
        }
        if (!email.toLowerCase().endsWith("@gmail.com")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email must be a valid @gmail.com address."));
        }
        if (fullName.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Full name is required."));
        }

        Optional<Teacher> opt = teacherRepository.findByEmailIgnoreCase(email);
        Teacher teacher;
        if (opt.isPresent()) {
            teacher = opt.get();
        } else {
            teacher = new Teacher(email, fullName);
        }
        teacher.setFullName(fullName);
        teacher = teacherRepository.save(teacher);

        Map<String, Object> resp = new HashMap<>();
        resp.put("id", teacher.getId());
        resp.put("email", teacher.getEmail());
        resp.put("fullName", teacher.getFullName());
        resp.put("teacherName", teacher.getFullName());
        resp.put("teacherEmail", teacher.getEmail());
        resp.put("role", "OM-TEACHER");
        return ResponseEntity.ok(resp);
    }
}
