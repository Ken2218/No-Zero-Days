package com.NoZeroDays.backend.common.service;

import com.NoZeroDays.backend.common.dto.ValidationRequest;
import com.NoZeroDays.backend.common.dto.ValidationResponse;
import com.NoZeroDays.backend.common.model.AttemptLog;
import com.NoZeroDays.backend.common.model.RoomParticipant;
import com.NoZeroDays.backend.common.model.ScenarioSnapshot;
import com.NoZeroDays.backend.common.model.StudentProfile;
import com.NoZeroDays.backend.common.repository.AttemptLogRepository;
import com.NoZeroDays.backend.common.repository.GameSessionRepository;
import com.NoZeroDays.backend.common.repository.RoomParticipantRepository;
import com.NoZeroDays.backend.common.repository.ScenarioSnapshotRepository;
import com.NoZeroDays.backend.common.repository.StudentProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Common infrastructure service — shared utilities only.
 *
 * Responsibilities:
 *  1. Student profile resolution (get-or-create)
 *  2. AttemptLog persistence
 *  3. Infinite Drill Engine (3-strike counter + DRILL_RESET barrier)
 *  4. GameSession progress tracking
 *  5. Float tolerance helper
 *
 * Phase-specific business logic lives in each phase's own PhaseXValidationService.
 */
@Service
public class ValidationService {

    @Autowired
    private StudentProfileRepository studentRepository;

    @Autowired
    private AttemptLogRepository attemptLogRepository;

    @Autowired
    private GameSessionRepository gameSessionRepository;

    @Autowired
    private RoomParticipantRepository roomParticipantRepository;

    @Autowired
    private ScenarioSnapshotRepository scenarioSnapshotRepository;

    @Autowired
    private EmailReportService emailReportService;

    // -------------------------------------------------------------------------
    // Public utility: float tolerance comparison
    // -------------------------------------------------------------------------

    /**
     * Returns true if the absolute difference between expected and user values
     * is within the supplied epsilon (accounting tolerance).
     */
    public boolean isWithinTolerance(double expected, double user, double epsilon) {
        return Math.abs(expected - user) <= epsilon;
    }

    // -------------------------------------------------------------------------
    // Public utility: student resolution
    // -------------------------------------------------------------------------

    /**
     * Finds an existing StudentProfile by studentNumber, or creates a temporary
     * one if none exists. Never returns null.
     */
    public StudentProfile resolveStudent(String studentNumber) {
        String studentNum = (studentNumber == null || studentNumber.trim().isEmpty())
                ? "STU-UNKNOWN"
                : studentNumber;

        Optional<StudentProfile> studentOpt = studentRepository.findByStudentNumber(studentNum);
        if (studentOpt.isEmpty()) {
            StudentProfile newStudent = new StudentProfile(studentNum, "Temporary Student", "ABM-A");
            return studentRepository.save(newStudent);
        }
        return studentOpt.get();
    }

    // -------------------------------------------------------------------------
    // Scenario consistency enforcement (anti-tampering)
    // -------------------------------------------------------------------------

    /**
     * Verifies that the scenario values attached to a submission still match the
     * scenario the student registered for this module+phase (registered on the
     * first successful EXTRACT). Returns a rejection message, or null when OK.
     * Phase 7 (M4_TRIBUNAL) and EXTRACT steps are exempt: EXTRACT is what
     * registers the snapshot, and Phase 7 is a single self-contained submission.
     */
    public String checkScenarioConsistency(StudentProfile student, ValidationRequest request) {
        if (student == null || request == null) return null;
        String module = request.getModule() != null ? request.getModule().toUpperCase() : "M1_MATH";
        if ("M4_TRIBUNAL".equalsIgnoreCase(module)) return null;
        String step = request.getStep() != null ? request.getStep() : "EXTRACT";
        if ("EXTRACT".equalsIgnoreCase(step)) return null;
        int phase = request.getPhase() != null ? request.getPhase() : 1;

        Optional<ScenarioSnapshot> snapOpt =
                scenarioSnapshotRepository.findByStudentProfileAndModuleAndPhase(student, module, phase);
        if (snapOpt.isEmpty()) return null;

        ScenarioSnapshot snap = snapOpt.get();
        boolean matches =
                   fieldMatches(snap.getDailyRate(), request.getDailyRate())
                && fieldMatches(snap.getDaysPresent(), request.getDaysPresent())
                && fieldMatches(snap.getHourlyRate(), request.getHourlyRate())
                && fieldMatches(snap.getLateMinutes(), request.getLateMinutes())
                && fieldMatches(snap.getRedHerringLateMinutes(), request.getRedHerringLateMinutes())
                && fieldMatches(snap.getEarlyClockInMinutes(), request.getEarlyClockInMinutes())
                && fieldMatches(snap.getOtHours(), request.getOtHours())
                && fieldMatches(snap.getUnpaidLunchHours(), request.getUnpaidLunchHours())
                && fieldMatches(snap.getWorkedOnHoliday(), request.getWorkedOnHoliday())
                && fieldMatches(snap.getBasicSalary(), request.getBasicSalary())
                && fieldMatches(snap.getSssEeShare(), request.getSssEeShare())
                && fieldMatches(snap.getSssErShare(), request.getSssErShare())
                && fieldMatches(snap.getPersonalSalaryLoan(), request.getPersonalSalaryLoan())
                && fieldMatches(snap.getSpouseLoan(), request.getSpouseLoan())
                && fieldMatches(snap.getRiceSubsidy(), request.getRiceSubsidy())
                && fieldMatches(snap.getUniformAllowance(), request.getUniformAllowance())
                && fieldMatches(snap.getGrossPay(), request.getGrossPay())
                && fieldMatches(snap.getTardinessDeduction(), request.getTardinessDeduction())
                && stringFieldMatches(snap.getEmployeeName(), request.getEmployeeName())
                && stringFieldMatches(snap.getCompanyName(), request.getCompanyName());

        if (!matches) {
            return "Scenario mismatch detected: the submitted scenario values do not match this phase's registered scenario. Please restart the phase.";
        }
        return null;
    }

    private boolean fieldMatches(Object snapValue, Object requestValue) {
        // A missing request field is skipped (some steps legitimately omit fields);
        // a present field must equal the registered value.
        if (requestValue == null) return true;
        return Objects.equals(snapValue, requestValue);
    }

    private boolean stringFieldMatches(String snapValue, String requestValue) {
        if (requestValue == null || requestValue.isBlank()) return true;
        return Objects.equals(snapValue, requestValue);
    }

    /**
     * Registers/updates the scenario snapshot for a student's module+phase.
     * Called only after a successful EXTRACT so the registered values are the
     * ones the student actually validated against.
     */
    private void saveScenarioSnapshot(StudentProfile student, String module, int phase, ValidationRequest request) {
        Optional<ScenarioSnapshot> snapOpt =
                scenarioSnapshotRepository.findByStudentProfileAndModuleAndPhase(student, module.toUpperCase(), phase);
        ScenarioSnapshot snap = snapOpt.orElseGet(() -> {
            ScenarioSnapshot s = new ScenarioSnapshot();
            s.setStudentProfile(student);
            s.setModule(module.toUpperCase());
            s.setPhase(phase);
            return s;
        });

        snap.setDailyRate(request.getDailyRate());
        snap.setDaysPresent(request.getDaysPresent());
        snap.setHourlyRate(request.getHourlyRate());
        snap.setLateMinutes(request.getLateMinutes());
        snap.setRedHerringLateMinutes(request.getRedHerringLateMinutes());
        snap.setEarlyClockInMinutes(request.getEarlyClockInMinutes());
        snap.setOtHours(request.getOtHours());
        snap.setUnpaidLunchHours(request.getUnpaidLunchHours());
        snap.setWorkedOnHoliday(request.getWorkedOnHoliday());
        snap.setBasicSalary(request.getBasicSalary());
        snap.setSssEeShare(request.getSssEeShare());
        snap.setSssErShare(request.getSssErShare());
        snap.setPersonalSalaryLoan(request.getPersonalSalaryLoan());
        snap.setSpouseLoan(request.getSpouseLoan());
        snap.setRiceSubsidy(request.getRiceSubsidy());
        snap.setUniformAllowance(request.getUniformAllowance());
        snap.setGrossPay(request.getGrossPay());
        snap.setTardinessDeduction(request.getTardinessDeduction());
        snap.setEmployeeName(request.getEmployeeName());
        snap.setCompanyName(request.getCompanyName());
        snap.setUpdatedAt(LocalDateTime.now());

        scenarioSnapshotRepository.save(snap);
    }

    // -------------------------------------------------------------------------
    // Public utility: Drill Engine + AttemptLog persistence
    // -------------------------------------------------------------------------

    /**
     * Persists the current attempt, runs the Infinite Drill Engine (3-strike rule),
     * saves a DRILL_RESET barrier if triggered, and returns the final ValidationResponse.
     *
     * Call this at the end of every PhaseXValidationService.validate() method.
     *
     * @param student        Resolved StudentProfile (from resolveStudent)
     * @param request        Original ValidationRequest (for logging raw input/scenario data)
     * @param success        Whether the student's answer was correct
     * @param isRedHerring   Whether a red-herring trap was activated
     * @param message        Feedback message to send to the frontend
     * @param auditExpected  Expected value for audit display (null if not applicable)
     * @param auditReceived  Received value for audit display (null if not applicable)
     */
    public ValidationResponse runDrillEngineAndLog(
            StudentProfile student,
            ValidationRequest request,
            boolean success,
            boolean isRedHerring,
            String message,
            Double auditExpected,
            Double auditReceived,
            boolean phaseJustCompleted) {

        String module = request.getModule() != null ? request.getModule() : "M1_MATH";
        int phase    = request.getPhase()  != null ? request.getPhase()  : 1;
        String step  = request.getStep()   != null ? request.getStep()   : "EXTRACT";

        // Scaffolding steps are exempt from the drill engine
        boolean isDrillExemptStep =
                "COMPUTE_GROSS".equalsIgnoreCase(step)
             || "NET_PAY_FORMULA".equalsIgnoreCase(step)
             || "FILTER_LUNCH".equalsIgnoreCase(step)
             || "ESTABLISH_PREMIUM".equalsIgnoreCase(step)
             || "ESTABLISH_FORMULA".equalsIgnoreCase(step);

        // --- Count prior failures BEFORE saving the current attempt ---
        // Querying BEFORE save means: we count only the student's PREVIOUS failures, then
        // add exactly +1 for the current submission. This eliminates the timestamp-ordering bug
        // where two AttemptLog rows created within the same second share an identical timestamp
        // and MySQL returns them in arbitrary order — causing a correct DRILL_RESET barrier to
        // sort AFTER old failures and become invisible, making the count jump to 3 after 2 mistakes.
        int priorConsecutiveFailures = 0;
        if (!isDrillExemptStep && !isRedHerring && !success) {
            List<AttemptLog> priorAttempts =
                    attemptLogRepository.findLatestAttemptsByStep(student, module, phase, step);
            for (AttemptLog log : priorAttempts) {
                if (!log.isSuccessful()) {
                    priorConsecutiveFailures++;
                } else {
                    // Any success (including DRILL_RESET barrier) stops the consecutive count
                    break;
                }
            }
        }

        // Check if this submission is part of a RE_AUDIT:
        // An attempt is ONLY a re-audit if the student has ALREADY completed this phase previously.
        boolean isReAudit = isPhaseAlreadyCompleted(student, module, phase);

        // Persist current attempt
        AttemptLog attempt = new AttemptLog();
        attempt.setStudentProfile(student);
        attempt.setModule(module);
        attempt.setPhase(phase);
        attempt.setStep(step);
        attempt.setAttemptType(isReAudit ? "RE_AUDIT" : "FIRST_ATTEMPT");
        attempt.setElapsedSeconds(request.getTimerSeconds() != null ? request.getTimerSeconds() : 0L);
        attempt.setSuccessful(success);
        attempt.setRedHerring(isRedHerring);
        attempt.setFeedbackMessage(message);

        attempt.setUserInputData(String.format(
                "submittedValueA=%.2f, submittedValueB=%.2f, submittedRule=%s, submittedResult=%.2f, timerSeconds=%d",
                request.getSubmittedValueA()  != null ? request.getSubmittedValueA()  : 0.0,
                request.getSubmittedValueB()  != null ? request.getSubmittedValueB()  : 0.0,
                request.getSubmittedRule(),
                request.getSubmittedResult()  != null ? request.getSubmittedResult()  : 0.0,
                request.getTimerSeconds()     != null ? request.getTimerSeconds()     : 0L));

        attempt.setExpectedData(String.format(
                "dailyRate=%.2f, daysPresent=%d, hourlyRate=%.2f, lateMinutes=%d, " +
                "otHours=%.2f, unpaidLunchHours=%.2f, workedOnHoliday=%b, " +
                "sssEeShare=%.2f, personalSalaryLoan=%.2f, basicSalary=%.2f, " +
                "employeeName=%s, companyName=%s",
                request.getDailyRate()           != null ? request.getDailyRate()           : 0.0,
                request.getDaysPresent()          != null ? request.getDaysPresent()          : 0,
                request.getHourlyRate()           != null ? request.getHourlyRate()           : 0.0,
                request.getLateMinutes()          != null ? request.getLateMinutes()          : 0,
                request.getOtHours()              != null ? request.getOtHours()              : 0.0,
                request.getUnpaidLunchHours()     != null ? request.getUnpaidLunchHours()     : 0.0,
                request.getWorkedOnHoliday()      != null ? request.getWorkedOnHoliday()      : false,
                request.getSssEeShare()           != null ? request.getSssEeShare()           : 0.0,
                request.getPersonalSalaryLoan()   != null ? request.getPersonalSalaryLoan()   : 0.0,
                request.getBasicSalary()          != null ? request.getBasicSalary()          : 0.0,
                request.getEmployeeName()         != null ? request.getEmployeeName()         : "Juan Dela Cruz",
                request.getCompanyName()          != null ? request.getCompanyName()          : "Apex Industrial Works"));

        attemptLogRepository.save(attempt);

        // Register the scenario snapshot on a successful EXTRACT so later steps
        // of this phase can be checked against the same values.
        if ("EXTRACT".equalsIgnoreCase(step) && success && !isRedHerring
                && !"M4_TRIBUNAL".equalsIgnoreCase(module)) {
            saveScenarioSnapshot(student, module, phase, request);
        }

        // The final attempt is persisted now — only then is it safe to send the
        // classroom completion report (it reads AttemptLog rows).
        if (phaseJustCompleted) {
            try {
                Optional<RoomParticipant> rp =
                        roomParticipantRepository.findFirstByStudentProfileOrderByJoinedAtDesc(student);
                if (rp.isPresent() && rp.get().getRoom() != null) {
                    emailReportService.sendClassroomReport(rp.get().getRoom(), student);
                }
            } catch (Exception e) {
                System.err.println("[ValidationService] Failed to trigger email report: " + e.getMessage());
            }
        }

        // --- Apply drill engine ---
        boolean drillTriggered = false;
        String finalMessage = message;

        if (!isDrillExemptStep) {
            if (isRedHerring) {
                drillTriggered = true;
                finalMessage += " [INFINITE DRILL TRIGGERED: Rerolling scenario variables...]";
            } else if (!success) {
                int totalConsecutiveFailures = priorConsecutiveFailures + 1;
                System.out.println("[DRILL ENGINE] step=" + step
                        + " priorConsecutive=" + priorConsecutiveFailures
                        + " total=" + totalConsecutiveFailures);

                if (totalConsecutiveFailures >= 3) {
                    drillTriggered = true;
                    finalMessage += " [INFINITE DRILL TRIGGERED: 3 consecutive failure threshold reached. Rerolling scenario variables...]";
                } else {
                    int attemptsLeft = 3 - totalConsecutiveFailures;
                    finalMessage += " (" + attemptsLeft + " attempt"
                            + (attemptsLeft == 1 ? "" : "s") + " remaining before scenario resets.)";
                }
            }
        }

        // DRILL_RESET BARRIER: When a drill triggers, save a synthetic success record stamped
        // 1 second in the FUTURE. This guarantees it sorts BEFORE (DESC order) any old failure
        // records in subsequent queries, regardless of system clock precision — no timestamp
        // collision is possible with the explicit +1 second offset.
        if (drillTriggered) {
            AttemptLog resetBarrier = new AttemptLog();
            resetBarrier.setStudentProfile(student);
            resetBarrier.setModule(module);
            resetBarrier.setPhase(phase);
            resetBarrier.setStep(step);
            resetBarrier.setSuccessful(true);
            resetBarrier.setRedHerring(false);
            resetBarrier.setAttemptTime(java.time.LocalDateTime.now().plusSeconds(1));
            resetBarrier.setFeedbackMessage("[DRILL_RESET] Strike counter reset after Infinite Drill trigger.");
            resetBarrier.setUserInputData("system=DRILL_RESET");
            resetBarrier.setExpectedData("system=DRILL_RESET");
            resetBarrier.setAttemptType(isReAudit ? "RE_AUDIT" : "FIRST_ATTEMPT");
            attemptLogRepository.save(resetBarrier);
        }

        ValidationResponse response = new ValidationResponse(success, finalMessage, isRedHerring, drillTriggered);
        // Only return expected value on success to prevent leaking correct answers to students upon failure
        response.setExpected(success ? auditExpected : null);
        response.setReceived(auditReceived);
        return response;
    }

    // -------------------------------------------------------------------------
    // Public utility: GameSession progress tracking
    // -------------------------------------------------------------------------

    /**
     * Advances the student's GameSession to the next phase upon a successful completion.
     * Maps module+phase combinations to a canonical 1-7 phase index.
     * Returns true only when the session newly transitioned to COMPLETED (final phase),
     * so callers can trigger the completion report after the final attempt is persisted.
     */
    public boolean updateProgress(StudentProfile student, String module, int phase) {
        boolean justCompleted = false;
        List<com.NoZeroDays.backend.common.model.GameSession> activeSessions =
                gameSessionRepository.findByStudentProfileAndStatus(student, "ACTIVE");
        if (!activeSessions.isEmpty()) {
            com.NoZeroDays.backend.common.model.GameSession session = activeSessions.get(0);
            int currentCompletedPhase = 1;
            if ("M1_MATH".equalsIgnoreCase(module)) {
                currentCompletedPhase = phase;
            } else if ("M2_MULTIPLIERS".equalsIgnoreCase(module)) {
                currentCompletedPhase = 2 + phase;
            } else if ("M3_BUREAUCRACY".equalsIgnoreCase(module)) {
                currentCompletedPhase = 4 + phase;
            } else if ("M4_TRIBUNAL".equalsIgnoreCase(module)) {
                currentCompletedPhase = 7;
            }

            if (session.getCurrentPhase() <= currentCompletedPhase) {
                session.setCurrentPhase(currentCompletedPhase + 1);

                // Reset phase presence timer state so the next phase timer does NOT
                // start until the student explicitly navigates into that phase room.
                session.setPhaseEnteredAt(null);
                session.setPhaseExitedAt(null);
                session.setAccumulatedPauseSeconds(0L);
                session.setLastHeartbeatAt(null);

                if (currentCompletedPhase >= 7) {
                    session.setStatus("COMPLETED");
                    justCompleted = true;
                }
                gameSessionRepository.save(session);
            }
        }
        return justCompleted;
    }

    public boolean isPhaseAlreadyCompleted(StudentProfile student, String module, int phase) {
        if (student == null) return false;
        List<AttemptLog> phaseAttempts = attemptLogRepository.findLatestAttempts(student, module, phase);
        if (phaseAttempts == null || phaseAttempts.isEmpty()) return false;
        return isPhaseCompleteBySteps(phaseAttempts, module, phase);
    }

    private boolean isPhaseCompleteBySteps(List<AttemptLog> attempts, String module, int phase) {
        List<String> requiredSteps = getRequiredStepsForPhase(module, phase);
        if (requiredSteps.isEmpty()) return false;

        java.util.Set<String> successfulSteps = attempts.stream()
                .filter(AttemptLog::isSuccessful)
                .filter(a -> !a.isDrillReset())
                .map(a -> a.getStep() != null ? a.getStep().toUpperCase() : "")
                .collect(java.util.stream.Collectors.toSet());

        return requiredSteps.stream().allMatch(step -> successfulSteps.contains(step.toUpperCase()));
    }

    private List<String> getRequiredStepsForPhase(String module, int phase) {
        if ("M1_MATH".equalsIgnoreCase(module) && phase == 1) {
            return java.util.Arrays.asList("EXTRACT", "IDENTIFY_RULE", "EXECUTE");
        } else if ("M1_MATH".equalsIgnoreCase(module) && phase == 2) {
            return java.util.Arrays.asList("EXTRACT", "IDENTIFY_RULE", "EXECUTE", "COMPUTE_GROSS", "NET_PAY_FORMULA", "SYNTHESIS");
        } else if ("M2_MULTIPLIERS".equalsIgnoreCase(module)) {
            if (phase == 1) {
                return java.util.Arrays.asList("EXTRACT", "FILTER_LUNCH", "ESTABLISH_PREMIUM", "ESTABLISH_FORMULA", "EXECUTE", "COMPUTE_GROSS", "NET_PAY_FORMULA", "SYNTHESIS");
            } else {
                return java.util.Arrays.asList("EXTRACT", "ESTABLISH_PREMIUM", "ESTABLISH_FORMULA", "EXECUTE", "COMPUTE_GROSS", "NET_PAY_FORMULA", "SYNTHESIS");
            }
        } else if ("M3_BUREAUCRACY".equalsIgnoreCase(module)) {
            if (phase == 1) {
                return java.util.Arrays.asList("EXTRACT", "PAGIBIG_DEDUCTION", "BASIC_SALARY", "IDENTIFY_RULE", "SYNTHESIS");
            } else {
                return java.util.Arrays.asList("EXTRACT", "PHILHEALTH_EE", "TAX_BRACKET", "WITHHOLDING_TAX", "SYNTHESIS");
            }
        } else if ("M4_TRIBUNAL".equalsIgnoreCase(module)) {
            return java.util.Collections.singletonList("SUBMIT");
        }
        return java.util.Collections.emptyList();
    }
}
