import React, { useState, useEffect, useRef, useMemo } from 'react';
import API_BASE_URL from '../config';
import './TeacherLobby.css';
import './TeacherDashboard.css';

interface PhaseDetail {
  phaseId: number;
  title: string;
  module: string;
  phaseIndex: number;
  status: 'COMPLETED' | 'ACTIVE' | 'LOCKED';
  attempts: number;
  failedAttempts: number;
  bestScore: number;
  timeSpentSeconds: number;
  timeSpentFormatted: string;
}

interface StudentProgress {
  studentNumber: string;
  fullName: string;
  section: string;
  completedPhases: number;
  currentPhase: number;
  currentPhaseTitle: string;
  attempts: number;
  status: string;
  totalTimeSpentSeconds: number;
  totalTimeFormatted: string;
  phases: PhaseDetail[];
}

interface PhaseSummaryStat {
  phaseId: number;
  title: string;
  completedCount: number;
  activeCount: number;
  totalAttempts: number;
  avgAttempts: number;
  avgTimeSeconds: number;
  avgTimeFormatted: string;
}

interface DashboardSummary {
  totalStudents: number;
  completedStudents: number;
  activeStudents: number;
  totalAttempts: number;
  phaseStats: PhaseSummaryStat[];
}

interface TeacherDashboardProps {
  roomCode: string;
  teacherName: string;
  onBack: () => void;
  onExit?: () => void;
}

export default function TeacherDashboard({ roomCode, teacherName, onBack, onExit }: TeacherDashboardProps) {
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [roomSection, setRoomSection] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [sendingEmailReport, setSendingEmailReport] = useState(false);
  const [emailReportToast, setEmailReportToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // UI state
  const [activeChartTab, setActiveChartTab] = useState<'funnel' | 'time' | 'attempts' | 'status'>('funnel');
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  // Add student modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStudentId, setAddStudentId] = useState('');
  const [addStudentName, setAddStudentName] = useState('');
  const [addStudentSection, setAddStudentSection] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addError, setAddError] = useState('');

  // Delete student modal
  const [studentToDelete, setStudentToDelete] = useState<{ number: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
        setSummary(data.summary || null);
        if (data.section) setRoomSection(data.section);
        if (data.teacherEmail) setTeacherEmail(data.teacherEmail);
        setError('');
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to load dashboard.');
      }
    } catch (err: any) {
      console.error('[TeacherDashboard] Fetch error:', err);
      setError('Connection error. Server unreachable.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReportEmail = async () => {
    if (!roomCode) return;
    const targetEmail = (teacherEmail || '').trim();
    if (!targetEmail) {
      const emailInput = prompt('Enter teacher email to receive classroom report:');
      if (!emailInput || !emailInput.trim()) return;
      setTeacherEmail(emailInput.trim());
      sendDashboardEmailTo(emailInput.trim());
      return;
    }
    sendDashboardEmailTo(targetEmail);
  };

  const sendDashboardEmailTo = async (email: string) => {
    setSendingEmailReport(true);
    setEmailReportToast('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/send-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherEmail: email })
      });
      const data = await res.json();
      if (res.ok) {
        setEmailReportToast(`✓ Classroom report sent to ${email}!`);
        setTimeout(() => setEmailReportToast(''), 5000);
      } else {
        setEmailReportToast(`✕ ${data.error || 'Failed to send report.'}`);
        setTimeout(() => setEmailReportToast(''), 6000);
      }
    } catch (err: any) {
      setEmailReportToast(`✕ Error sending email: ${err.message}`);
      setTimeout(() => setEmailReportToast(''), 6000);
    } finally {
      setSendingEmailReport(false);
    }
  };

  useEffect(() => {
    if (roomCode) {
      fetchDashboardStats();
      pollIntervalRef.current = setInterval(fetchDashboardStats, 5000);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Add student handler
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStudentId.trim() || !addStudentName.trim()) {
      setAddError('Student number and full name are required.');
      return;
    }
    setIsAddingStudent(true);
    setAddError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentNumber: addStudentId.trim(),
          fullName: addStudentName.trim(),
          section: addStudentSection.trim() || roomSection
        })
      });
      if (res.ok) {
        setAddStudentId('');
        setAddStudentName('');
        setAddStudentSection('');
        setShowAddModal(false);
        fetchDashboardStats();
      } else {
        const data = await res.json().catch(() => ({}));
        setAddError(data.error || 'Failed to add student.');
      }
    } catch (err: any) {
      setAddError(err.message || 'Connection error.');
    } finally {
      setIsAddingStudent(false);
    }
  };

  // Delete student handler
  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/students/${studentToDelete.number}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setStudentToDelete(null);
        fetchDashboardStats();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete student.');
      }
    } catch (err: any) {
      alert('Delete error: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch =
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        filterStatus === 'ALL' ? true : s.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [students, searchQuery, filterStatus]);

  // Total class completion percent
  const totalCompletionPercent = useMemo(() => {
    if (students.length === 0) return 0;
    const totalPhasesPossible = students.length * 7;
    const completedPhasesSum = students.reduce((sum, s) => sum + s.completedPhases, 0);
    return Math.round((completedPhasesSum / totalPhasesPossible) * 100);
  }, [students]);

  // ---------------------------------------------------------------------------
  // SVG CHARTS RENDERERS
  // ---------------------------------------------------------------------------

  const renderFunnelChart = () => {
    const phaseStats = summary?.phaseStats || [];
    const total = summary?.totalStudents || students.length || 1;

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: '600px' }}>
          {phaseStats.map((p, idx) => {
            const percent = Math.round((p.completedCount / total) * 100);
            const activePercent = Math.round((p.activeCount / total) * 100);

            return (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 140px', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.title}
                </div>
                <div style={{ height: '24px', background: '#0b1120', borderRadius: '4px', overflow: 'hidden', display: 'flex', border: '1px solid #1e293b' }}>
                  {/* Completed bar */}
                  <div
                    style={{
                      width: `${percent}%`,
                      background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                      height: '100%',
                      transition: 'width 0.5s ease',
                      boxShadow: percent > 0 ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none'
                    }}
                    title={`Completed: ${p.completedCount} students (${percent}%)`}
                  />
                  {/* Active bar */}
                  <div
                    style={{
                      width: `${activePercent}%`,
                      background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                      height: '100%',
                      transition: 'width 0.5s ease'
                    }}
                    title={`Currently Active: ${p.activeCount} students`}
                  />
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <strong style={{ color: '#10b981' }}>{p.completedCount}</strong>/{total} passed{' '}
                  <span style={{ color: '#60a5fa' }}>({percent}%)</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginTop: '16px', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px', display: 'inline-block' }}></span>
            <span style={{ color: '#94a3b8' }}>Completed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '2px', display: 'inline-block' }}></span>
            <span style={{ color: '#94a3b8' }}>Currently Active</span>
          </div>
        </div>
      </div>
    );
  };

  const renderTimeChart = () => {
    const phaseStats = summary?.phaseStats || [];
    const maxTime = Math.max(...phaseStats.map(p => p.avgTimeSeconds), 60);

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 0, marginBottom: '20px' }}>
          Average duration students took to successfully conquer each phase. Highlights key learning bottlenecks.
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '220px', paddingBottom: '30px', borderBottom: '1px solid #334155', minWidth: '650px' }}>
          {phaseStats.map((p, idx) => {
            const barHeight = Math.max(Math.round((p.avgTimeSeconds / maxTime) * 160), 8);
            const isHighest = p.avgTimeSeconds === maxTime && maxTime > 0;

            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.75rem', color: isHighest ? '#fbbf24' : '#38bdf8', fontWeight: 'bold', marginBottom: '6px' }}>
                  {p.avgTimeFormatted !== '--' ? p.avgTimeFormatted : '0s'}
                </span>
                <div
                  style={{
                    width: '75%',
                    height: `${barHeight}px`,
                    background: isHighest
                      ? 'linear-gradient(180deg, #f59e0b, #b45309)'
                      : 'linear-gradient(180deg, #0ea5e9, #1e3a8a)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.4s ease',
                    boxShadow: isHighest ? '0 0 15px rgba(245, 158, 11, 0.4)' : 'none'
                  }}
                  title={`${p.title}: Avg ${p.avgTimeFormatted}`}
                />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
                  P{p.phaseId}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.75rem', color: '#64748b' }}>
          <span>P1: Gross Pay</span>
          <span>P2: Tardiness</span>
          <span>P3: Overtime</span>
          <span>P4: Holiday Pay</span>
          <span>P5: SSS Share</span>
          <span>P6: PhilHealth</span>
          <span>P7: Final Tribunal</span>
        </div>
      </div>
    );
  };

  const renderAttemptsChart = () => {
    const phaseStats = summary?.phaseStats || [];
    const maxAttempts = Math.max(...phaseStats.map(p => p.avgAttempts), 5);

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 0, marginBottom: '20px' }}>
          Average calculation attempts submitted per phase. Spikes reflect where Infinite Drills or mistakes occurred.
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '220px', paddingBottom: '30px', borderBottom: '1px solid #334155', minWidth: '650px' }}>
          {phaseStats.map((p, idx) => {
            const barHeight = Math.max(Math.round((p.avgAttempts / maxAttempts) * 160), 8);
            const isFriction = p.avgAttempts >= 4.0;

            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.8rem', color: isFriction ? '#ef4444' : '#a855f7', fontWeight: 'bold', marginBottom: '6px' }}>
                  {p.avgAttempts.toFixed(1)}x
                </span>
                <div
                  style={{
                    width: '75%',
                    height: `${barHeight}px`,
                    background: isFriction
                      ? 'linear-gradient(180deg, #ef4444, #991b1b)'
                      : 'linear-gradient(180deg, #a855f7, #6b21a8)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.4s ease',
                    boxShadow: isFriction ? '0 0 12px rgba(239, 68, 68, 0.4)' : 'none'
                  }}
                  title={`${p.title}: Avg ${p.avgAttempts} attempts`}
                />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
                  P{p.phaseId}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.75rem', color: '#64748b' }}>
          <span>P1: Gross Pay</span>
          <span>P2: Tardiness</span>
          <span>P3: Overtime</span>
          <span>P4: Holiday Pay</span>
          <span>P5: SSS Share</span>
          <span>P6: PhilHealth</span>
          <span>P7: Final Tribunal</span>
        </div>
      </div>
    );
  };

  const renderStatusDonut = () => {
    const total = students.length || 1;
    const completed = students.filter(s => s.completedPhases === 7).length;
    const inProgress = students.filter(s => s.completedPhases > 0 && s.completedPhases < 7).length;
    const justStarted = students.filter(s => s.completedPhases === 0).length;

    const completedPct = Math.round((completed / total) * 100);
    const inProgressPct = Math.round((inProgress / total) * 100);
    const justStartedPct = Math.round((justStarted / total) * 100);

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', padding: '10px 0' }}>
        <div style={{ position: 'relative', width: '160px', height: '160px' }}>
          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#1e293b" strokeWidth="4" />
            {/* Completed arc */}
            <circle
              cx="18" cy="18" r="15.915" fill="transparent"
              stroke="#10b981" strokeWidth="4"
              strokeDasharray={`${completedPct} ${100 - completedPct}`}
              strokeDashoffset="0"
            />
            {/* In Progress arc */}
            <circle
              cx="18" cy="18" r="15.915" fill="transparent"
              stroke="#3b82f6" strokeWidth="4"
              strokeDasharray={`${inProgressPct} ${100 - inProgressPct}`}
              strokeDashoffset={`${-completedPct}`}
            />
          </svg>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>{students.length}</span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>STUDENTS</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '14px', height: '14px', background: '#10b981', borderRadius: '3px' }}></span>
            <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>Fully Passed (7/7):</span>
            <strong style={{ color: '#10b981' }}>{completed} ({completedPct}%)</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '14px', height: '14px', background: '#3b82f6', borderRadius: '3px' }}></span>
            <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>In Progress (1-6):</span>
            <strong style={{ color: '#60a5fa' }}>{inProgress} ({inProgressPct}%)</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '14px', height: '14px', background: '#1e293b', borderRadius: '3px', border: '1px solid #475569' }}></span>
            <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>At Starting Line:</span>
            <strong style={{ color: '#94a3b8' }}>{justStarted} ({justStartedPct}%)</strong>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <div className="glow-overlay"></div>
      <div className="scanlines"></div>

      <div className="dashboard-wrapper">
        {/* HEADER BAR */}
        <header className="dash-header">
          <div className="dash-title-group">
            <h1>
              <span>⚡ COMMAND NEXUS</span>
              <span className="dash-badge dash-badge-pulse">LIVE MONITOR</span>
            </h1>
            <div className="dash-meta-info">
              <span>
                Room:{' '}
                <span className="room-code-tag" onClick={handleCopyCode} title="Click to copy room code">
                  {roomCode} 📋
                </span>
                {copied && <span style={{ color: '#10b981', marginLeft: '6px', fontSize: '0.8rem' }}>COPIED!</span>}
              </span>
              <span>Supervisor: <strong style={{ color: '#fff' }}>{teacherName}</strong></span>
              <span>Section: <strong style={{ color: '#60a5fa' }}>{roomSection || 'General'}</strong></span>
            </div>
          </div>

          <div className="dash-actions">
            <button
              className="dash-btn dash-btn-outline"
              style={{ color: '#a78bfa', borderColor: '#7c3aed', background: 'rgba(124, 58, 237, 0.12)' }}
              onClick={onBack}
              title="Return to the classroom room lobby"
            >
              <span>⬅</span> ROOM LOBBY
            </button>
            <button
              className="dash-btn dash-btn-primary"
              onClick={() => {
                setAddStudentSection(roomSection);
                setShowAddModal(true);
              }}
            >
              <span>➕</span> ENROLL STUDENT
            </button>
            <button
              className="dash-btn dash-btn-outline"
              style={{ color: '#38bdf8', borderColor: '#0284c7', background: 'rgba(56, 189, 248, 0.1)' }}
              onClick={handleSendReportEmail}
              disabled={sendingEmailReport}
              title={teacherEmail ? `Email classroom report to ${teacherEmail}` : 'Send classroom report to email'}
            >
              <span>✉️</span> {sendingEmailReport ? 'SENDING...' : 'EMAIL REPORT'}
            </button>
            <button className="dash-btn dash-btn-outline" onClick={fetchDashboardStats} title="Refresh Live Data">
              <span>⟳</span> REFRESH
            </button>
            <button
              className="dash-btn dash-btn-danger"
              onClick={onExit || onBack}
              title="Exit room and log out safely back to login screen"
            >
              [ EXIT ROOM ]
            </button>
          </div>
        </header>

        {emailReportToast && (
          <div style={{
            background: emailReportToast.startsWith('✕') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            border: emailReportToast.startsWith('✕') ? '1px solid #ef4444' : '1px solid #22c55e',
            color: emailReportToast.startsWith('✕') ? '#fca5a5' : '#4ade80',
            padding: '10px 18px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {emailReportToast}
          </div>
        )}


        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '12px 18px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* TOP KPI CARDS */}
        <section className="kpi-grid">
          <div className="kpi-card blue">
            <span className="kpi-label">TOTAL STUDENTS</span>
            <div className="kpi-value">{students.length}</div>
            <div className="kpi-subtext">Active room roster</div>
          </div>

          <div className="kpi-card green">
            <span className="kpi-label">PASSED AUDIT</span>
            <div className="kpi-value">
              {summary?.completedStudents ?? students.filter(s => s.completedPhases === 7).length}
            </div>
            <div className="kpi-subtext">Mastered all 7 phases</div>
          </div>

          <div className="kpi-card yellow">
            <span className="kpi-label">IN PROGRESS</span>
            <div className="kpi-value">
              {summary?.activeStudents ?? students.filter(s => s.completedPhases < 7).length}
            </div>
            <div className="kpi-subtext">Actively calculating</div>
          </div>

          <div className="kpi-card purple">
            <span className="kpi-label">CLASS ATTEMPTS</span>
            <div className="kpi-value">
              {summary?.totalAttempts ?? students.reduce((sum, s) => sum + s.attempts, 0)}
            </div>
            <div className="kpi-subtext">Combined submissions</div>
          </div>

          <div className="kpi-card cyan">
            <span className="kpi-label">OVERALL PROGRESS</span>
            <div className="kpi-value">{totalCompletionPercent}%</div>
            <div className="kpi-subtext">Curriculum completion</div>
          </div>
        </section>

        {/* CHARTS SECTION */}
        <section className="chart-section">
          <div className="chart-tabs">
            <button
              className={`chart-tab-btn ${activeChartTab === 'funnel' ? 'active' : ''}`}
              onClick={() => setActiveChartTab('funnel')}
            >
              📊 PHASE PROGRESSION FUNNEL
            </button>
            <button
              className={`chart-tab-btn ${activeChartTab === 'time' ? 'active' : ''}`}
              onClick={() => setActiveChartTab('time')}
            >
              ⏱️ AVG TIME PER PHASE
            </button>
            <button
              className={`chart-tab-btn ${activeChartTab === 'attempts' ? 'active' : ''}`}
              onClick={() => setActiveChartTab('attempts')}
            >
              🎯 ATTEMPTS & FRICTION
            </button>
            <button
              className={`chart-tab-btn ${activeChartTab === 'status' ? 'active' : ''}`}
              onClick={() => setActiveChartTab('status')}
            >
              🍩 COHORT STATUS
            </button>
          </div>

          <div className="chart-canvas-wrapper">
            {activeChartTab === 'funnel' && renderFunnelChart()}
            {activeChartTab === 'time' && renderTimeChart()}
            {activeChartTab === 'attempts' && renderAttemptsChart()}
            {activeChartTab === 'status' && renderStatusDonut()}
          </div>
        </section>

        {/* ROSTER HEADER & CONTROLS */}
        <div className="roster-header">
          <div className="roster-title-group">
            <h2>STUDENT AUDIT ROSTER</h2>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Showing {filteredStudents.length} of {students.length} students
            </span>
          </div>

          <div className="roster-filter-controls">
            <input
              type="text"
              className="roster-search-input"
              placeholder="🔍 Search student or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              style={{
                background: '#0b1120',
                border: '1px solid #334155',
                color: '#cbd5e1',
                padding: '8px 12px',
                borderRadius: '6px',
                fontFamily: 'inherit',
                fontSize: '0.85rem'
              }}
            >
              <option value="ALL">Status: All</option>
              <option value="ACTIVE">Status: Active</option>
              <option value="COMPLETED">Status: Passed</option>
            </select>

            <div className="roster-view-toggle">
              <button
                className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
                title="Cards View"
              >
                🗂️ Cards
              </button>
              <button
                className={`view-btn ${viewMode === 'matrix' ? 'active' : ''}`}
                onClick={() => setViewMode('matrix')}
                title="Matrix Spreadsheet View"
              >
                📋 Matrix
              </button>
            </div>
          </div>
        </div>

        {/* LOADING INDICATOR */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#60a5fa' }}>
            SCANNING AUDIT LOGS & TELEMETRY...
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && filteredStudents.length === 0 && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px dashed #334155',
            borderRadius: '8px',
            padding: '50px 20px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📡</div>
            <p style={{ margin: 0, fontSize: '1.1rem', color: '#94a3b8' }}>No students found in this room.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
              Share room code <strong style={{ color: '#fbbf24' }}>{roomCode}</strong> with your students or click "ENROLL STUDENT" above.
            </p>
          </div>
        )}

        {/* CARDS VIEW */}
        {!loading && viewMode === 'cards' && (
          <div className="student-cards-grid">
            {filteredStudents.map((stu) => {
              const percent = Math.round((stu.completedPhases / 7) * 100);
              const isCompleted = stu.status === 'COMPLETED' || stu.completedPhases >= 7;
              const isExpanded = expandedStudent === stu.studentNumber;

              return (
                <div key={stu.studentNumber} className="student-card">
                  <div className="student-card-top">
                    <div>
                      <h3 className="stu-name">{stu.fullName}</h3>
                      <div className="stu-id-section">
                        <span>{stu.studentNumber}</span> • <span>{stu.section || roomSection}</span>
                      </div>
                    </div>
                    <span className={`badge-status ${isCompleted ? 'badge-passed' : 'badge-active'}`}>
                      {isCompleted ? '✓ PASSED' : '⚡ ACTIVE'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="progress-bar-container">
                    <div className="progress-header">
                      <span style={{ color: '#94a3b8' }}>Phases Completed</span>
                      <strong style={{ color: isCompleted ? '#34d399' : '#60a5fa' }}>
                        {percent}% ({stu.completedPhases} / 7)
                      </strong>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>

                  {/* Quick stats: Total Time & Attempts */}
                  <div className="stu-quick-stats">
                    <div className="stat-item">
                      <span>TOTAL TIME SPENT</span>
                      <strong style={{ color: '#38bdf8' }}>{stu.totalTimeFormatted || '--'}</strong>
                    </div>
                    <div className="stat-item">
                      <span>TOTAL ATTEMPTS</span>
                      <strong style={{ color: stu.attempts === 0 ? '#10b981' : stu.attempts >= 3 ? '#f87171' : '#fbbf24' }}>
                        {stu.attempts} attempt{stu.attempts !== 1 ? 's' : ''}
                      </strong>
                    </div>
                  </div>

                  {/* Current Objective */}
                  <div style={{
                    background: '#0b1120',
                    border: '1px solid #1e293b',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    marginBottom: '14px',
                    fontSize: '0.8rem'
                  }}>
                    <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block', marginBottom: '2px' }}>
                      CURRENT OBJECTIVE
                    </span>
                    <strong style={{ color: isCompleted ? '#10b981' : '#fbbf24' }}>
                      {stu.currentPhaseTitle}
                    </strong>
                  </div>

                  {/* Phase Chips Row (P1 to P7) */}
                  <div className="phases-grid-container">
                    <div className="phases-grid-title">
                      <span>PHASE STATUS & METRICS</span>
                      <span style={{ color: '#60a5fa', cursor: 'pointer' }} onClick={() => setExpandedStudent(isExpanded ? null : stu.studentNumber)}>
                        {isExpanded ? '▲ Hide Breakdown' : '▼ View Breakdown'}
                      </span>
                    </div>

                    <div className="phase-chips-row">
                      {(stu.phases || []).map((p) => (
                        <div
                          key={p.phaseId}
                          className={`phase-chip ${p.status}`}
                          title={`${p.title}: ${p.status} | Attempts: ${p.attempts} | Time: ${p.timeSpentFormatted}`}
                          onClick={() => setExpandedStudent(isExpanded ? null : stu.studentNumber)}
                        >
                          <span className="chip-num">P{p.phaseId}</span>
                          <span className="chip-icon">
                            {p.status === 'COMPLETED' ? '✓' : p.status === 'ACTIVE' ? '⚡' : '🔒'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Detailed Accordion for this student */}
                    {isExpanded && (
                      <div className="phase-details-list">
                        {(stu.phases || []).map((p) => (
                          <div key={p.phaseId} className={`phase-detail-row ${p.status}`}>
                            <div className="p-name">
                              P{p.phaseId}: {p.title.replace(/^Phase \d+: /, '')}
                            </div>
                            <div className="p-metrics">
                              <span className="p-attempts" title="Attempts count">
                                🎯 {p.attempts} att
                              </span>
                              <span className="p-time" title="Time taken in this phase">
                                ⏱️ {p.timeSpentFormatted}
                              </span>
                              <span style={{
                                fontSize: '0.75rem',
                                color: p.status === 'COMPLETED' ? '#10b981' : p.status === 'ACTIVE' ? '#f59e0b' : '#64748b',
                                fontWeight: 'bold'
                              }}>
                                {p.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="student-card-footer">
                    <button
                      className="btn-card-action"
                      style={{ color: '#60a5fa' }}
                      onClick={() => setExpandedStudent(isExpanded ? null : stu.studentNumber)}
                    >
                      {isExpanded ? 'Collapse Details' : 'Full Phase Breakdown'}
                    </button>
                    <button
                      className="btn-card-action btn-delete-student"
                      onClick={() => setStudentToDelete({ number: stu.studentNumber, name: stu.fullName })}
                      title="Remove student from room"
                    >
                      🗑️ REMOVE STUDENT
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MATRIX SPREADSHEET TABLE VIEW */}
        {!loading && viewMode === 'matrix' && (
          <div className="matrix-table-container">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th style={{ width: '220px' }}>STUDENT</th>
                  <th style={{ width: '100px' }}>TOTAL TIME</th>
                  <th style={{ width: '80px' }}>ATTEMPTS</th>
                  <th style={{ width: '90px' }}>PROGRESS</th>
                  <th>P1: GROSS</th>
                  <th>P2: TARDY</th>
                  <th>P3: OT</th>
                  <th>P4: HOLIDAY</th>
                  <th>P5: SSS</th>
                  <th>P6: PHILHEALTH</th>
                  <th>P7: TRIBUNAL</th>
                  <th style={{ textAlign: 'center', width: '80px' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((stu) => {
                  const percent = Math.round((stu.completedPhases / 7) * 100);

                  return (
                    <tr key={stu.studentNumber}>
                      <td>
                        <strong style={{ color: '#f8fafc', display: 'block' }}>{stu.fullName}</strong>
                        <span style={{ color: '#60a5fa', fontSize: '0.75rem' }}>{stu.studentNumber}</span>
                      </td>
                      <td style={{ color: '#38bdf8', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {stu.totalTimeFormatted || '--'}
                      </td>
                      <td style={{ color: stu.attempts > 8 ? '#f87171' : '#cbd5e1' }}>
                        {stu.attempts}
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          background: stu.completedPhases === 7 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: stu.completedPhases === 7 ? '#34d399' : '#60a5fa'
                        }}>
                          {stu.completedPhases}/7 ({percent}%)
                        </span>
                      </td>

                      {/* 7 Phase Columns with Time & Attempts */}
                      {(stu.phases || []).map((p) => (
                        <td key={p.phaseId} className={`matrix-phase-cell ${p.status}`}>
                          {p.status === 'LOCKED' ? (
                            <span style={{ color: '#475569' }}>--</span>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 'bold' }}>
                                {p.status === 'COMPLETED' ? '✓ ' : '⚡ '}
                                {p.timeSpentFormatted}
                              </div>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                {p.attempts} att
                              </span>
                            </div>
                          )}
                        </td>
                      ))}

                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-card-action btn-delete-student"
                          style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          onClick={() => setStudentToDelete({ number: stu.studentNumber, name: stu.fullName })}
                          title="Remove student from room"
                        >
                          ✕ Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>➕ ENROLL STUDENT IN ROOM {roomCode}</h3>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            {addError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '0.85rem',
                marginBottom: '14px'
              }}>
                {addError}
              </div>
            )}

            <form onSubmit={handleAddStudentSubmit}>
              <div className="form-group">
                <label>STUDENT NUMBER / ID *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., 2024-00192"
                  value={addStudentId}
                  onChange={(e) => setAddStudentId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>FULL NAME *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Juan Dela Cruz"
                  value={addStudentName}
                  onChange={(e) => setAddStudentName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>SECTION (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={roomSection || 'e.g., 213'}
                  value={addStudentSection}
                  onChange={(e) => setAddStudentSection(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="dash-btn dash-btn-outline"
                  onClick={() => setShowAddModal(false)}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isAddingStudent}
                  className="dash-btn dash-btn-primary"
                >
                  {isAddingStudent ? 'ENROLLING...' : 'CONFIRM & ENROLL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {studentToDelete && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ borderColor: '#ef4444' }}>
            <div className="modal-header">
              <h3 style={{ color: '#ef4444' }}>⚠️ CONFIRM REMOVAL</h3>
              <button className="modal-close-btn" onClick={() => setStudentToDelete(null)}>✕</button>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Are you sure you want to remove student{' '}
              <strong style={{ color: '#fff' }}>{studentToDelete.name}</strong>{' '}
              (<span style={{ color: '#60a5fa' }}>{studentToDelete.number}</span>) from Room{' '}
              <strong style={{ color: '#fbbf24' }}>{roomCode}</strong>?
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              They will no longer appear in this room session.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="dash-btn dash-btn-outline"
                onClick={() => setStudentToDelete(null)}
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isDeleting}
                className="dash-btn dash-btn-danger"
                onClick={handleConfirmDelete}
              >
                {isDeleting ? 'REMOVING...' : 'YES, REMOVE STUDENT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
