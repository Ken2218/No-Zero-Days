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
                throw new IllegalArgumentException("Entered name '" + enteredName 
                    + "' does not match registered record for Student ID '" + studentNumber 
                    + "'. Please check your credentials or sign up first.");
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
