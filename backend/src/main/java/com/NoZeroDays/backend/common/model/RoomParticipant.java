package com.NoZeroDays.backend.common.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "room_participants", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"room_id", "student_number"})
})
public class RoomParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "student_number", nullable = false)
    private String studentNumber;

    @Column(nullable = false)
    private String fullName;

    private String section;

    private LocalDateTime joinedAt = LocalDateTime.now();

    // Default Constructor
    public RoomParticipant() {}

    public RoomParticipant(Room room, String studentNumber, String fullName, String section) {
        this.room = room;
        this.studentNumber = studentNumber;
        this.fullName = fullName;
        this.section = section;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }

    public String getStudentNumber() { return studentNumber; }
    public void setStudentNumber(String studentNumber) { this.studentNumber = studentNumber; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getSection() { return section; }
    public void setSection(String section) { this.section = section; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
}
