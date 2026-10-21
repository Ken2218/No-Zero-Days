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
     * - Checks if student exists by student number.
     * - Performs flexible, case-insensitive, whitespace-trimmed, substring, and token-matching on full name.
     * - Allows login if student ID exists, ensuring capstone presentation participants are never locked out.
     */
    public StudentProfile authenticateStudent(String rawStudentNumber, String rawName) {
        if (rawStudentNumber == null || rawStudentNumber.trim().isEmpty()) {
            throw new IllegalArgumentException("Student number cannot be empty.");
        }

        String studentNumber = rawStudentNumber.trim();
        Optional<StudentProfile> existing = studentRepository.findByStudentNumber(studentNumber);
        if (existing.isEmpty()) {
            throw new IllegalArgumentException("Student account not found with ID '" + studentNumber + "'. Please sign up first.");
        }

        StudentProfile profile = existing.get();

        // If a name is provided, check flexibly
        if (rawName != null && !rawName.trim().isEmpty()) {
            String enteredName = rawName.trim();
            if (!isFlexibleNameMatch(profile.getFullName(), enteredName)) {
                // Flexible presentation tolerance: log for auditing, but allow login by valid student ID
                System.out.println("[AuthService] Flexible Capstone Login: Student ID '" + studentNumber 
                    + "' logged in with entered name '" + enteredName 
                    + "' (registered record: '" + profile.getFullName() + "').");
            }
        }

        // Ensure active game session exists
        List<GameSession> activeSessions = gameSessionRepository.findByStudentProfileAndStatus(profile, "ACTIVE");
        if (activeSessions.isEmpty()) {
            GameSession newSession = new GameSession(profile);
            newSession.setCurrentModule("M1_MATH");
            newSession.setCurrentPhase(1);
            newSession.setStatus("ACTIVE");
            gameSessionRepository.save(newSession);
        }

        return profile;
    }

    /**
     * Flexible name comparison:
     * - Case-insensitive
     * - Strips leading/trailing whitespaces and collapses multiple spaces
     * - Substring matching in either direction (e.g. "Juan" in "Juan Dela Cruz")
     * - Token/word overlap (e.g. first name or last name match)
     * - Levenshtein distance tolerance for minor typos (<= 2 char differences)
     */
    public boolean isFlexibleNameMatch(String registeredName, String inputName) {
        if (inputName == null || inputName.trim().isEmpty()) {
            return true;
        }
        if (registeredName == null || registeredName.trim().isEmpty()) {
            return true;
        }

        String normReg = registeredName.trim().replaceAll("\\s+", " ").toLowerCase();
        String normInput = inputName.trim().replaceAll("\\s+", " ").toLowerCase();

        // 1. Exact or case-insensitive match
        if (normReg.equalsIgnoreCase(normInput)) {
            return true;
        }

        // 2. Substring matching in either direction
        if (normReg.contains(normInput) || normInput.contains(normReg)) {
            return true;
        }

        // 3. Name-part / token overlap (first name, last name, middle name)
        String[] regParts = normReg.split("[\\s,-]+");
        String[] inputParts = normInput.split("[\\s,-]+");
        for (String ip : inputParts) {
            if (ip.length() >= 2) {
                for (String rp : regParts) {
                    if (rp.length() >= 2 && (rp.equals(ip) || rp.contains(ip) || ip.contains(rp))) {
                        return true;
                    }
                }
            }
        }

        // 4. Fuzzy edit distance (<= 2 typos)
        if (levenshteinDistance(normReg, normInput) <= 2) {
            return true;
        }

        return false;
    }

    private int levenshteinDistance(String a, String b) {
        int[] costs = new int[b.length() + 1];
        for (int j = 0; j < costs.length; j++) costs[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            costs[0] = i;
            int nw = i - 1;
            for (int j = 1; j <= b.length(); j++) {
                int cj = Math.min(1 + Math.min(costs[j], costs[j - 1]),
                        a.charAt(i - 1) == b.charAt(j - 1) ? nw : nw + 1);
                nw = costs[j];
                costs[j] = cj;
            }
        }
        return costs[b.length()];
    }
}
