package com.NoZeroDays.backend.common.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Server-side record of the scenario a student registered for a module+phase.
 * Registered on the first successful EXTRACT of that phase and compared against
 * every subsequent submission so scenario values cannot be silently swapped mid-phase.
 */
@Entity
@Table(name = "scenario_snapshots",
       uniqueConstraints = @UniqueConstraint(columnNames = {"student_profile_id", "module", "phase"}))
public class ScenarioSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "student_profile_id", nullable = false)
    private StudentProfile studentProfile;

    @Column(nullable = false)
    private String module;

    @Column(nullable = false)
    private Integer phase;

    private Double dailyRate;
    private Integer daysPresent;
    private Double hourlyRate;
    private Integer lateMinutes;
    private Integer redHerringLateMinutes;
    private Integer earlyClockInMinutes;
    private Double otHours;
    private Double unpaidLunchHours;
    private Boolean workedOnHoliday;
    private Double basicSalary;
    private Double sssEeShare;
    private Double sssErShare;
    private Double personalSalaryLoan;
    private Double spouseLoan;
    private Double riceSubsidy;
    private Double uniformAllowance;
    private Double grossPay;
    private Double tardinessDeduction;
    private String employeeName;
    private String companyName;

    private LocalDateTime updatedAt = LocalDateTime.now();

    public ScenarioSnapshot() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public StudentProfile getStudentProfile() { return studentProfile; }
    public void setStudentProfile(StudentProfile studentProfile) { this.studentProfile = studentProfile; }

    public String getModule() { return module; }
    public void setModule(String module) { this.module = module; }

    public Integer getPhase() { return phase; }
    public void setPhase(Integer phase) { this.phase = phase; }

    public Double getDailyRate() { return dailyRate; }
    public void setDailyRate(Double dailyRate) { this.dailyRate = dailyRate; }

    public Integer getDaysPresent() { return daysPresent; }
    public void setDaysPresent(Integer daysPresent) { this.daysPresent = daysPresent; }

    public Double getHourlyRate() { return hourlyRate; }
    public void setHourlyRate(Double hourlyRate) { this.hourlyRate = hourlyRate; }

    public Integer getLateMinutes() { return lateMinutes; }
    public void setLateMinutes(Integer lateMinutes) { this.lateMinutes = lateMinutes; }

    public Integer getRedHerringLateMinutes() { return redHerringLateMinutes; }
    public void setRedHerringLateMinutes(Integer redHerringLateMinutes) { this.redHerringLateMinutes = redHerringLateMinutes; }

    public Integer getEarlyClockInMinutes() { return earlyClockInMinutes; }
    public void setEarlyClockInMinutes(Integer earlyClockInMinutes) { this.earlyClockInMinutes = earlyClockInMinutes; }

    public Double getOtHours() { return otHours; }
    public void setOtHours(Double otHours) { this.otHours = otHours; }

    public Double getUnpaidLunchHours() { return unpaidLunchHours; }
    public void setUnpaidLunchHours(Double unpaidLunchHours) { this.unpaidLunchHours = unpaidLunchHours; }

    public Boolean getWorkedOnHoliday() { return workedOnHoliday; }
    public void setWorkedOnHoliday(Boolean workedOnHoliday) { this.workedOnHoliday = workedOnHoliday; }

    public Double getBasicSalary() { return basicSalary; }
    public void setBasicSalary(Double basicSalary) { this.basicSalary = basicSalary; }

    public Double getSssEeShare() { return sssEeShare; }
    public void setSssEeShare(Double sssEeShare) { this.sssEeShare = sssEeShare; }

    public Double getSssErShare() { return sssErShare; }
    public void setSssErShare(Double sssErShare) { this.sssErShare = sssErShare; }

    public Double getPersonalSalaryLoan() { return personalSalaryLoan; }
    public void setPersonalSalaryLoan(Double personalSalaryLoan) { this.personalSalaryLoan = personalSalaryLoan; }

    public Double getSpouseLoan() { return spouseLoan; }
    public void setSpouseLoan(Double spouseLoan) { this.spouseLoan = spouseLoan; }

    public Double getRiceSubsidy() { return riceSubsidy; }
    public void setRiceSubsidy(Double riceSubsidy) { this.riceSubsidy = riceSubsidy; }

    public Double getUniformAllowance() { return uniformAllowance; }
    public void setUniformAllowance(Double uniformAllowance) { this.uniformAllowance = uniformAllowance; }

    public Double getGrossPay() { return grossPay; }
    public void setGrossPay(Double grossPay) { this.grossPay = grossPay; }

    public Double getTardinessDeduction() { return tardinessDeduction; }
    public void setTardinessDeduction(Double tardinessDeduction) { this.tardinessDeduction = tardinessDeduction; }

    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
