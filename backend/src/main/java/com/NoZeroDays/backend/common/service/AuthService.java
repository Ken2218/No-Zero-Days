package com.NoZeroDays.backend.common.service;

import com.NoZeroDays.backend.common.auth.PasswordHasher;
import com.NoZeroDays.backend.common.model.GameSession;
import com.NoZeroDays.backend.common.model.Room;
import com.NoZeroDays.backend.common.model.StudentProfile;
import com.NoZeroDays.backend.common.model.Teacher;
import com.NoZeroDays.backend.common.repository.GameSessionRepository;
import com.NoZeroDays.backend.common.repository.RoomRepository;
import com.NoZeroDays.backend.common.repository.StudentProfileRepository;
import com.NoZeroDays.backend.common.repository.TeacherRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Service
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired
    private StudentProfileRepository studentRepository;

    @Autowired
    private GameSessionRepository gameSessionRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private RoomRepository roomRepository;

    /** Cryptographically random 256-bit session token (hex). */
    public String issueSessionToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    /**
     * Flexible Student Login verification:
     * - Student number must exist.
     * - Full name is REQUIRED and must plausibly match the registered record
     *   (case-insensitive, whitespace-insensitive, token-based).
     * - Accounts upgraded with a password must supply it; legacy accounts
     *   (passwordHash == null) ignore the password and are flagged for the
     *   controller to return requiresUpgrade.
     */
    public StudentProfile authenticateStudent(String rawStudentNumber, String rawName, String password) {
        if (rawStudentNumber == null || rawStudentNumber.trim().isEmpty()) {
            throw new IllegalArgumentException("Student number cannot be empty.");
        }
        if (rawName == null || rawName.trim().isEmpty()) {
            throw new IllegalArgumentException("Full name is required to sign in.");
        }

        String studentNumber = rawStudentNumber.trim();
        Optional<StudentProfile> existing = studentRepository.findByStudentNumber(studentNumber);
        if (existing.isEmpty()) {
            throw new IllegalArgumentException("Student account not found with ID '" + studentNumber + "'. Please sign up first.");
        }

        StudentProfile profile = existing.get();

        if (!isFlexibleNameMatch(profile.getFullName(), rawName)) {
            throw new IllegalArgumentException("Entered name '" + rawName.trim()
                + "' does not match registered record for Student ID '" + studentNumber
                + "'. Please check your credentials or sign up first.");
        }

        if (profile.getPasswordHash() != null) {
            if (password == null || password.isEmpty()) {
                throw new IllegalArgumentException("Password is required. This account was upgraded with a password.");
            }
            if (!PasswordHasher.verify(password, profile.getPasswordHash())) {
                throw new IllegalArgumentException("Incorrect password for Student ID '" + studentNumber + "'.");
            }
        }

        // NOTE: Do NOT create a GameSession here.
        // Session creation and startTime stamping happen later, when the student
        // joins a room and then explicitly begins Phase 1 (first attempt submission).
        // Creating a session at login would start every student's timer simultaneously
        // regardless of when they actually open Phase 1.

        return profile;
    }

    /**
     * Migration path for pre-password student accounts: verifies identity the
     * same way login does (student number + flexible name match), then attaches
     * the student's email and password. Accounts that already have a password
     * cannot be re-claimed here — they must sign in normally.
     */
    public StudentProfile upgradeStudentCredentials(String rawStudentNumber, String rawName,
                                                    String rawEmail, String password) {
        if (rawStudentNumber == null || rawStudentNumber.trim().isEmpty()) {
            throw new IllegalArgumentException("Student number cannot be empty.");
        }
        if (rawName == null || rawName.trim().isEmpty()) {
            throw new IllegalArgumentException("Full name is required.");
        }

        String email = (rawEmail != null) ? rawEmail.trim() : "";
        if (email.isEmpty()) {
            throw new IllegalArgumentException("Email is required.");
        }
        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new IllegalArgumentException("Please enter a valid email address.");
        }
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters.");
        }

        String studentNumber = rawStudentNumber.trim();
        Optional<StudentProfile> existing = studentRepository.findByStudentNumber(studentNumber);
        if (existing.isEmpty()) {
            throw new IllegalArgumentException("Student account not found with ID '" + studentNumber + "'. Please sign up first.");
        }
        StudentProfile profile = existing.get();

        if (!isFlexibleNameMatch(profile.getFullName(), rawName)) {
            throw new IllegalArgumentException("Entered name '" + rawName.trim()
                + "' does not match registered record for Student ID '" + studentNumber
                + "'. Please check your credentials.");
        }
        if (profile.getPasswordHash() != null) {
            throw new IllegalArgumentException("Student ID '" + studentNumber + "' already has a password. Please sign in instead.");
        }

        Optional<StudentProfile> emailOwner = studentRepository.findByEmailIgnoreCase(email);
        if (emailOwner.isPresent() && !emailOwner.get().getStudentNumber().equalsIgnoreCase(studentNumber)) {
            throw new IllegalArgumentException("Email '" + email + "' is already used by another student account.");
        }

        profile.setEmail(email);
        profile.setPasswordHash(PasswordHasher.hash(password));
        return studentRepository.save(profile);
    }

    /**
     * Teacher login with password verification.
     *
     * Migration path: teachers created before passwords existed have a null
     * passwordHash — their FIRST successful login claims the account by storing
     * the supplied password. Afterwards the stored hash is verified.
     */
    public Teacher authenticateTeacher(String rawEmail, String password, String rawName) {
        String email = (rawEmail != null) ? rawEmail.trim() : "";
        if (email.isEmpty()) {
            throw new IllegalArgumentException("Email is required.");
        }
        if (!email.toLowerCase().endsWith("@gmail.com")) {
            throw new IllegalArgumentException("Email must be a valid @gmail.com address.");
        }

        boolean passwordProvided = password != null && !password.trim().isEmpty();
        String trimmedPassword = passwordProvided ? password.trim() : null;

        Optional<Teacher> opt = teacherRepository.findByEmailIgnoreCase(email);
        Teacher teacher;
        if (opt.isPresent()) {
            teacher = opt.get();
            if (teacher.getPasswordHash() == null) {
                // Legacy pre-password account: signing in without a password
                // stays allowed. Supplying one claims and secures the account.
                if (passwordProvided) {
                    teacher.setPasswordHash(PasswordHasher.hash(trimmedPassword));
                }
            } else {
                if (!passwordProvided) {
                    throw new IllegalArgumentException("This account has a password. Please enter it to sign in.");
                }
                if (!PasswordHasher.verify(trimmedPassword, teacher.getPasswordHash())) {
                    throw new IllegalArgumentException("Incorrect password for '" + email + "'.");
                }
            }
        } else {
            if (!passwordProvided) {
                throw new IllegalArgumentException("Teacher account not found for '" + email + "'. Please switch to Sign Up.");
            }
            // Legacy rooms: rooms created before teacher accounts existed only
            // carry a teacherEmail. Claiming them now requires a password, which
            // is set on the newly created teacher account.
            List<Room> existingRooms = roomRepository.findByTeacherEmailIgnoreCaseOrderByCreatedAtDesc(email);
            if (existingRooms.isEmpty()) {
                throw new IllegalArgumentException("Teacher account not found for '" + email + "'. Please switch to Sign Up.");
            }
            String existingName = (rawName != null && !rawName.trim().isEmpty())
                    ? rawName.trim()
                    : existingRooms.get(0).getTeacherName();
            teacher = teacherRepository.save(new Teacher(email, existingName));
            teacher.setPasswordHash(PasswordHasher.hash(trimmedPassword));
            for (Room r : existingRooms) {
                if (r.getTeacher() == null) {
                    r.setTeacher(teacher);
                    roomRepository.save(r);
                }
            }
        }

        if (rawName != null && !rawName.trim().isEmpty()) {
            teacher.setFullName(rawName.trim());
        }
        teacher.setSessionToken(issueSessionToken());
        return teacherRepository.save(teacher);
    }

    /**
     * Teacher registration. Requires a password of at least 8 characters.
     * Re-registering an email that already has a password is rejected.
     */
    public Teacher registerTeacher(String rawEmail, String password, String rawName) {
        String email = (rawEmail != null) ? rawEmail.trim() : "";
        if (email.isEmpty()) {
            throw new IllegalArgumentException("Email is required.");
        }
        if (!email.toLowerCase().endsWith("@gmail.com")) {
            throw new IllegalArgumentException("Email must be a valid @gmail.com address.");
        }
        if (rawName == null || rawName.trim().isEmpty()) {
            throw new IllegalArgumentException("Full name is required.");
        }
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters.");
        }

        Optional<Teacher> opt = teacherRepository.findByEmailIgnoreCase(email);
        if (opt.isPresent() && opt.get().getPasswordHash() != null) {
            throw new IllegalArgumentException("Teacher account '" + email + "' is already registered. Please sign in instead.");
        }

        Teacher teacher = opt.orElseGet(() -> new Teacher(email, rawName.trim()));
        teacher.setFullName(rawName.trim());
        teacher.setPasswordHash(PasswordHasher.hash(password));
        teacher.setSessionToken(issueSessionToken());
        return teacherRepository.save(teacher);
    }

    /**
     * Flexible name comparison:
     * - Case-insensitive
     * - Strips leading/trailing whitespace and collapses multiple spaces
     * - Exact match, or every significant token (>= 4 chars) of the entered name
     *   must appear as a token (or a >= 4 char substring of a token) of the
     *   registered name. Short fragments (e.g. "mar" or "s") alone do not pass.
     */
    public boolean isFlexibleNameMatch(String registeredName, String inputName) {
        if (inputName == null || inputName.trim().isEmpty()) {
            return false;
        }
        if (registeredName == null || registeredName.trim().isEmpty()) {
            return false;
        }

        String normReg = registeredName.trim().replaceAll("\\s+", " ").toLowerCase();
        String normInput = inputName.trim().replaceAll("\\s+", " ").toLowerCase();

        // 1. Exact or case-insensitive match
        if (normReg.equals(normInput)) {
            return true;
        }

        // 2. The entered name fully contains the registered name (e.g. registered
        //    "Maria Santos" entered as "Maria Santos Cruz"). The reverse direction
        //    is NOT accepted — it would let short fragments authenticate.
        if (normInput.contains(normReg)) {
            return true;
        }

        // 2. Token overlap: every significant token of the entered name must
        //    match a registered token. Substring matching only applies to
        //    fragments of 4+ characters so tiny guesses can't authenticate.
        String[] regParts = normReg.split("[\\s,-]+");
        String[] inputParts = normInput.split("[\\s,-]+");
        boolean anySignificantToken = false;
        for (String ip : inputParts) {
            if (ip.length() < 4) continue;
            anySignificantToken = true;
            boolean found = false;
            for (String rp : regParts) {
                if (rp.equals(ip)) {
                    found = true;
                    break;
                }
                if (rp.length() >= 4 && (rp.contains(ip) || ip.contains(rp))) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                return false;
            }
        }

        return anySignificantToken;
    }
}
