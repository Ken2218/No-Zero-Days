package com.NoZeroDays.backend.phase2.service;

import com.NoZeroDays.backend.common.dto.ValidationRequest;
import com.NoZeroDays.backend.common.dto.ValidationResponse;
import com.NoZeroDays.backend.common.model.ScenarioSnapshot;
import com.NoZeroDays.backend.common.model.StudentProfile;
import com.NoZeroDays.backend.common.repository.ScenarioSnapshotRepository;
import com.NoZeroDays.backend.common.service.ValidationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;

/**
 * Phase 2 Validation Service — Module: M1_MATH, phase == 2
 * Topic: Tardiness Deductions.
 *
 * Steps: EXTRACT → IDENTIFY_RULE → EXECUTE → COMPUTE_GROSS → NET_PAY_FORMULA → SYNTHESIS
 */
@Service
public class Phase2ValidationService {

    @Autowired
    private ValidationService validationService;

    @Autowired
    private ScenarioSnapshotRepository scenarioSnapshotRepository;

    public ValidationResponse validate(ValidationRequest request) {
        StudentProfile student = validationService.resolveStudent(request.getStudentNumber());

        String scenarioMismatch = validationService.checkScenarioConsistency(student, request);
        if (scenarioMismatch != null) {
            return validationService.runDrillEngineAndLog(student, request, false, false, scenarioMismatch, null, null, false);
        }

        String step = request.getStep() != null ? request.getStep() : "EXTRACT";

        double targetHourlyRate  = request.getHourlyRate()   != null ? request.getHourlyRate()   : 0.0;
        int    targetLateMinutes = request.getLateMinutes()  != null ? request.getLateMinutes()  : 0;

        // Failsafe hydration: recover missing parameters from registered ScenarioSnapshot
        if (targetHourlyRate <= 0.0 || request.getLateMinutes() == null) {
            Optional<ScenarioSnapshot> snapOpt =
                    scenarioSnapshotRepository.findByStudentProfileAndModuleAndPhase(student, "M1_MATH", 2);
            if (snapOpt.isPresent()) {
                ScenarioSnapshot snap = snapOpt.get();
                if (targetHourlyRate <= 0.0 && snap.getHourlyRate() != null) {
                    targetHourlyRate = snap.getHourlyRate();
                }
                if (request.getLateMinutes() == null && snap.getLateMinutes() != null) {
                    targetLateMinutes = snap.getLateMinutes();
                }
            }
        }

        // Rule and formula selection steps do not require arithmetic parameters
        if (!"NET_PAY_FORMULA".equalsIgnoreCase(step) && !"IDENTIFY_RULE".equalsIgnoreCase(step)) {
            if (targetHourlyRate <= 0.0 || request.getLateMinutes() == null) {
                return validationService.runDrillEngineAndLog(student, request, false, false,
                        "Validation Error: Scenario parameters were not received by the server. Please reload the phase.", null, null, false);
            }
        }

        double epsilon = 0.01;

        boolean success      = false;
        boolean isRedHerring = false;
        String  message      = "";
        Double  auditExpected = null;
        Double  auditReceived = null;
        boolean phaseJustCompleted = false;

        if ("EXTRACT".equalsIgnoreCase(step)) {
            double valA             = request.getSubmittedValueA()        != null ? request.getSubmittedValueA()        : 0.0;
            double valB             = request.getSubmittedValueB()        != null ? request.getSubmittedValueB()        : 0.0;
            int    redHerringMinutes = request.getRedHerringLateMinutes() != null ? request.getRedHerringLateMinutes()  : -1;

            System.out.println("[Phase2 EXTRACT] userHourlyRate=" + valA + " userLateMinutes=" + valB
                    + " | expectedHourlyRate=" + targetHourlyRate + " expectedLateMinutes=" + targetLateMinutes
                    + " | redHerringMinutes=" + redHerringMinutes);

            // 1. Check for exact success FIRST (float tolerance for hourly rate, exact int for minutes)
            if (Math.abs(valA - targetHourlyRate) <= 0.02 && Math.abs(valB - targetLateMinutes) < epsilon) {
                success = true;
                message = "Extraction Verified! Proceed to Step 2.";
            }
            // 2. Check for the specific Red Herring trap value SECOND
            else if (redHerringMinutes > 0 && Math.abs(valB - redHerringMinutes) < epsilon) {
                isRedHerring = true;
                message = "RED HERRING DETECTED: You included a grace period deduction that does not apply under Philippine Labor standards. Extract the raw total late minutes directly from the biometric log.";
            }
            // 3. Default standard strike failure
            else {
                message = "Extraction Failed. Extract the raw Hourly Rate from the HR Filing Cabinet and the total late minutes from the Biometrics Swipe Log.";
            }

        } else if ("IDENTIFY_RULE".equalsIgnoreCase(step)) {
            String rule = request.getSubmittedRule();
            if ("TARDINESS_FORMULA".equalsIgnoreCase(rule) || "HOURLY_RATE_DIV_60_X_LATE".equalsIgnoreCase(rule)) {
                success = true;
                message = "Rule Verified! Deductions = (Hourly Rate / 60) × Late Minutes. Proceed to Step 3.";
            } else {
                message = "Incorrect Rule! Find the standard formula for late minutes deduction on the DOLE Compliance Poster.";
            }

        } else if ("EXECUTE".equalsIgnoreCase(step)) {
            if (request.getSubmittedResult() == null) {
                message = "Arithmetic Error! No computed value was submitted. Compute (Hourly Rate / 60) × Late Minutes and enter the result.";
            } else {
                double result   = request.getSubmittedResult();
                double expected = (targetHourlyRate / 60.0) * targetLateMinutes;

                System.out.println("Backend Expected: " + expected + " | Frontend Sent: " + result);

                // Precise calculation with BigDecimal
                BigDecimal hourlyRateBD = BigDecimal.valueOf(targetHourlyRate);
                BigDecimal sixty        = BigDecimal.valueOf(60);
                BigDecimal lateMinBD    = BigDecimal.valueOf(targetLateMinutes);
                BigDecimal expectedBD   = hourlyRateBD.divide(sixty, 10, RoundingMode.HALF_UP)
                                                      .multiply(lateMinBD)
                                                      .setScale(2, RoundingMode.HALF_UP);
                double expectedRounded  = expectedBD.doubleValue();

                // Accounting tolerance: margin of error <= 0.02
                boolean isCorrect = Math.abs(expected - result) <= 0.02 || Math.abs(expectedRounded - result) <= 0.02;

                if (isCorrect) {
                    success = true;
                    message = "Tardiness deduction verified at ₱" + String.format("%.2f", expectedRounded)
                            + ". Proceed to Step 4 — Compute Gross Basic Pay.";
                } else {
                    message = "Arithmetic Error! Compute (Hourly Rate / 60) × Late Minutes carefully.";
                    auditExpected = expectedRounded;
                    auditReceived = result;
                }
            }

        } else if ("COMPUTE_GROSS".equalsIgnoreCase(step)) {
            // Step 4: Verify Gross Basic Pay = Hourly Rate × 8 × Days Present
            // Failsafe: read from BOTH grossPay and submittedResult keys in case of frontend payload mismatch
            Double fromGrossPay       = request.getGrossPay();
            Double fromSubmittedResult = request.getSubmittedResult();
            double userGrossPay       = fromGrossPay != null ? fromGrossPay
                                      : (fromSubmittedResult != null ? fromSubmittedResult : 0.0);

            Integer rawDaysPresent    = request.getDaysPresent();
            int     expectedDaysPresent = rawDaysPresent != null ? rawDaysPresent : 0;

            System.out.println("--- STEP 4 DEBUG ---");
            System.out.println("Received User Gross: " + userGrossPay);
            System.out.println("Backend Hourly Rate: " + targetHourlyRate);
            System.out.println("Backend Days Present: " + expectedDaysPresent);
            System.out.println("fromGrossPay key: " + fromGrossPay);
            System.out.println("fromSubmittedResult key: " + fromSubmittedResult);

            if (expectedDaysPresent == 0 || targetHourlyRate == 0.0) {
                message = "Validation Error: Scenario parameters were not received by the server. Please try resubmitting.";
            } else {
                double expectedGrossPay = targetHourlyRate * 8.0 * expectedDaysPresent;

                System.out.println("Calculated Expected Gross: " + expectedGrossPay);
                System.out.println("Diff: " + Math.abs(userGrossPay - expectedGrossPay));

                if (Math.abs(userGrossPay - expectedGrossPay) <= 0.02) {
                    success = true;
                    message = "Gross Basic Pay verified at ₱" + String.format("%.2f", expectedGrossPay)
                            + ". Proceed to Step 5 — Establish Net Pay Formula.";
                } else {
                    message = "Gross Pay is incorrect. Review the HR Filing Cabinet for the correct values.";
                    auditExpected = expectedGrossPay;
                    auditReceived = userGrossPay;
                }
            }

        } else if ("NET_PAY_FORMULA".equalsIgnoreCase(step)) {
            // Step 5: Verify Net Pay Formula Selection
            // NOTE: GROSS_PLUS_TARDINESS is a learning error, NOT a red herring trap.
            // Using isRedHerring=true would trigger a drill reroll which is too punitive for a dropdown.
            String rule = request.getSubmittedRule();
            if ("GROSS_MINUS_TARDINESS".equalsIgnoreCase(rule)) {
                success = true;
                message = "Net Pay formula verified! Proceed to Step 6 — Compute Final Net Pay.";
            } else if ("GROSS_PLUS_TARDINESS".equalsIgnoreCase(rule)) {
                message = "Incorrect formula. Deductions must be SUBTRACTED from Gross Pay, not added. Review the Company Payroll Manual.";
            } else if ("HOURLY_MINUS_TARDINESS".equalsIgnoreCase(rule)) {
                message = "Incorrect formula. Net Pay is computed from the full Gross Basic Pay, not just the Hourly Rate. Review the Company Payroll Manual.";
            } else {
                message = "Please select a Net Pay formula from the dropdown.";
            }

        } else if ("SYNTHESIS".equalsIgnoreCase(step)) {
            if (request.getSubmittedResult() == null || request.getDaysPresent() == null) {
                message = "Arithmetic Error! No computed value was submitted. Compute Net Pay = Gross Pay − Tardiness and enter the result.";
            } else {
                // Step 6: Verify Final Net Pay = Gross Pay - Tardiness
                // Gross pay was already verified in Step 4 — we trust the scenario values for canonical computation.
                double result           = request.getSubmittedResult();
                int    targetDaysPresent = request.getDaysPresent();

                System.out.println("[Phase2 SYNTHESIS] HourlyRate=" + targetHourlyRate
                        + " Days=" + targetDaysPresent + " LateMinutes=" + targetLateMinutes
                        + " | Received=" + result);

                // Canonical computation using BigDecimal
                BigDecimal hourlyRateBD  = BigDecimal.valueOf(targetHourlyRate);
                BigDecimal eight         = BigDecimal.valueOf(8);
                BigDecimal daysPresentBD = BigDecimal.valueOf(targetDaysPresent);
                BigDecimal sixty         = BigDecimal.valueOf(60);
                BigDecimal lateMinBD     = BigDecimal.valueOf(targetLateMinutes);

                BigDecimal grossPayBD    = hourlyRateBD.multiply(eight).multiply(daysPresentBD).setScale(2, RoundingMode.HALF_UP);
                BigDecimal tardinessBD   = hourlyRateBD.divide(sixty, 10, RoundingMode.HALF_UP)
                                                       .multiply(lateMinBD)
                                                       .setScale(2, RoundingMode.HALF_UP);
                BigDecimal expectedNetBD = grossPayBD.subtract(tardinessBD).setScale(2, RoundingMode.HALF_UP);
                double expectedRounded   = expectedNetBD.doubleValue();

                boolean isCorrect = Math.abs(expectedRounded - result) <= 0.02;

                if (isCorrect) {
                    success = true;
                    message = "Phase 2 Complete! Net Take-Home Pay verified at ₱"
                            + String.format("%.2f", expectedRounded) + ". Excellent audit work!";
                    phaseJustCompleted = validationService.updateProgress(student, "M1_MATH", 2);
                } else {
                    message = "Net Pay is incorrect. Review the Company Payroll Manual for the Net Pay formula and verify your prior computations.";
                    auditExpected = expectedRounded;
                    auditReceived = result;
                }
            }
        }

        return validationService.runDrillEngineAndLog(
                student, request, success, isRedHerring, message, auditExpected, auditReceived, phaseJustCompleted);
    }
}
