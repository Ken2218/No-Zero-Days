package com.NoZeroDays.backend.common.service;

import com.NoZeroDays.backend.common.model.AttemptLog;
import com.NoZeroDays.backend.common.model.GameSession;
import com.NoZeroDays.backend.common.model.Room;
import com.NoZeroDays.backend.common.model.RoomParticipant;
import com.NoZeroDays.backend.common.model.StudentProfile;
import com.NoZeroDays.backend.common.repository.AttemptLogRepository;
import com.NoZeroDays.backend.common.repository.GameSessionRepository;
import com.NoZeroDays.backend.common.repository.RoomParticipantRepository;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class EmailReportService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired
    private RoomParticipantRepository roomParticipantRepository;

    @Autowired
    private AttemptLogRepository attemptLogRepository;

    @Autowired
    private GameSessionRepository gameSessionRepository;

    @Value("${spring.mail.username:}")
    private String mailSenderUsername;

    @Value("${spring.mail.password:}")
    private String mailSenderPassword;

    @Value("${google.oauth2.client-id:}")
    private String googleClientId;

    @Value("${google.oauth2.client-secret:}")
    private String googleClientSecret;

    @Value("${google.oauth2.refresh-token:}")
    private String googleRefreshToken;

    @Value("${google.oauth2.sender-email:}")
    private String googleSenderEmail;

    private static final String[] MODULES = {
        "M1_MATH", "M1_MATH", "M2_MULTIPLIERS", "M2_MULTIPLIERS",
        "M3_BUREAUCRACY", "M3_BUREAUCRACY", "M4_TRIBUNAL"
    };
    private static final int[] PHASES = {1, 2, 1, 2, 1, 2, 1};
    private static final String[] PHASE_NAMES = {
        "Phase 1: Basic Gross Pay",
        "Phase 2: Tardiness Deductions",
        "Phase 3: Overtime Premiums",
        "Phase 4: Regular Holiday Pay",
        "Phase 5: SSS Deductions",
        "Phase 6: PhilHealth Premiums",
        "Phase 7: Net Payroll Boardroom"
    };

    /**
     * Data structure holding analyzed metrics for a single student.
     */
    public static class StudentMetrics {
        public StudentProfile profile;
        public boolean isCompletedAll;
        public int completedPhasesCount;
        public int currentPhase;
        public String currentPhaseTitle;
        public long totalTimeSeconds;
        public long avgTimeSeconds;
        public int totalAttempts;
        public List<PhaseMetric> phaseMetrics = new ArrayList<>();
    }

    public static class PhaseMetric {
        public int phaseId;
        public String title;
        public int tries;
        public long seconds;
        public boolean isCompleted;
    }

    /**
     * Synchronously generates and dispatches the comprehensive classroom email report.
     * Throws an exception on failure so caller can report exact error to user.
     */
    public void sendClassroomReportSync(Room room, StudentProfile triggeringStudent) throws Exception {
        if (room == null) {
            throw new IllegalArgumentException("Room cannot be null.");
        }
        String teacherEmail = room.getTeacherEmail();
        if (teacherEmail == null || teacherEmail.trim().isEmpty()) {
            throw new IllegalArgumentException("No teacher email configured for room " + room.getRoomCode());
        }

        // Validate credentials: check Google OAuth 2.0 or SMTP credentials
        boolean hasOAuth = googleRefreshToken != null && !googleRefreshToken.trim().isEmpty() &&
                           googleClientId != null && !googleClientId.trim().isEmpty() &&
                           googleClientSecret != null && !googleClientSecret.trim().isEmpty();
        boolean hasSmtp = mailSenderUsername != null && !mailSenderUsername.trim().isEmpty() &&
                          mailSenderPassword != null && !mailSenderPassword.trim().isEmpty();

        if (!hasOAuth && !hasSmtp) {
            throw new IllegalStateException(
                "Email credentials are not configured in backend/src/main/resources/application.properties. " +
                "Please configure Google OAuth2 (google.oauth2.refresh-token) or SMTP credentials."
            );
        }

        List<RoomParticipant> participants = roomParticipantRepository.findByRoomOrderByJoinedAtAsc(room);
        List<StudentMetrics> allMetrics = new ArrayList<>();

        for (RoomParticipant p : participants) {
            StudentMetrics sm = computeStudentMetrics(room, p.getStudentProfile());
            allMetrics.add(sm);
        }

        // Sort: completed students first (with triggering student at the very top), then active students
        allMetrics.sort((a, b) -> {
            if (triggeringStudent != null) {
                if (a.profile.getStudentNumber().equals(triggeringStudent.getStudentNumber())) return -1;
                if (b.profile.getStudentNumber().equals(triggeringStudent.getStudentNumber())) return 1;
            }
            if (a.isCompletedAll && !b.isCompletedAll) return -1;
            if (!a.isCompletedAll && b.isCompletedAll) return 1;
            return Integer.compare(b.completedPhasesCount, a.completedPhasesCount);
        });

        String html = buildClassroomHtml(room, allMetrics, triggeringStudent);

        Session mailSession = mailSender != null
                ? mailSender.createMimeMessage().getSession()
                : Session.getInstance(new Properties());
        MimeMessage message = new MimeMessage(mailSession);
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        String senderAddress = (hasOAuth && googleSenderEmail != null && !googleSenderEmail.trim().isEmpty())
                ? googleSenderEmail.trim()
                : (mailSenderUsername != null && !mailSenderUsername.trim().isEmpty() ? mailSenderUsername.trim() : "no-reply@nozerodays.edu");

        helper.setFrom(senderAddress, "No Zero Days Payroll Simulator");
        helper.setTo(teacherEmail.trim());

        String subject = String.format("📊 Classroom Audit Report: Room %s (%d Students) — %s",
                room.getRoomCode(),
                participants.size(),
                DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm").format(LocalDateTime.now())
        );
        helper.setSubject(subject);
        helper.setText(html, true);

        // Attach official Excel report workbook (.xlsx)
        try {
            byte[] excelBytes = generateClassroomReportExcel(room, allMetrics);
            helper.addAttachment(
                "Classroom_Audit_Report_" + room.getRoomCode() + ".xlsx",
                new ByteArrayResource(excelBytes),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
        } catch (Exception ex) {
            System.err.println("[EmailService] Warning: Could not generate/attach Excel workbook: " + ex.getMessage());
        }

        message.saveChanges();

        if (hasOAuth) {
            String accessToken = fetchGoogleAccessToken();
            sendViaGmailApi(message, accessToken);
            System.out.println("[EmailService] Successfully sent classroom report with Excel attachment via Gmail OAuth2 to " + teacherEmail);
        } else {
            if (mailSender == null) {
                throw new IllegalStateException("JavaMailSender bean is not available in Spring context.");
            }
            mailSender.send(message);
            System.out.println("[EmailService] Successfully sent classroom report with Excel attachment via SMTP to " + teacherEmail);
        }
    }

    /**
     * Asynchronously generates and dispatches the comprehensive classroom email report.
     */
    @Async
    public void sendClassroomReport(Room room, StudentProfile triggeringStudent) {
        try {
            sendClassroomReportSync(room, triggeringStudent);
        } catch (Exception ex) {
            System.err.println("[EmailService] Error in background email report dispatch: " + ex.getMessage());
        }
    }

    /**
     * Generates HTML report content directly for browser preview or testing.
     */
    public String generateClassroomReportHtml(Room room) {
        if (room == null) return "<p>Room not found.</p>";
        List<RoomParticipant> participants = roomParticipantRepository.findByRoomOrderByJoinedAtAsc(room);
        List<StudentMetrics> allMetrics = new ArrayList<>();
        for (RoomParticipant p : participants) {
            allMetrics.add(computeStudentMetrics(room, p.getStudentProfile()));
        }
        return buildClassroomHtml(room, allMetrics, null);
    }

    private StudentMetrics computeStudentMetrics(Room room, StudentProfile student) {
        StudentMetrics sm = new StudentMetrics();
        sm.profile = student;

        List<GameSession> activeSessions = gameSessionRepository.findByStudentProfileAndStatus(student, "ACTIVE");
        GameSession session = activeSessions.isEmpty() ? null : activeSessions.get(0);
        int currentPhaseIndex = session != null ? session.getCurrentPhase() : 1;
        boolean isSessionCompleted = session != null && "COMPLETED".equalsIgnoreCase(session.getStatus());

        List<AttemptLog> allAttempts = attemptLogRepository.findByStudentProfileOrderByAttemptTimeAsc(student);
        Map<String, List<AttemptLog>> phaseAttemptsMap = new HashMap<>();
        for (AttemptLog log : allAttempts) {
            String key = (log.getModule() != null ? log.getModule().toUpperCase() : "") + "_" + log.getPhase();
            phaseAttemptsMap.computeIfAbsent(key, k -> new ArrayList<>()).add(log);
        }

        LocalDateTime previousCompletedTime = (session != null && session.getStartTime() != null)
                ? session.getStartTime()
                : (room.getStartedAt() != null ? room.getStartedAt() : student.getCreatedAt());

        long totalSeconds = 0;
        int totalAttempts = 0;
        int completedCount = 0;

        for (int i = 0; i < 7; i++) {
            int phaseId = i + 1;
            String key = MODULES[i] + "_" + PHASES[i];
            List<AttemptLog> phaseAttempts = phaseAttemptsMap.getOrDefault(key, Collections.emptyList());

            int tries = 0;
            int failedCount = 0;
            LocalDateTime firstAttempt = phaseAttempts.isEmpty() ? null : phaseAttempts.get(0).getAttemptTime();
            LocalDateTime lastAttempt = null;
            LocalDateTime lastSuccessful = null;
            for (AttemptLog log : phaseAttempts) {
                if ("system=DRILL_RESET".equals(log.getUserInputData())) {
                    tries++;
                } else if (!log.isSuccessful()) {
                    failedCount++;
                } else {
                    lastSuccessful = log.getAttemptTime();
                }
                lastAttempt = log.getAttemptTime();
            }

            // If no drill reset was triggered, count 1 attempt per 3 failures
            if (tries == 0 && failedCount > 0) {
                tries = failedCount / 3;
            }
            totalAttempts += tries;

            boolean isPhaseDone = isSessionCompleted || (lastSuccessful != null) || (phaseId < currentPhaseIndex);
            if (isPhaseDone) completedCount++;

            long phaseSec = 0;
            if (isPhaseDone) {
                if (firstAttempt != null) {
                    LocalDateTime endRef = lastSuccessful != null ? lastSuccessful : (lastAttempt != null ? lastAttempt : firstAttempt);
                    long diff = ChronoUnit.SECONDS.between(firstAttempt, endRef);
                    long paused = (session != null && phaseId == currentPhaseIndex) ? session.getAccumulatedPauseSeconds() : 0L;
                    diff = Math.max(diff - paused, 0L);
                    if (diff <= 0) {
                        diff = Math.max(tries * 45L, 30L);
                    }
                    phaseSec = diff;
                    previousCompletedTime = endRef;
                } else if (previousCompletedTime != null) {
                    LocalDateTime endRef = lastSuccessful != null ? lastSuccessful : previousCompletedTime;
                    long diff = ChronoUnit.SECONDS.between(previousCompletedTime, endRef);
                    phaseSec = Math.max(diff, 30L);
                    previousCompletedTime = endRef;
                }
                totalSeconds += phaseSec;
            } else if (phaseId == currentPhaseIndex) {
                // Synchronize active phase timer with RoomController (pause/exit aware)
                if (session != null && session.getPhaseEnteredAt() != null) {
                    LocalDateTime activeStart = session.getPhaseEnteredAt();
                    LocalDateTime activeEnd = (session.getPhaseExitedAt() != null)
                            ? session.getPhaseExitedAt()
                            : LocalDateTime.now();

                    long diff = ChronoUnit.SECONDS.between(activeStart, activeEnd);
                    long paused = session.getAccumulatedPauseSeconds();
                    phaseSec = Math.max(diff - paused, 0L);
                    totalSeconds += phaseSec;
                } else {
                    phaseSec = 0L;
                }
            }

            PhaseMetric pm = new PhaseMetric();
            pm.phaseId = phaseId;
            pm.title = PHASE_NAMES[i];
            pm.tries = tries;
            pm.seconds = phaseSec;
            pm.isCompleted = isPhaseDone;
            sm.phaseMetrics.add(pm);
        }

        sm.completedPhasesCount = completedCount;
        sm.isCompletedAll = (completedCount >= 7) || isSessionCompleted;
        sm.totalTimeSeconds = totalSeconds;
        sm.avgTimeSeconds = (completedCount > 0) ? (totalSeconds / completedCount) : totalSeconds;
        sm.totalAttempts = totalAttempts;
        sm.currentPhase = currentPhaseIndex;
        sm.currentPhaseTitle = (currentPhaseIndex <= 7) ? PHASE_NAMES[currentPhaseIndex - 1] : "Completed All Phases";

        return sm;
    }

    private String buildClassroomHtml(Room room, List<StudentMetrics> list, StudentProfile triggeringStudent) {
        StringBuilder sb = new StringBuilder();
        int totalEnrolled = list.size();
        long completedCount = list.stream().filter(m -> m.isCompletedAll).count();

        sb.append("<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body style='margin:0;padding:20px;background:#090d16;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;'>");
        sb.append("<div style='max-width:750px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:30px;box-shadow:0 10px 30px rgba(0,0,0,0.5);'>");

        // Header
        sb.append("<div style='border-bottom:2px solid #3b82f6;padding-bottom:15px;margin-bottom:20px;'>");
        sb.append("<h1 style='margin:0;color:#38bdf8;font-size:22px;letter-spacing:1px;'>NO ZERO DAYS // CLASSROOM PERFORMANCE AUDIT</h1>");
        sb.append("<p style='margin:6px 0 0 0;color:#94a3b8;font-size:13px;'>Interactive Philippine Payroll Simulator — Student Completion & Progress Report</p>");
        sb.append("</div>");

        // Room Meta Box
        sb.append("<div style='display:flex;gap:15px;background:#1e293b;padding:15px;border-radius:8px;margin-bottom:25px;'>");
        sb.append("<div style='flex:1;'><div style='font-size:11px;color:#94a3b8;'>ROOM CODE</div><div style='font-size:18px;font-weight:bold;color:#facc15;letter-spacing:2px;'>").append(room.getRoomCode()).append("</div></div>");
        sb.append("<div style='flex:1;'><div style='font-size:11px;color:#94a3b8;'>TEACHER</div><div style='font-size:15px;font-weight:bold;color:#fff;'>").append(room.getTeacherName()).append("</div></div>");
        sb.append("<div style='flex:1;'><div style='font-size:11px;color:#94a3b8;'>SECTION</div><div style='font-size:15px;font-weight:bold;color:#fff;'>").append(room.getSection() != null ? room.getSection() : "N/A").append("</div></div>");
        sb.append("<div style='flex:1;'><div style='font-size:11px;color:#94a3b8;'>COMPLETED</div><div style='font-size:18px;font-weight:bold;color:#4ade80;'>").append(completedCount).append("/").append(totalEnrolled).append("</div></div>");
        sb.append("</div>");

        // Excel Attachment Notice
        sb.append("<div style='background:rgba(16, 185, 129, 0.12);border:1px solid #10b981;border-radius:8px;padding:12px 18px;margin-bottom:25px;'>");
        sb.append("<div style='font-size:14px;font-weight:bold;color:#34d399;'>📊 OFFICIAL EXCEL SPREADSHEET ATTACHED (.XLSX)</div>");
        sb.append("<div style='font-size:12px;color:#cbd5e1;margin-top:4px;'>A detailed multi-sheet audit workbook (<strong>Classroom_Audit_Report_").append(room.getRoomCode()).append(".xlsx</strong>) is attached to this email containing individual student performance metrics, phase timing audits, and attempt statistics.</div>");
        sb.append("</div>");

        // SECTION 1: FINISHED STUDENTS (Detailed Breakdown)
        List<StudentMetrics> completedList = new ArrayList<>();
        List<StudentMetrics> inProgressList = new ArrayList<>();
        for (StudentMetrics sm : list) {
            if (sm.isCompletedAll) completedList.add(sm);
            else inProgressList.add(sm);
        }

        if (!completedList.isEmpty()) {
            sb.append("<h2 style='color:#4ade80;font-size:16px;border-left:4px solid #4ade80;padding-left:10px;margin-bottom:15px;'>");
            sb.append("🎓 COMPLETED STUDENTS (DETAILED PHASE AUDIT)");
            sb.append("</h2>");

            for (StudentMetrics sm : completedList) {
                boolean isTrigger = triggeringStudent != null && triggeringStudent.getStudentNumber().equals(sm.profile.getStudentNumber());
                sb.append("<div style='background:#111827;border:1px solid ").append(isTrigger ? "#38bdf8" : "#334155").append(";border-radius:8px;padding:20px;margin-bottom:20px;'>");
                
                // Student Name Banner
                sb.append("<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;'>");
                sb.append("<div><span style='font-size:18px;font-weight:bold;color:#fff;'>").append(sm.profile.getFullName()).append("</span>");
                sb.append("<span style='margin-left:10px;color:#94a3b8;font-size:13px;'>(").append(sm.profile.getStudentNumber()).append(")</span></div>");
                sb.append("<span style='background:#15803d;color:#dcfce7;font-size:11px;font-weight:bold;padding:4px 10px;border-radius:4px;'>COMPLETED ALL PHASES (7/7)</span>");
                sb.append("</div>");

                // Metric Badges
                sb.append("<div style='display:flex;gap:10px;margin-bottom:15px;'>");
                sb.append("<div style='flex:1;background:#1e293b;padding:10px;border-radius:5px;'><div style='font-size:11px;color:#94a3b8;'>TOTAL TIME SPENT</div><div style='font-size:15px;font-weight:bold;color:#38bdf8;'>").append(formatSeconds(sm.totalTimeSeconds)).append("</div></div>");
                sb.append("<div style='flex:1;background:#1e293b;padding:10px;border-radius:5px;'><div style='font-size:11px;color:#94a3b8;'>AVG TIME / PHASE</div><div style='font-size:15px;font-weight:bold;color:#4ade80;'>").append(formatSeconds(sm.avgTimeSeconds)).append("</div></div>");
                sb.append("<div style='flex:1;background:#1e293b;padding:10px;border-radius:5px;'><div style='font-size:11px;color:#94a3b8;'>TOTAL TRIES</div><div style='font-size:15px;font-weight:bold;color:#fbbf24;'>").append(sm.totalAttempts).append(" attempts</div></div>");
                sb.append("</div>");

                // Detailed Phase Table
                sb.append("<table style='width:100%;border-collapse:collapse;font-size:13px;'>");
                sb.append("<thead><tr style='background:#1e293b;color:#94a3b8;'><th style='padding:8px;border:1px solid #334155;text-align:left;'>Phase</th><th style='padding:8px;border:1px solid #334155;text-align:center;'>Tries / Attempts</th><th style='padding:8px;border:1px solid #334155;text-align:center;'>Time Spent</th><th style='padding:8px;border:1px solid #334155;text-align:center;'>Status</th></tr></thead>");
                sb.append("<tbody>");
                for (PhaseMetric pm : sm.phaseMetrics) {
                    sb.append("<tr>");
                    sb.append("<td style='padding:8px;border:1px solid #334155;color:#e2e8f0;'>").append(pm.title).append("</td>");
                    sb.append("<td style='padding:8px;border:1px solid #334155;text-align:center;color:#fbbf24;font-weight:bold;'>").append(pm.tries).append("</td>");
                    sb.append("<td style='padding:8px;border:1px solid #334155;text-align:center;color:#38bdf8;'>").append(formatSeconds(pm.seconds)).append("</td>");
                    sb.append("<td style='padding:8px;border:1px solid #334155;text-align:center;color:#4ade80;'>✓ Completed</td>");
                    sb.append("</tr>");
                }
                sb.append("</tbody></table>");
                sb.append("</div>");
            }
        }

        // SECTION 2: CLASSROOM ROSTER (ALL STUDENTS STATUS)
        sb.append("<h2 style='color:#38bdf8;font-size:16px;border-left:4px solid #38bdf8;padding-left:10px;margin-top:25px;margin-bottom:15px;'>");
        sb.append("👥 ENROLLED STUDENTS PROGRESS (").append(totalEnrolled).append(" Students)");
        sb.append("</h2>");

        sb.append("<table style='width:100%;border-collapse:collapse;font-size:13px;background:#111827;border-radius:6px;overflow:hidden;'>");
        sb.append("<thead><tr style='background:#1e293b;color:#94a3b8;'><th style='padding:10px;border:1px solid #334155;text-align:left;'>#</th><th style='padding:10px;border:1px solid #334155;text-align:left;'>Student Name</th><th style='padding:10px;border:1px solid #334155;text-align:left;'>ID Number</th><th style='padding:10px;border:1px solid #334155;text-align:center;'>Completed</th><th style='padding:10px;border:1px solid #334155;text-align:center;'>Total Attempts</th><th style='padding:10px;border:1px solid #334155;text-align:center;'>Time Elapsed</th></tr></thead>");
        sb.append("<tbody>");

        int index = 1;
        for (StudentMetrics sm : list) {
            String statusBadge = sm.isCompletedAll
                    ? "<span style='color:#4ade80;font-weight:bold;'>✓ Done (7/7)</span>"
                    : "<span style='color:#fbbf24;font-weight:bold;'>Phase " + sm.currentPhase + " (" + sm.completedPhasesCount + "/7)</span>";

            sb.append("<tr>");
            sb.append("<td style='padding:8px 10px;border:1px solid #334155;color:#64748b;'>").append(index++).append("</td>");
            sb.append("<td style='padding:8px 10px;border:1px solid #334155;font-weight:bold;color:#fff;'>").append(sm.profile.getFullName()).append("</td>");
            sb.append("<td style='padding:8px 10px;border:1px solid #334155;color:#94a3b8;'>").append(sm.profile.getStudentNumber()).append("</td>");
            sb.append("<td style='padding:8px 10px;border:1px solid #334155;text-align:center;'>").append(statusBadge).append("</td>");
            sb.append("<td style='padding:8px 10px;border:1px solid #334155;text-align:center;color:#fbbf24;'>").append(sm.totalAttempts).append("</td>");
            sb.append("<td style='padding:8px 10px;border:1px solid #334155;text-align:center;color:#38bdf8;'>").append(formatSeconds(sm.totalTimeSeconds)).append("</td>");
            sb.append("</tr>");
        }
        sb.append("</tbody></table>");

        // Footer
        sb.append("<div style='margin-top:25px;padding-top:15px;border-top:1px solid #1e293b;text-align:center;color:#64748b;font-size:12px;'>");
        sb.append("Generated by No Zero Days Payroll Simulator // Grade 12 ABM Capstone Platform");
        sb.append("</div>");

        sb.append("</div></body></html>");
        return sb.toString();
    }

    private String formatSeconds(long totalSeconds) {
        if (totalSeconds <= 0) return "--";
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

    /**
     * Generates a multi-sheet Microsoft Excel spreadsheet report (.xlsx) for the specified classroom room.
     */
    public byte[] generateClassroomReportExcel(Room room) throws Exception {
        if (room == null) throw new IllegalArgumentException("Room cannot be null");
        List<RoomParticipant> participants = roomParticipantRepository.findByRoomOrderByJoinedAtAsc(room);
        List<StudentMetrics> allMetrics = new ArrayList<>();
        for (RoomParticipant p : participants) {
            allMetrics.add(computeStudentMetrics(room, p.getStudentProfile()));
        }
        return generateClassroomReportExcel(room, allMetrics);
    }

    /**
     * Generates a multi-sheet Microsoft Excel spreadsheet report (.xlsx) with styled summary and student roster.
     */
    public byte[] generateClassroomReportExcel(Room room, List<StudentMetrics> list) throws Exception {
        try (Workbook workbook = new XSSFWorkbook()) {
            // Colors & Fonts
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 11);

            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 15);
            titleFont.setColor(IndexedColors.DARK_BLUE.getIndex());
            titleStyle.setFont(titleFont);

            CellStyle boldLabelStyle = workbook.createCellStyle();
            Font boldLabelFont = workbook.createFont();
            boldLabelFont.setBold(true);
            boldLabelStyle.setFont(boldLabelFont);

            CellStyle cellStyle = workbook.createCellStyle();
            cellStyle.setBorderTop(BorderStyle.THIN);
            cellStyle.setBorderBottom(BorderStyle.THIN);
            cellStyle.setBorderLeft(BorderStyle.THIN);
            cellStyle.setBorderRight(BorderStyle.THIN);
            cellStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle cellCenterStyle = workbook.createCellStyle();
            cellCenterStyle.cloneStyleFrom(cellStyle);
            cellCenterStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle completedBadgeStyle = workbook.createCellStyle();
            completedBadgeStyle.cloneStyleFrom(cellCenterStyle);
            Font completedFont = workbook.createFont();
            completedFont.setBold(true);
            completedFont.setColor(IndexedColors.DARK_GREEN.getIndex());
            completedBadgeStyle.setFont(completedFont);

            CellStyle inProgressBadgeStyle = workbook.createCellStyle();
            inProgressBadgeStyle.cloneStyleFrom(cellCenterStyle);
            Font inProgressFont = workbook.createFont();
            inProgressFont.setBold(true);
            inProgressFont.setColor(IndexedColors.DARK_YELLOW.getIndex());
            inProgressBadgeStyle.setFont(inProgressFont);

            // ==========================================
            // SHEET 1: Classroom Summary
            // ==========================================
            Sheet summarySheet = workbook.createSheet("Classroom Summary");
            summarySheet.setDisplayGridlines(true);

            int rowIdx = 0;
            Row titleRow = summarySheet.createRow(rowIdx++);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("NO ZERO DAYS // CLASSROOM PERFORMANCE AUDIT");
            titleCell.setCellStyle(titleStyle);

            Row subRow = summarySheet.createRow(rowIdx++);
            subRow.createCell(0).setCellValue("Philippine Payroll Simulation Capstone Platform");

            rowIdx++; // blank row

            int totalEnrolled = list.size();
            long completedCount = list.stream().filter(m -> m.isCompletedAll).count();

            createMetaRow(summarySheet, rowIdx++, "Room Code", room.getRoomCode(), boldLabelStyle);
            createMetaRow(summarySheet, rowIdx++, "Supervisor / Teacher", room.getTeacherName(), boldLabelStyle);
            createMetaRow(summarySheet, rowIdx++, "Section", room.getSection() != null ? room.getSection() : "General", boldLabelStyle);
            createMetaRow(summarySheet, rowIdx++, "Teacher Recipient Email", room.getTeacherEmail() != null ? room.getTeacherEmail() : "Not set", boldLabelStyle);
            createMetaRow(summarySheet, rowIdx++, "Enrolled Students", String.valueOf(totalEnrolled), boldLabelStyle);
            createMetaRow(summarySheet, rowIdx++, "Completed All Phases (7/7)", completedCount + " / " + totalEnrolled, boldLabelStyle);
            createMetaRow(summarySheet, rowIdx++, "Report Generated At", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")), boldLabelStyle);

            rowIdx++; // blank row

            Row tableTitle = summarySheet.createRow(rowIdx++);
            Cell ttCell = tableTitle.createCell(0);
            ttCell.setCellValue("PHASE-BY-PHASE MASTERY OVERVIEW");
            ttCell.setCellStyle(boldLabelStyle);

            String[] summaryHeaders = {"Phase #", "Module & Phase Title", "Passed Students", "Class Completion Rate", "Avg Time Spent", "Total Attempts"};
            Row summaryHeaderRow = summarySheet.createRow(rowIdx++);
            summaryHeaderRow.setHeightInPoints(24);
            for (int col = 0; col < summaryHeaders.length; col++) {
                Cell c = summaryHeaderRow.createCell(col);
                c.setCellValue(summaryHeaders[col]);
                c.setCellStyle(headerStyle);
            }

            for (int i = 0; i < 7; i++) {
                int phaseId = i + 1;
                int passedInPhase = 0;
                long totalPhaseSec = 0;
                int timeCount = 0;
                int phaseAttemptsSum = 0;

                for (StudentMetrics sm : list) {
                    if (sm.phaseMetrics.size() > i) {
                        PhaseMetric pm = sm.phaseMetrics.get(i);
                        if (pm.isCompleted) passedInPhase++;
                        if (pm.seconds > 0) {
                            totalPhaseSec += pm.seconds;
                            timeCount++;
                        }
                        phaseAttemptsSum += pm.tries;
                    }
                }

                long avgSec = timeCount > 0 ? (totalPhaseSec / timeCount) : 0;
                double rate = totalEnrolled > 0 ? ((double) passedInPhase / totalEnrolled) * 100.0 : 0.0;

                Row r = summarySheet.createRow(rowIdx++);
                Cell c0 = r.createCell(0); c0.setCellValue("Phase " + phaseId); c0.setCellStyle(cellCenterStyle);
                Cell c1 = r.createCell(1); c1.setCellValue(PHASE_NAMES[i]); c1.setCellStyle(cellStyle);
                Cell c2 = r.createCell(2); c2.setCellValue(passedInPhase + " / " + totalEnrolled); c2.setCellStyle(cellCenterStyle);
                Cell c3 = r.createCell(3); c3.setCellValue(String.format("%.1f%%", rate)); c3.setCellStyle(cellCenterStyle);
                Cell c4 = r.createCell(4); c4.setCellValue(formatSeconds(avgSec)); c4.setCellStyle(cellCenterStyle);
                Cell c5 = r.createCell(5); c5.setCellValue(phaseAttemptsSum); c5.setCellStyle(cellCenterStyle);
            }

            for (int col = 0; col < summaryHeaders.length; col++) {
                summarySheet.autoSizeColumn(col);
                summarySheet.setColumnWidth(col, Math.max(summarySheet.getColumnWidth(col) + 1200, 4200));
            }

            // ==========================================
            // SHEET 2: Student Roster & Metrics
            // ==========================================
            Sheet rosterSheet = workbook.createSheet("Student Roster");
            rosterSheet.setDisplayGridlines(true);

            String[] rosterHeaders = {
                "#", "Student Name", "Student ID", "Status", "Completed Phases",
                "Total Attempts", "Total Time Spent", "Avg Time / Phase",
                "P1 Tries", "P1 Time", "P2 Tries", "P2 Time", "P3 Tries", "P3 Time",
                "P4 Tries", "P4 Time", "P5 Tries", "P5 Time", "P6 Tries", "P6 Time",
                "P7 Tries", "P7 Time"
            };

            Row rosterHeaderRow = rosterSheet.createRow(0);
            rosterHeaderRow.setHeightInPoints(24);
            for (int col = 0; col < rosterHeaders.length; col++) {
                Cell c = rosterHeaderRow.createCell(col);
                c.setCellValue(rosterHeaders[col]);
                c.setCellStyle(headerStyle);
            }

            int sIdx = 1;
            for (StudentMetrics sm : list) {
                Row r = rosterSheet.createRow(sIdx);
                Cell c0 = r.createCell(0); c0.setCellValue(sIdx); c0.setCellStyle(cellCenterStyle);
                Cell c1 = r.createCell(1); c1.setCellValue(sm.profile.getFullName()); c1.setCellStyle(cellStyle);
                Cell c2 = r.createCell(2); c2.setCellValue(sm.profile.getStudentNumber()); c2.setCellStyle(cellCenterStyle);
                Cell c3 = r.createCell(3);
                c3.setCellValue(sm.isCompletedAll ? "COMPLETED (7/7)" : "Phase " + sm.currentPhase + " (" + sm.completedPhasesCount + "/7)");
                c3.setCellStyle(sm.isCompletedAll ? completedBadgeStyle : inProgressBadgeStyle);

                Cell c4 = r.createCell(4); c4.setCellValue(sm.completedPhasesCount + " / 7"); c4.setCellStyle(cellCenterStyle);
                Cell c5 = r.createCell(5); c5.setCellValue(sm.totalAttempts); c5.setCellStyle(cellCenterStyle);
                Cell c6 = r.createCell(6); c6.setCellValue(formatSeconds(sm.totalTimeSeconds)); c6.setCellStyle(cellCenterStyle);
                Cell c7 = r.createCell(7); c7.setCellValue(formatSeconds(sm.avgTimeSeconds)); c7.setCellStyle(cellCenterStyle);

                for (int p = 0; p < 7; p++) {
                    int tryCol = 8 + (p * 2);
                    int timeCol = 9 + (p * 2);
                    if (p < sm.phaseMetrics.size()) {
                        PhaseMetric pm = sm.phaseMetrics.get(p);
                        Cell cTries = r.createCell(tryCol);
                        cTries.setCellValue(pm.tries);
                        cTries.setCellStyle(cellCenterStyle);

                        Cell cTime = r.createCell(timeCol);
                        cTime.setCellValue(pm.isCompleted || pm.seconds > 0 ? formatSeconds(pm.seconds) : "--");
                        cTime.setCellStyle(cellCenterStyle);
                    } else {
                        Cell cTries = r.createCell(tryCol); cTries.setCellValue(0); cTries.setCellStyle(cellCenterStyle);
                        Cell cTime = r.createCell(timeCol); cTime.setCellValue("--"); cTime.setCellStyle(cellCenterStyle);
                    }
                }
                sIdx++;
            }

            for (int col = 0; col < rosterHeaders.length; col++) {
                rosterSheet.autoSizeColumn(col);
                rosterSheet.setColumnWidth(col, Math.max(rosterSheet.getColumnWidth(col) + 800, 3200));
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);
            return baos.toByteArray();
        }
    }

    private void createMetaRow(Sheet sheet, int rowIdx, String label, String value, CellStyle boldStyle) {
        Row r = sheet.createRow(rowIdx);
        Cell c0 = r.createCell(0);
        c0.setCellValue(label + ":");
        c0.setCellStyle(boldStyle);
        Cell c1 = r.createCell(1);
        c1.setCellValue(value != null ? value : "N/A");
    }

    /**
     * Refreshes the Google OAuth2 access token using the stored refresh token.
     */
    private String fetchGoogleAccessToken() throws Exception {
        String form = "client_id=" + URLEncoder.encode(googleClientId.trim(), StandardCharsets.UTF_8)
                + "&client_secret=" + URLEncoder.encode(googleClientSecret.trim(), StandardCharsets.UTF_8)
                + "&refresh_token=" + URLEncoder.encode(googleRefreshToken.trim(), StandardCharsets.UTF_8)
                + "&grant_type=refresh_token";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://oauth2.googleapis.com/token"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IllegalStateException("Failed to refresh Google OAuth2 access token (HTTP "
                    + response.statusCode() + "): " + response.body());
        }

        String body = response.body();
        int tokenIdx = body.indexOf("\"access_token\":");
        if (tokenIdx == -1) {
            throw new IllegalStateException("No access_token field in Google OAuth response: " + body);
        }
        int startQuote = body.indexOf("\"", tokenIdx + 15);
        int endQuote = body.indexOf("\"", startQuote + 1);
        return body.substring(startQuote + 1, endQuote);
    }

    /**
     * Dispatches the RFC822 MimeMessage directly via the official Google Gmail REST API.
     */
    private void sendViaGmailApi(MimeMessage message, String accessToken) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        message.writeTo(buffer);
        String rawBase64 = Base64.getUrlEncoder().withoutPadding().encodeToString(buffer.toByteArray());

        String jsonPayload = "{\"raw\":\"" + rawBase64 + "\"}";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://gmail.googleapis.com/gmail/v1/users/me/messages/send"))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json; charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload, StandardCharsets.UTF_8))
                .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IllegalStateException("Gmail API send failed (HTTP " + response.statusCode() + "): " + response.body());
        }
    }
}
