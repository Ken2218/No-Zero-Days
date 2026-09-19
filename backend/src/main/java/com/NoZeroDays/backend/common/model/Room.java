package com.NoZeroDays.backend.common.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "rooms", indexes = {
    @Index(name = "idx_room_code", columnList = "roomCode", unique = true)
})
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 10)
    private String roomCode;

    @Column(nullable = false)
    private String teacherName;

    private String section;

    // WAITING = room created, students can join; ACTIVE = session started; CLOSED = session ended
    @Column(nullable = false)
    private String status = "WAITING";

    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime startedAt;

    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<RoomParticipant> participants = new ArrayList<>();

    // Default Constructor
    public Room() {}

    public Room(String roomCode, String teacherName, String section) {
        this.roomCode = roomCode;
        this.teacherName = teacherName;
        this.section = section;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRoomCode() { return roomCode; }
    public void setRoomCode(String roomCode) { this.roomCode = roomCode; }

    public String getTeacherName() { return teacherName; }
    public void setTeacherName(String teacherName) { this.teacherName = teacherName; }

    public String getSection() { return section; }
    public void setSection(String section) { this.section = section; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }

    public List<RoomParticipant> getParticipants() { return participants; }
    public void setParticipants(List<RoomParticipant> participants) { this.participants = participants; }
}
