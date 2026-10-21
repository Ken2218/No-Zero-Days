package com.NoZeroDays.backend.common.repository;

import com.NoZeroDays.backend.common.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    Optional<Room> findByRoomCodeIgnoreCase(String roomCode);
    boolean existsByRoomCodeIgnoreCase(String roomCode);
    List<Room> findByTeacherOrderByCreatedAtDesc(com.NoZeroDays.backend.common.model.Teacher teacher);
    List<Room> findByTeacherIdOrderByCreatedAtDesc(Long teacherId);
    List<Room> findByTeacherEmailIgnoreCaseOrderByCreatedAtDesc(String teacherEmail);
    List<Room> findByTeacherNameIgnoreCaseOrderByCreatedAtDesc(String teacherName);
    Optional<Room> findFirstByTeacherEmailIgnoreCaseOrderByCreatedAtDesc(String teacherEmail);
    Optional<Room> findFirstByTeacherNameIgnoreCaseOrderByCreatedAtDesc(String teacherName);
}
