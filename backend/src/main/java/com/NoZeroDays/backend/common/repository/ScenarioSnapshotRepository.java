package com.NoZeroDays.backend.common.repository;

import com.NoZeroDays.backend.common.model.ScenarioSnapshot;
import com.NoZeroDays.backend.common.model.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Repository
public interface ScenarioSnapshotRepository extends JpaRepository<ScenarioSnapshot, Long> {
    Optional<ScenarioSnapshot> findByStudentProfileAndModuleAndPhase(StudentProfile studentProfile, String module, Integer phase);

    @Modifying
    @Transactional
    void deleteByStudentProfile(StudentProfile studentProfile);
}
