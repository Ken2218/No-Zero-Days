package com.NoZeroDays.backend.common.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class LoginRequest {
    private String studentNumber;
    private String name;
    private String fullName;
    private String role;
    private String email;
    private String teacherEmail;
    private String teacherName;
    private String section;

    public LoginRequest() {}

    public LoginRequest(String studentNumber, String name, String role) {
        this.studentNumber = studentNumber;
        this.name = name;
        this.fullName = name;
        this.role = role;
    }

    public String getStudentNumber() { return studentNumber; }
    public void setStudentNumber(String studentNumber) { this.studentNumber = studentNumber; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getTeacherEmail() { return teacherEmail; }
    public void setTeacherEmail(String teacherEmail) { this.teacherEmail = teacherEmail; }

    public String getTeacherName() { return teacherName; }
    public void setTeacherName(String teacherName) { this.teacherName = teacherName; }

    public String getSection() { return section; }
    public void setSection(String section) { this.section = section; }

    // Helpers
    public String getEffectiveStudentNumber() {
        return studentNumber != null ? studentNumber.trim() : "";
    }

    public String getEffectiveName() {
        if (fullName != null && !fullName.trim().isEmpty()) {
            return fullName.trim();
        }
        if (name != null && !name.trim().isEmpty()) {
            return name.trim();
        }
        if (teacherName != null && !teacherName.trim().isEmpty()) {
            return teacherName.trim();
        }
        return "";
    }

    public String getEffectiveEmail() {
        if (email != null && !email.trim().isEmpty()) {
            return email.trim();
        }
        if (teacherEmail != null && !teacherEmail.trim().isEmpty()) {
            return teacherEmail.trim();
        }
        return "";
    }

    public boolean isTeacher() {
        if (role != null) {
            String r = role.trim().toUpperCase();
            if (r.contains("TEACHER") || r.equals("OM-TEACHER")) {
                return true;
            }
        }
        return !getEffectiveEmail().isEmpty() && getEffectiveStudentNumber().isEmpty();
    }
}
