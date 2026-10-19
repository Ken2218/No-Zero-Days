package com.NoZeroDays.backend.common.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "room_participants", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"room_id", "student_profile_id"})
})
public class RoomParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(optional = false)
    @JoinColumn(name = "student_profile_id", nullable = false)
    private StudentProfile studentProfile;

    @Column(nullable = false, length = 20)
    private String status = "ACCEPTED";

    private LocalDateTime joinedAt = LocalDateTime.now();

    public RoomParticipant() {}

    public RoomParticipant(Room room, StudentProfile studentProfile) {
        this.room = room;
        this.studentProfile = studentProfile;
        this.joinedAt = LocalDateTime.now();
        this.status = "ACCEPTED";
    }

    public RoomParticipant(Room room, StudentProfile studentProfile, String status) {
        this.room = room;
        this.studentProfile = studentProfile;
        this.joinedAt = LocalDateTime.now();
        this.status = status != null ? status : "ACCEPTED";
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }

    public StudentProfile getStudentProfile() { return studentProfile; }
    public void setStudentProfile(StudentProfile studentProfile) { this.studentProfile = studentProfile; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }

    public String getStatus() { return status != null ? status : "ACCEPTED"; }
    public void setStatus(String status) { this.status = status; }
}
