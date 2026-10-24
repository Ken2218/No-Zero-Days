package com.NoZeroDays.backend.common.service;

import com.NoZeroDays.backend.common.model.GameSession;
import com.NoZeroDays.backend.common.model.StudentProfile;
import com.NoZeroDays.backend.common.repository.GameSessionRepository;
import com.NoZeroDays.backend.common.repository.StudentProfileRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AuthService {

    @Autowired
    private StudentProfileRepository studentRepository;

    @Autowired
    private GameSessionRepository gameSessionRepository;

    /**
     * Flexible Student Login verification:
     * - Student number must exist.
     * - Full name is REQUIRED and must plausibly match the registered record
     *   (case-insensitive, whitespace-insensitive, token-based).
     */
    public StudentProfile authenticateStudent(String rawStudentNumber, String rawName) {
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

        // NOTE: Do NOT create a GameSession here.
        // Session creation and startTime stamping happen later, when the student
        // joins a room and then explicitly begins Phase 1 (first attempt submission).
        // Creating a session at login would start every student's timer simultaneously
        // regardless of when they actually open Phase 1.

        return profile;
    }

    /**
     * Flexible name comparison:
     * - Case-insensitive
     * - Strips leading/trailing whitespace and collapses multiple spaces
     * - Full-name match in either direction (registered name contains entered name or vice versa)
     * - Token overlap: every significant token (>= 3 chars) of the entered name
     *   must appear in the registered name
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

        // 2. Full-name substring matching in either direction
        if (normReg.contains(normInput) || normInput.contains(normReg)) {
            return true;
        }

        // 3. Token overlap: every significant token of the entered name must appear
        //    as a whole word (or substring) of the registered name.
        String[] regParts = normReg.split("[\\s,-]+");
        String[] inputParts = normInput.split("[\\s,-]+");
        boolean anySignificantToken = false;
        for (String ip : inputParts) {
            if (ip.length() < 3) continue;
            anySignificantToken = true;
            boolean found = false;
            for (String rp : regParts) {
                if (rp.length() >= 3 && (rp.equals(ip) || rp.contains(ip) || ip.contains(rp))) {
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
