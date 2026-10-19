package com.NoZeroDays.backend.common.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "rooms")
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 32)
    private String roomCode;

    @Column(nullable = false)
    private String teacherName;

    private String section;

    private String teacherEmail;

    @Column(nullable = false)
    private String status = "WAITING"; // WAITING, ACTIVE, COMPLETED

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime startedAt;

    public Room() {}

    public Room(String roomCode, String teacherName, String section) {
        this.roomCode = roomCode;
        this.teacherName = teacherName;
        this.section = section;
        this.status = "WAITING";
        this.createdAt = LocalDateTime.now();
    }

    public Room(String roomCode, String teacherName, String section, String teacherEmail) {
        this.roomCode = roomCode;
        this.teacherName = teacherName;
        this.section = section;
        this.teacherEmail = teacherEmail;
        this.status = "WAITING";
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRoomCode() { return roomCode; }
    public void setRoomCode(String roomCode) { this.roomCode = roomCode; }

    public String getTeacherName() { return teacherName; }
    public void setTeacherName(String teacherName) { this.teacherName = teacherName; }

    public String getTeacherEmail() { return teacherEmail; }
    public void setTeacherEmail(String teacherEmail) { this.teacherEmail = teacherEmail; }

    public String getSection() { return section; }
    public void setSection(String section) { this.section = section; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
}
