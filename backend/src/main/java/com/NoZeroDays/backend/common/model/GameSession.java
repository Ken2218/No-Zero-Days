package com.NoZeroDays.backend.common.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "game_sessions")
public class GameSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "student_profile_id", nullable = false)
    private StudentProfile studentProfile;

    /*
     * startTime MUST remain null until the student explicitly starts Phase 1.
     * Do NOT default to LocalDateTime.now() here — that would auto-stamp
     * the clock at object creation (login / room-join), not at Phase 1 start.
     */
    private LocalDateTime startTime = null;
    private LocalDateTime endTime;

    private String currentModule = "M1_MATH";
    private int currentPhase = 1;

    private String status = "ACTIVE"; // ACTIVE, COMPLETED

    // -------------------------------------------------------------------------
    // Phase Presence Timer Fields
    //
    // These three fields enable accurate per-phase timing by tracking exactly
    // when a student enters and exits each phase room. Without them, idle time
    // spent on the Dashboard between phases inflates the next phase's timer.
    //
    // Flow:
    //   1. Student enters Phase N      -> phaseEnteredAt = now(), phaseExitedAt = null
    //   2. Student exits without done  -> phaseExitedAt = now()  (timer frozen)
    //   3. Student re-enters Phase N   -> gap (exitedAt -> now) banked into
    //                                     accumulatedPauseSeconds;
    //                                     phaseEnteredAt = now(), phaseExitedAt = null
    //   4. Phase N completes           -> net time = (lastSuccessTime - phaseEnteredAt)
    //                                               - accumulatedPauseSeconds
    //                                     all three fields reset for the next phase
    // -------------------------------------------------------------------------

    /**
     * Timestamp set when the student explicitly enters a phase room (via the
     * frontend notifyPhaseEnter() call). Reset to null on phase completion or
     * when the student re-enters after a pause (new entry window begins).
     */
    private LocalDateTime phaseEnteredAt = null;

    /**
     * Timestamp set when the student exits a phase room without completing it
     * (navigating to Dashboard or changing phases). Freezes the active timer
     * so that idle Dashboard time is NOT counted against this phase.
     */
    private LocalDateTime phaseExitedAt = null;

    /**
     * Cumulative seconds the student spent OUTSIDE the phase room (paused)
     * during the current phase. Each re-entry adds the gap (exitedAt -> now)
     * here so it can be subtracted from total elapsed when computing net time.
     * Reset to 0 whenever the student advances to a new phase.
     */
    private long accumulatedPauseSeconds = 0L;

    /**
     * Timestamp of the most recent active heartbeat / action received from the
     * student while inside a phase room. If no heartbeat arrives for > 30 seconds
     * (e.g., student disconnected, closed app, or mobile screen locked without
     * a clean exit beacon), the active timer freezes at this timestamp.
     */
    private LocalDateTime lastHeartbeatAt = null;

    /**
     * Authoritative elapsed seconds reported by the student client via
     * heartbeat, phase-enter, phase-exit, or validation submissions.
     */
    @Column(name = "last_recorded_seconds")
    private Long lastRecordedSeconds = 0L;

    // Default Constructor
    public GameSession() {}

    public GameSession(StudentProfile studentProfile) {
        this.studentProfile = studentProfile;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public StudentProfile getStudentProfile() { return studentProfile; }
    public void setStudentProfile(StudentProfile studentProfile) { this.studentProfile = studentProfile; }

    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }

    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }

    public String getCurrentModule() { return currentModule; }
    public void setCurrentModule(String currentModule) { this.currentModule = currentModule; }

    public int getCurrentPhase() { return currentPhase; }
    public void setCurrentPhase(int currentPhase) { this.currentPhase = currentPhase; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getPhaseEnteredAt() { return phaseEnteredAt; }
    public void setPhaseEnteredAt(LocalDateTime phaseEnteredAt) { this.phaseEnteredAt = phaseEnteredAt; }

    public LocalDateTime getPhaseExitedAt() { return phaseExitedAt; }
    public void setPhaseExitedAt(LocalDateTime phaseExitedAt) { this.phaseExitedAt = phaseExitedAt; }

    public long getAccumulatedPauseSeconds() { return accumulatedPauseSeconds; }
    public void setAccumulatedPauseSeconds(long accumulatedPauseSeconds) { this.accumulatedPauseSeconds = accumulatedPauseSeconds; }

    public LocalDateTime getLastHeartbeatAt() { return lastHeartbeatAt; }
    public void setLastHeartbeatAt(LocalDateTime lastHeartbeatAt) { this.lastHeartbeatAt = lastHeartbeatAt; }

    public Long getLastRecordedSeconds() { return lastRecordedSeconds != null ? lastRecordedSeconds : 0L; }
    public void setLastRecordedSeconds(Long lastRecordedSeconds) { this.lastRecordedSeconds = lastRecordedSeconds; }
}
