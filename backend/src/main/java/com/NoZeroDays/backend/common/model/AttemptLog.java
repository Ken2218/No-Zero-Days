package com.NoZeroDays.backend.common.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "attempt_logs")
public class AttemptLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "student_profile_id", nullable = false)
    private StudentProfile studentProfile;

    private String module;  // e.g., "M1_MATH", "M2_MULTIPLIERS", etc.
    private int phase;      // e.g., 1, 2
    private String step;    // e.g., "EXTRACT", "IDENTIFY_RULE", "EXECUTE"

    @Column(name = "attempt_type")
    private String attemptType = "FIRST_ATTEMPT"; // "FIRST_ATTEMPT" or "RE_AUDIT"

    @Column(name = "elapsed_seconds")
    private Long elapsedSeconds = 0L;

    @Column(columnDefinition = "TEXT")
    private String userInputData; // JSON representation of user submissions

    @Column(columnDefinition = "TEXT")
    private String expectedData;  // JSON representation of generated scenario parameters

    private boolean isSuccessful;
    private boolean isRedHerring;
    private String feedbackMessage;

    private LocalDateTime attemptTime = LocalDateTime.now();

    // Default Constructor
    public AttemptLog() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public StudentProfile getStudentProfile() { return studentProfile; }
    public void setStudentProfile(StudentProfile studentProfile) { this.studentProfile = studentProfile; }

    public String getModule() { return module; }
    public void setModule(String module) { this.module = module; }

    public int getPhase() { return phase; }
    public void setPhase(int phase) { this.phase = phase; }

    public String getStep() { return step; }
    public void setStep(String step) { this.step = step; }

    public String getUserInputData() { return userInputData; }
    public void setUserInputData(String userInputData) { this.userInputData = userInputData; }

    /**
     * True when this row is a synthetic DRILL_RESET barrier, not a real answer.
     * Barriers must never count as completed steps.
     */
    public boolean isDrillReset() {
        return userInputData != null && userInputData.startsWith("system=DRILL_RESET");
    }

    public String getExpectedData() { return expectedData; }
    public void setExpectedData(String expectedData) { this.expectedData = expectedData; }

    public boolean isSuccessful() { return isSuccessful; }
    public void setSuccessful(boolean successful) { isSuccessful = successful; }

    public boolean isRedHerring() { return isRedHerring; }
    public void setRedHerring(boolean redHerring) { isRedHerring = redHerring; }

    public String getFeedbackMessage() { return feedbackMessage; }
    public void setFeedbackMessage(String feedbackMessage) { this.feedbackMessage = feedbackMessage; }

    public LocalDateTime getAttemptTime() { return attemptTime; }
    public void setAttemptTime(LocalDateTime attemptTime) { this.attemptTime = attemptTime; }

    public String getAttemptType() { return attemptType; }
    public void setAttemptType(String attemptType) { this.attemptType = attemptType; }

    public Long getElapsedSeconds() { return elapsedSeconds; }
    public void setElapsedSeconds(Long elapsedSeconds) { this.elapsedSeconds = elapsedSeconds; }
}
