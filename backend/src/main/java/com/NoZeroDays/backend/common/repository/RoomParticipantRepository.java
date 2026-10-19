package com.NoZeroDays.backend.common.repository;

import com.NoZeroDays.backend.common.model.Room;
import com.NoZeroDays.backend.common.model.RoomParticipant;
import com.NoZeroDays.backend.common.model.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, Long> {
    List<RoomParticipant> findByRoomOrderByJoinedAtAsc(Room room);
    Optional<RoomParticipant> findByRoomAndStudentProfile(Room room, StudentProfile studentProfile);
    void deleteByRoomAndStudentProfile(Room room, StudentProfile studentProfile);
    void deleteByStudentProfile(StudentProfile studentProfile);
    long countByRoom(Room room);
}
