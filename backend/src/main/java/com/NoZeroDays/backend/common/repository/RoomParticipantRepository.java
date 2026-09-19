package com.NoZeroDays.backend.common.repository;

import com.NoZeroDays.backend.common.model.Room;
import com.NoZeroDays.backend.common.model.RoomParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, Long> {
    List<RoomParticipant> findByRoomOrderByJoinedAtAsc(Room room);
    long countByRoom(Room room);
    boolean existsByRoomAndStudentNumber(Room room, String studentNumber);
}
