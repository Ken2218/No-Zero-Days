import React, { useState, useEffect } from 'react';
import { authFetch, logout } from '../utils/api';
import { PHASE_GUIDES } from '../utils/phaseGuides';
import { clearAllPhaseStorage } from '../utils/storage';
import OnboardingGuide from '../components/Shared/OnboardingGuide';
import ReAuditLeaderboardModal from '../components/Shared/ReAuditLeaderboardModal';
import './Auth.css';

interface DashboardProps {
  student?: any;
  onSelectPhase: (phaseId: number) => void;
  onStudentJoinRoom: (code: string, student: any, progressReset?: boolean) => void;
  roomCode: string;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
  initialGuideOpen?: boolean;
}

export default function Dashboard({ student: propStudent, onSelectPhase, onStudentJoinRoom, roomCode, theme, toggleTheme, initialGuideOpen }: DashboardProps) {
  const [student, setStudent] = useState(() => {
    if (propStudent) return propStudent;
    const saved = localStorage.getItem('student');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return { fullName: 'Student', studentNumber: '', section: '' };
  });
  const [progressList, setProgressList] = useState([]);
  const [selectedPhaseSummary, setSelectedPhaseSummary] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [phaseGuideTarget, setPhaseGuideTarget] = useState<number | null>(null);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinConfirming, setJoinConfirming] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // ── Onboarding guide: strictly auto-opens ONCE per user lifetime ──
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      // Small delay so the dashboard renders before the modal appears
      const timer = setTimeout(() => {
        setIsGuideOpen(true);
        localStorage.setItem('hasSeenTutorial', 'true');
      }, 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const defaultRoadmap = [
    { phaseId: 1, title: "Phase 1: Basic Gross Pay", description: "Audit morning Lobby Daily Rate and Shifts worked.", status: "NOT_ATTEMPTED", bestScore: 0, module: "M1_MATH", phaseIndex: 1, hasReAudited: false, reAuditCompleted: false, reAuditScore: 0 },
    { phaseId: 2, title: "Phase 2: Tardiness Deductions", description: "Audit biometric clock-in logs and raw late minutes.", status: "NOT_ATTEMPTED", bestScore: 0, module: "M1_MATH", phaseIndex: 2, hasReAudited: false, reAuditCompleted: false, reAuditScore: 0 },
    { phaseId: 3, title: "Phase 3: Overtime Premiums", description: "Verify OT multipliers and unpaid lunch breaks.", status: "NOT_ATTEMPTED", bestScore: 0, module: "M2_MULTIPLIERS", phaseIndex: 1, hasReAudited: false, reAuditCompleted: false, reAuditScore: 0 },
    { phaseId: 4, title: "Phase 4: Regular Holiday Pay", description: "Audit Regular Holiday Double Pay rules.", status: "NOT_ATTEMPTED", bestScore: 0, module: "M2_MULTIPLIERS", phaseIndex: 2, hasReAudited: false, reAuditCompleted: false, reAuditScore: 0 },
    { phaseId: 5, title: "Phase 5: SSS Deductions", description: "Verify SSS EE share vs ER share deductions.", status: "NOT_ATTEMPTED", bestScore: 0, module: "M3_BUREAUCRACY", phaseIndex: 1, hasReAudited: false, reAuditCompleted: false, reAuditScore: 0 },
    { phaseId: 6, title: "Phase 6: PhilHealth Premiums", description: "Verify PhilHealth premium percentages.", status: "NOT_ATTEMPTED", bestScore: 0, module: "M3_BUREAUCRACY", phaseIndex: 2, hasReAudited: false, reAuditCompleted: false, reAuditScore: 0 },
    { phaseId: 7, title: "Phase 7: Net Payroll Boardroom", description: "Audit the complete Net Pay ledger unscaffolded.", status: "NOT_ATTEMPTED", bestScore: 0, module: "M4_TRIBUNAL", phaseIndex: 1, hasReAudited: false, reAuditCompleted: false, reAuditScore: 0 }
  ];

  const fetchProgress = async (studentNum: string, currentRoomCode?: string) => {
    try {
      const codeParam = currentRoomCode ? `&roomCode=${encodeURIComponent(currentRoomCode)}` : '';
      const res = await authFetch(`/api/progress/status?studentNumber=${encodeURIComponent(studentNum)}${codeParam}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setProgressList(data);
        }
      }
    } catch (err) {
      console.error("Failed to load progress roadmap", err);
    } finally {
      setLoadingProgress(false);
    }
  };

  useEffect(() => {
    if (propStudent) {
      setStudent(propStudent);
    }
  }, [propStudent]);

  useEffect(() => {
    let currentStudentNum = '';
    const savedStudent = localStorage.getItem('student');
    if (savedStudent) {
      try {
        const parsed = JSON.parse(savedStudent);
        setStudent(parsed);
        currentStudentNum = parsed.studentNumber;
      } catch (_) {}
    } else if (propStudent) {
      setStudent(propStudent);
      currentStudentNum = propStudent.studentNumber;
    }

    if (roomCode) {
      // Sync section directly from room status to ensure it always matches teacher's room
      authFetch(`/api/rooms/${roomCode}/status`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.section) {
            setStudent(prev => {
              const updated = { ...prev, section: data.section };
              localStorage.setItem('student', JSON.stringify(updated));
              return updated;
            });
          }
        })
        .catch(() => {});
    }

    if (currentStudentNum) {
      fetchProgress(currentStudentNum, roomCode);
    } else {
      setLoadingProgress(false);
    }
  }, [roomCode, propStudent]);

  const handleLogout = () => {
    // Kick off server-side token invalidation BEFORE removing local auth keys,
    // so the request still carries the Bearer token.
    void logout();
    // Wipe per-phase timers and autosaved progress so the next student who
    // logs in on this device doesn't inherit this student's state.
    clearAllPhaseStorage();
    localStorage.removeItem('student');
    localStorage.removeItem('studentRoomCode');
    window.location.reload();
  };

  const handleJoinRoom = async () => {
    if (!joinRoomCode.trim()) {
      setJoinError('Please enter a room code.');
      return;
    }
    setJoinLoading(true);
    setJoinError('');

    try {
      const joinRes = await authFetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: joinRoomCode.trim().toUpperCase(),
          studentNumber: student.studentNumber,
          fullName: student.fullName,
          section: student.section
        })
      });

      if (!joinRes.ok) {
        const errData = await joinRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to join room.');
      }

      const joinData = await joinRes.json();
      if (joinData.success) {
        setShowJoinModal(false);
        setJoinRoomCode('');

        // Reflect section from teacher's room onto student.
        // The join response serializes the raw profile (sessionToken key),
        // so always carry the login token forward from the current session.
        const updatedStudent = joinData.student ? {
          ...joinData.student,
          section: joinData.section || joinData.student.section,
          token: student.token || joinData.student.token
        } : {
          ...student,
          section: joinData.section || student.section
        };

        setStudent(updatedStudent);
        localStorage.setItem('student', JSON.stringify(updatedStudent));

        const targetCode = joinRoomCode.trim().toUpperCase();
        fetchProgress(updatedStudent.studentNumber, targetCode);
        onStudentJoinRoom(targetCode, updatedStudent, !!joinData.progressReset);
      } else {
        throw new Error(joinData.error || 'Could not join the room.');
      }
    } catch (err) {
      console.error('[Dashboard] Join room error:', err);
      setJoinError(err.message || 'Server connection error.');
    } finally {
      setJoinLoading(false);
    }
  };

  // Raw progression tracking list from backend
  const rawRoadmap = progressList.length > 0 ? progressList : defaultRoadmap;
  
  // Calculate completed phases (purely informational)
  const completedCount = rawRoadmap.filter(p => p.status === 'COMPLETED').length;
  const completionPercent = Math.round((completedCount / 7.0) * 100);

  // Calculate re-audit completion progress
  const reAuditCount = rawRoadmap.filter(p => p.reAuditCompleted).length;
  const reAuditPercent = Math.round((reAuditCount / 7.0) * 100);
  const hasAnyReAudit = rawRoadmap.some(p => p.hasReAudited || p.reAuditCompleted);

  // Scenario Lock Override: Set all un-attempted phases to ACTIVE for practice accessibility
  const activeRoadmap = rawRoadmap.map(p => {
    if (p.status === 'LOCKED' || p.status === 'NOT_ATTEMPTED') {
      return { ...p, status: 'ACTIVE' };
    }
    return p;
  });

  const handleCardClick = (phase) => {
    const originalProgress = rawRoadmap.find(r => r.phaseId === phase.phaseId);
    if (originalProgress && originalProgress.status === 'COMPLETED') {
      setSelectedPhaseSummary(originalProgress);
    } else {
      setPhaseGuideTarget(phase.phaseId);
    }
  };

  return (
    <div className="auth-container" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div className="glow-overlay"></div>
      <div className="scanlines"></div>

      <div className="dashboard-card">
        <div className="terminal-header">
          <span className="dot red"></span>
          <span className="dot yellow"></span>
          <span className="dot green"></span>
          <span className="terminal-title">No Zero Days: Payroll Simulator</span>

          {toggleTheme && (
            <div 
              id="dashboard-theme-toggle"
              className="theme-mode-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleTheme(); }}
              style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '0.8rem' }}
            >
              <span className="theme-toggle-label">
                {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </span>
              <div className={`theme-toggle-switch ${theme === 'light' ? 'toggle-active' : ''}`} style={{ width: '36px', height: '18px' }}>
                <div 
                  className="theme-toggle-slider" 
                  style={{ 
                    width: '12px', 
                    height: '12px', 
                    top: '2px', 
                    left: '2px',
                    transform: theme === 'light' ? 'translateX(18px)' : 'none'
                  }} 
                />
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-body">
          <div className="logo-section" style={{ marginBottom: 'clamp(0.75rem, 1.5vh, 1.25rem)' }}>
            <h1 className="title-glow" style={{ fontSize: 'clamp(1.25rem, 2.5vw, 2rem)', lineHeight: 1.2 }}>No Zero Days: Payroll Simulator</h1>
            <p className="subtitle" style={{ fontSize: 'clamp(0.8rem, 1vw, 0.9rem)', margin: '4px 0 0' }}>Payroll Audit &amp; Accounting Roadmap</p>
          </div>

          <div className="student-info-bar">
            <div className="info-item">
              <span>STUDENT:</span> <strong>{student.fullName}</strong>
            </div>
            <div className="info-item">
              <span>SECTION:</span> <strong>{student.section && student.section !== 'Unassigned' && student.section !== 'GRADE12-ABM' ? student.section : (roomCode ? 'Connecting...' : 'Unassigned (Join Room)')}</strong>
            </div>
            <div className="info-item">
              <span>ID:</span> <strong>{student.studentNumber}</strong>
            </div>
            
            <div className="dashboard-action-btns" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {roomCode ? (
                <div style={{ padding: '5px 15px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#facc15', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  ROOM: {roomCode}
                </div>
              ) : (
                <button className="join-room-btn" onClick={() => { setJoinConfirming(false); setJoinError(''); setShowJoinModal(true); }} style={{ fontSize: '0.8rem', padding: '5px 15px', backgroundColor: '#10b981', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>[ JOIN ROOM ]</button>
              )}
              <button
                type="button"
                className="leaderboard-trigger-btn"
                onClick={() => setShowLeaderboard(true)}
                title="View Re-Audit Speed Rankings (Top 10 Extra Points)"
                style={{
                  fontSize: '0.8rem',
                  padding: '5px 15px',
                  backgroundColor: '#f59e0b',
                  color: '#000',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 0 10px rgba(245, 158, 11, 0.35)'
                }}
              >
                <span>🏆</span> [ RANKINGS ]
              </button>
              <button
                className="logout-btn"
                onClick={() => setIsGuideOpen(true)}
                style={{
                  fontSize: '0.8rem',
                  padding: '5px 15px',
                  borderColor: '#60a5fa',
                  color: '#60a5fa'
                }}
                title="View the How-to-Play guide"
              >
                [ ? GUIDE ]
              </button>
              <button className="logout-btn" onClick={handleLogout} style={{ fontSize: '0.8rem', padding: '5px 15px' }}>[ LOGOUT ]</button>
            </div>
          </div>

          {/* Progress Bar Container: Overall Auditing Progress & Re-Audit Progress */}
          <div className="progress-bar-container" style={{ marginBottom: 'clamp(1rem, 2vh, 1.5rem)', background: 'rgba(30, 41, 59, 0.4)', padding: 'clamp(0.6rem, 1.2vw, 1rem) clamp(0.75rem, 1.5vw, 1.25rem)', borderRadius: '8px', border: '1px solid #334155' }}>
            {/* Primary: Overall Auditing Roadmap Completion */}
            <div className="dashboard-progress-stats" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: 'clamp(0.75rem, 1vw, 0.85rem)', letterSpacing: '1px' }}>
              <span style={{ color: '#60a5fa' }}>OVERALL AUDITING ROADMAP COMPLETION:</span>
              <strong style={{ color: '#38bdf8' }}>{completionPercent}% COMPLETE ({completedCount} / 7 PHASES)</strong>
            </div>
            <div className="progress-bar-track" style={{ width: '100%', height: '12px', background: '#0b1120', borderRadius: '6px', overflow: 'hidden', border: '1px solid #334155', marginBottom: '14px' }}>
              <div style={{ width: `${completionPercent}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7, #38bdf8)', transition: 'width 0.5s ease-in-out' }}></div>
            </div>

            {/* Secondary: Re-Audit Practice & Mastery Progress */}
            <div className="dashboard-progress-stats reaudit-progress-stats" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: 'clamp(0.75rem, 1vw, 0.85rem)', letterSpacing: '1px' }}>
              <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.95rem' }}>↻</span> RE-AUDIT PRACTICE &amp; MASTERY PROGRESS:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <strong style={{ color: '#10b981' }}>{reAuditPercent}% MASTERED ({reAuditCount} / 7 PHASES)</strong>
                <button
                  type="button"
                  onClick={() => setShowLeaderboard(true)}
                  style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid #f59e0b',
                    color: '#fbbf24',
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="View Re-Audit Speed Rankings"
                >
                  <span>🏆</span> RANKINGS
                </button>
              </div>
            </div>
            <div className="progress-bar-track" style={{ width: '100%', height: '12px', background: '#0b1120', borderRadius: '6px', overflow: 'hidden', border: '1px solid #334155' }}>
              <div style={{ width: `${reAuditPercent}%`, height: '100%', background: 'linear-gradient(90deg, #059669, #10b981, #34d399)', transition: 'width 0.5s ease-in-out' }}></div>
            </div>
          </div>

          {loadingProgress ? (
            <div style={{ textAlign: 'center', color: '#60a5fa', padding: '40px', fontFamily: 'monospace' }}>
              🚀 LOADING SIMULATOR ROADMAP FROM LEDGER DATABASE...
            </div>
          ) : (
            <div className="dashboard-grid">
              {activeRoadmap.map((p) => {
                const originalProgress = rawRoadmap.find(r => r.phaseId === p.phaseId);
                const isCompleted = originalProgress && originalProgress.status === 'COMPLETED';
                
                let cardClass = "module-card";
                if (isCompleted) {
                  cardClass += " completed";
                } else {
                  cardClass += " active"; // All other phases are active and fully available!
                }

                return (
                  <div 
                    key={p.phaseId} 
                    className={cardClass}
                    onClick={() => handleCardClick(p)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px dashed #334155', paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: isCompleted ? '#10b981' : '#fbbf24', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {isCompleted ? '✓ COMPLETED' : '▶ AVAILABLE'}
                          </span>
                          {originalProgress?.reAuditCompleted && (
                            <span style={{
                              background: 'rgba(16, 185, 129, 0.2)',
                              border: '1px solid #10b981',
                              color: '#34d399',
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              letterSpacing: '0.5px'
                            }}>
                              ↻ RE-AUDITED
                            </span>
                          )}
                        </div>
                        <span style={{ color: isCompleted ? '#10b981' : '#fbbf24', fontWeight: 'bold' }}>
                          {(p.completionPercentage !== undefined ? p.completionPercentage : (isCompleted ? 100 : 0))}%
                        </span>
                      </div>
                      <h3 className="card-title" style={{ fontSize: '1.05rem', color: '#fff', border: 'none', padding: 0, margin: '5px 0' }}>
                        {p.title}
                      </h3>
                      <p className="module-desc" style={{ fontSize: '0.8rem', minHeight: '60px', margin: '8px 0 12px 0' }}>
                        {p.description}
                      </p>
                    </div>

                    <div className="module-footer" style={{ marginTop: 'auto' }}>
                      {isCompleted ? (
                        <button 
                          className="enter-btn" 
                          style={{ width: '100%', backgroundColor: '#10b981', color: '#000' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const originalProgress = rawRoadmap.find(r => r.phaseId === p.phaseId) || p;
                            setSelectedPhaseSummary(originalProgress);
                          }}
                        >
                          RE-AUDIT [✓]
                        </button>
                      ) : (
                        <button 
                          className="enter-btn animate-pulse" 
                          style={{ width: '100%', backgroundColor: '#fbbf24', color: '#000' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhaseGuideTarget(p.phaseId);
                          }}
                        >
                          START AUDIT &gt;
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Audit Report Card Modal */}
      {selectedPhaseSummary && (
        <div className="popup-overlay" style={{ zIndex: 9999 }} onClick={() => setSelectedPhaseSummary(null)}>
          <div 
            className="popup-card report-card-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ borderTop: '4px solid #10b981', padding: '24px', maxWidth: '460px', width: '92%' }}
          >
            <button className="close-btn" onClick={() => setSelectedPhaseSummary(null)}>X</button>
            <div className="popup-header" style={{ marginBottom: '15px', borderBottom: '1px dashed #334155', paddingBottom: '10px' }}>
              <h4 style={{ color: '#10b981', margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🏆</span> PHASE AUDIT REPORT CARD
              </h4>
              <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>{selectedPhaseSummary.title}</p>
            </div>
            
            <div className="data-box authentic-data" style={{ padding: '15px', marginBottom: '15px', background: '#0b1120', border: '1px solid #1e293b', borderRadius: '6px' }}>
              <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#60a5fa' }}>Audited Phase:</span> <strong>Phase {selectedPhaseSummary.phaseId}</strong>
              </div>
              <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#60a5fa' }}>Status:</span> <strong style={{ color: '#10b981' }}>COMPLETED ✓</strong>
              </div>
              <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#60a5fa' }}>Tries Committed:</span>
                <strong style={{ color: '#f1f5f9' }}>
                  {selectedPhaseSummary.attemptsCount !== undefined && selectedPhaseSummary.attemptsCount > 0
                    ? `${selectedPhaseSummary.attemptsCount} ${selectedPhaseSummary.attemptsCount === 1 ? 'try' : 'tries'}`
                    : (selectedPhaseSummary.failedAttempts !== undefined ? `${(selectedPhaseSummary.failedAttempts || 0) + 1} tries` : '1 try')}
                </strong>
              </div>
              <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: selectedPhaseSummary.hasReAudited ? '8px' : '0' }}>
                <span style={{ color: '#60a5fa' }}>Best Audit Score:</span>
                <strong className="highlight-green" style={{ fontSize: '1.3rem', color: '#10b981' }}>
                  {selectedPhaseSummary.bestScore || 100}%
                </strong>
              </div>
              {selectedPhaseSummary.hasReAudited && (
                <>
                  <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderTop: '1px dashed #334155', paddingTop: '8px' }}>
                    <span style={{ color: '#34d399' }}>Re-Audit Practice:</span>
                    <strong style={{ color: selectedPhaseSummary.reAuditCompleted ? '#10b981' : '#fbbf24' }}>
                      {selectedPhaseSummary.reAuditCompleted ? 'MASTERED ✓' : 'IN PROGRESS'}
                    </strong>
                  </div>
                  {selectedPhaseSummary.reAuditCompleted && selectedPhaseSummary.reAuditScore !== undefined && selectedPhaseSummary.reAuditScore > 0 && (
                    <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: '#34d399' }}>Re-Audit Score:</span>
                      <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>
                        {selectedPhaseSummary.reAuditScore}%
                      </strong>
                    </div>
                  )}
                  {selectedPhaseSummary.reAuditAttemptsCount !== undefined && selectedPhaseSummary.reAuditAttemptsCount > 0 && (
                    <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#34d399' }}>Re-Audit Tries:</span>
                      <strong style={{ color: '#f1f5f9' }}>
                        {selectedPhaseSummary.reAuditAttemptsCount} {selectedPhaseSummary.reAuditAttemptsCount === 1 ? 'try' : 'tries'}
                      </strong>
                    </div>
                  )}
                </>
              )}
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '15px', fontStyle: 'italic', borderTop: '1px dashed #1e293b', paddingTop: '10px', margin: '15px 0 0 0' }}>
                * Audit score starts at 100% with a 10% deduction per incorrect calculation attempt (minimum 50%). Practice leads to zero errors!
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="escalate-btn" 
                onClick={() => setSelectedPhaseSummary(null)} 
                style={{ flex: 1, margin: 0, padding: '12px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', borderRadius: '4px', fontFamily: 'monospace' }}
              >
                [ ROADMAP ]
              </button>
              <button 
                className="run-btn" 
                onClick={() => {
                  const targetPhase = selectedPhaseSummary.phaseId;
                  setSelectedPhaseSummary(null);
                  setPhaseGuideTarget(targetPhase);
                }} 
                style={{ flex: 1, margin: 0, padding: '12px', backgroundColor: '#10b981', border: 'none', color: '#000', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold', fontFamily: 'monospace' }}
              >
                RE-AUDIT &gt;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRE-AUDIT PHASE GUIDE MODAL */}
      {phaseGuideTarget && PHASE_GUIDES[phaseGuideTarget] && (() => {
        const guide = PHASE_GUIDES[phaseGuideTarget];
        return (
          <div className="popup-overlay" style={{ zIndex: 9999 }} onClick={() => setPhaseGuideTarget(null)}>
            <div 
              className="popup-card phase-guide-card" 
              onClick={(e) => e.stopPropagation()}
              style={{ 
                maxWidth: '680px', 
                width: '94%', 
                maxHeight: '90vh', 
                overflowY: 'auto',
                padding: '24px',
                borderTop: '4px solid #f59e0b',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
              }}
            >
              <button className="close-btn" onClick={() => setPhaseGuideTarget(null)}>X</button>
              
              <div className="popup-header" style={{ marginBottom: '16px', borderBottom: '1px dashed #334155', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ color: '#f59e0b', margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📖</span> AUDITOR'S FIELD GUIDE
                  </h4>
                </div>
                <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                  {`${guide.title} — Target: ${guide.roomName}`}
                </p>
              </div>

              {/* Section 1: Variables to find */}
              <div className="data-box authentic-data" style={{ padding: '14px', marginBottom: '14px', background: '#0b1120', border: '1px solid #1e293b', borderRadius: '6px' }}>
                <div style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔍</span> WHAT VARIABLES TO LOCATE IN ROOM:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {guide.variablesToFind.map((v, i) => (
                    <div key={i} style={{ borderLeft: '3px solid #3b82f6', paddingLeft: '10px' }}>
                      <div style={{ color: '#f1f5f9', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        {i + 1}. {v.name}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
                        📍 <em>Location:</em> {v.location}
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.78rem', marginTop: '2px' }}>
                        ℹ️ {v.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Core Equation */}
              <div className="data-box authentic-data" style={{ padding: '14px', marginBottom: '14px', background: '#0b1120', border: '1px solid #1e293b', borderRadius: '6px' }}>
                <div style={{ fontWeight: 'bold', color: '#facc15', marginBottom: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📐</span> CORE CALCULATION FORMULA:
                </div>
                <div style={{ 
                  background: 'rgba(250, 204, 21, 0.08)', 
                  border: '1px solid rgba(250, 204, 21, 0.3)', 
                  padding: '10px 14px', 
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  color: '#fef08a',
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  wordBreak: 'break-word'
                }}>
                  {guide.formula}
                </div>
              </div>

              {/* Section 3: Walkthrough Example */}
              <div className="data-box authentic-data" style={{ padding: '14px', marginBottom: '14px', background: '#0b1120', border: '1px solid #1e293b', borderRadius: '6px' }}>
                <div style={{ fontWeight: 'bold', color: '#34d399', marginBottom: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>💡</span> {guide.walkthrough.title.toUpperCase()}:
                </div>
                
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '4px' }}>
                  <strong>Example Scenario:</strong> {guide.walkthrough.given}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: '#e2e8f0', margin: '8px 0' }}>
                  {guide.walkthrough.steps.map((step, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: '#34d399', fontWeight: 'bold' }}>•</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                <div style={{ 
                  marginTop: '10px',
                  padding: '8px 12px', 
                  background: 'rgba(16, 185, 129, 0.12)', 
                  border: '1px solid #10b981', 
                  borderRadius: '4px',
                  color: '#34d399',
                  fontWeight: 'bold',
                  fontSize: '0.88rem'
                }}>
                  ➔ {guide.walkthrough.result}
                </div>
              </div>

              {/* Section 4: Pro-Tip */}
              <div style={{ 
                padding: '10px 14px', 
                background: 'rgba(245, 158, 11, 0.08)', 
                border: '1px solid rgba(245, 158, 11, 0.3)', 
                borderRadius: '6px',
                color: '#fbbf24',
                fontSize: '0.8rem',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠️</span>
                <span><strong>Pro-Tip:</strong> {guide.walkthrough.tip}</span>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button 
                  className="run-btn"
                  onClick={() => {
                    const targetId = guide.phaseId;
                    setPhaseGuideTarget(null);
                    onSelectPhase(targetId);
                  }}
                  style={{ 
                    flex: 2, 
                    margin: 0, 
                    padding: '14px', 
                    backgroundColor: '#10b981', 
                    border: 'none', 
                    color: '#000', 
                    cursor: 'pointer', 
                    borderRadius: '4px', 
                    fontWeight: 'bold', 
                    fontFamily: 'monospace',
                    fontSize: '0.95rem'
                  }}
                >
                  START AUDIT &gt;
                </button>
                <button 
                  className="escalate-btn" 
                  onClick={() => setPhaseGuideTarget(null)} 
                  style={{ 
                    flex: 1, 
                    margin: 0, 
                    padding: '14px', 
                    background: '#1e293b', 
                    border: '1px solid #334155', 
                    color: '#94a3b8', 
                    cursor: 'pointer', 
                    borderRadius: '4px', 
                    fontFamily: 'monospace' 
                  }}
                >
                  [ CANCEL ]
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* JOIN ROOM MODAL */}
      {showJoinModal && (
        <div className="join-modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="join-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="terminal-header">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
              <span className="terminal-title">JOIN_ROOM.EXE</span>
            </div>
            <div className="join-modal-body">
              {joinConfirming ? (
                <>
                  <h3 className="join-modal-title">⚠️ NOTICE: FIRST ATTEMPT RESET</h3>
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid #ef4444',
                    borderRadius: '6px',
                    padding: '14px',
                    marginBottom: '15px',
                    color: '#fca5a5',
                    fontSize: '0.88rem',
                    lineHeight: '1.5'
                  }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 'bold', color: '#f87171', fontSize: '0.92rem' }}>
                      Notice: Joining this room will reset your First Attempt progress to ensure accurate timer tracking.
                    </p>
                    <p style={{ margin: 0, color: '#fca5a5' }}>
                      All previous attempts and recorded times for room <strong>{joinRoomCode}</strong> will be wiped. Once inside, your teacher will track your performance starting fresh from Phase 1 with accurate timer tracking.
                    </p>
                    <p style={{ margin: '8px 0 0', fontWeight: 'bold', color: '#fef08a' }}>
                      Do you wish to proceed?
                    </p>
                  </div>
                  {joinError && <div className="error-banner" style={{ marginBottom: '15px' }}>{joinError}</div>}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button
                      className="join-modal-cancel"
                      onClick={() => {
                        setJoinConfirming(false);
                        setJoinError('');
                      }}
                      disabled={joinLoading}
                    >
                      CANCEL
                    </button>
                    <button
                      className="join-modal-confirm"
                      onClick={handleJoinRoom}
                      disabled={joinLoading}
                      style={{ background: '#dc2626', borderColor: '#ef4444' }}
                    >
                      {joinLoading ? 'JOINING...' : 'PROCEED & RESET >'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="join-modal-title">🔗 JOIN A CLASSROOM ROOM</h3>
                  <p className="join-modal-subtitle">
                    Enter the room code provided by your O&amp;M Teacher to join their session.
                  </p>

                  {joinError && <div className="error-banner" style={{ marginBottom: '15px' }}>{joinError}</div>}

                  <div className="input-group">
                    <label>ROOM CODE</label>
                    <input
                      type="text"
                      placeholder="e.g., NZD4X9"
                      value={joinRoomCode}
                      onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                      disabled={joinLoading}
                      className="retro-input room-code-input"
                      maxLength={10}
                      autoFocus
                      style={{ 
                        textAlign: 'center', 
                        fontSize: '1.5rem', 
                        letterSpacing: '5px',
                        textTransform: 'uppercase'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button
                      className="join-modal-cancel"
                      onClick={() => setShowJoinModal(false)}
                      disabled={joinLoading}
                    >
                      CANCEL
                    </button>
                    <button
                      className="join-modal-confirm"
                      onClick={() => {
                        if (!joinRoomCode.trim()) return;
                        setJoinError('');
                        setJoinConfirming(true);
                      }}
                      disabled={joinLoading || !joinRoomCode.trim()}
                    >
                      JOIN &gt;
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RE-AUDIT SPEED LEADERBOARD MODAL */}
      <ReAuditLeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        initialRoomCode={roomCode || (student as any)?.roomCode || localStorage.getItem('studentRoomCode') || ''}
        currentStudentNumber={(student as any)?.studentNumber || ''}
      />

      {/* ONBOARDING GUIDE MODAL */}
      <OnboardingGuide
        isOpen={isGuideOpen}
        onClose={() => {
          localStorage.setItem('hasSeenTutorial', 'true');
          setIsGuideOpen(false);
        }}
      />
    </div>
  );
}
