import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { authFetch } from '../utils/api';
import './TeacherLobby.css';
import './TeacherDashboard.css';

interface PhaseStreamDetail {
  status: 'COMPLETED' | 'ACTIVE' | 'LOCKED' | 'NOT_ATTEMPTED';
  attempts: number;
  failedAttempts: number;
  bestScore: number;
  timeSpentSeconds: number;
  timeSpentFormatted: string;
  hasReAudited?: boolean;
}

interface PhaseDetail {
  phaseId: number;
  title: string;
  module: string;
  phaseIndex: number;
  status: 'COMPLETED' | 'ACTIVE' | 'LOCKED' | 'NOT_ATTEMPTED';
  attempts: number;
  failedAttempts: number;
  bestScore: number;
  timeSpentSeconds: number;
  timeSpentFormatted: string;
  firstAttempt?: PhaseStreamDetail;
  reAudit?: PhaseStreamDetail;
}

interface StudentStreamDetail {
  completedPhases: number;
  attempts: number;
  totalTimeSpentSeconds: number;
  totalTimeFormatted: string;
  status: string;
  hasReAudited?: boolean;
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
  firstAttempt?: StudentStreamDetail;
  reAudit?: StudentStreamDetail;
  hasReAudited?: boolean;
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
  firstAttemptPhaseStats?: PhaseSummaryStat[];
  reAuditPhaseStats?: PhaseSummaryStat[];
  firstAttemptCompletedStudents?: number;
  reAuditStudentsCount?: number;
}

interface TeacherDashboardProps {
  roomCode: string;
  teacherName: string;
  teacherEmail?: string;
  section?: string;
  onBack: () => void;
  onExit?: () => void;
  onSwitchRoom?: (newRoomCode: string, newSection?: string) => void;
}

const PHASE_LABELS = [
  'P1: Gross Pay',
  'P2: Tardiness',
  'P3: Overtime',
  'P4: Holiday Pay',
  'P5: SSS Share',
  'P6: PhilHealth',
  'P7: Final Tribunal'
];

export default function TeacherDashboard({
  roomCode: initialRoomCode,
  teacherName,
  teacherEmail: initialTeacherEmail,
  section: initialSection,
  onBack,
  onExit,
  onSwitchRoom
}: TeacherDashboardProps) {
  const [activeRoomCode, setActiveRoomCode] = useState(initialRoomCode || '');
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [roomSection, setRoomSection] = useState(initialSection || '');
  const [teacherEmail, setTeacherEmail] = useState(initialTeacherEmail || '');
  const [teacherRooms, setTeacherRooms] = useState<any[]>([]);
  const [sendingEmailReport, setSendingEmailReport] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [emailReportToast, setEmailReportToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeRoomCodeRef = useRef(activeRoomCode);

  // New section room creation modal
  const [showNewSectionModal, setShowNewSectionModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newCustomCode, setNewCustomCode] = useState('');
  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [createSectionError, setCreateSectionError] = useState('');

  // UI state
  const [activeChartTab, setActiveChartTab] = useState<'funnel' | 'time' | 'attempts' | 'status'>('funnel');
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [auditAttemptMode, setAuditAttemptMode] = useState<'COMPARISON' | 'FIRST_ATTEMPT' | 'RE_AUDIT' | 'ALL'>('COMPARISON');

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
  const [startingRoom, setStartingRoom] = useState(false);

  // Sync if prop roomCode changes
  useEffect(() => {
    if (initialRoomCode && initialRoomCode !== activeRoomCode) {
      setActiveRoomCode(initialRoomCode);
    }
  }, [initialRoomCode]);

  useEffect(() => {
    activeRoomCodeRef.current = activeRoomCode;
  }, [activeRoomCode]);

  // Fetch all rooms created by this teacher
  const fetchTeacherRooms = useCallback(async () => {
    try {
      const res = await authFetch('/api/teachers/rooms');
      if (res.ok) {
        const data = await res.json();
        setTeacherRooms(data);
        if (data.length > 0 && !activeRoomCode) {
          const first = data[0];
          setActiveRoomCode(first.roomCode);
          if (first.section) setRoomSection(first.section);
          onSwitchRoom?.(first.roomCode, first.section);
        }
      }
    } catch (err) {
      console.warn('[TeacherDashboard] Failed to fetch teacher rooms:', err);
    }
  }, [activeRoomCode, onSwitchRoom]);

  // Ensure activeRoomCode is always represented in teacherRooms
  useEffect(() => {
    if (activeRoomCode) {
      setTeacherRooms(prev => {
        if (prev.some(r => r.roomCode === activeRoomCode)) return prev;
        return [{
          roomCode: activeRoomCode,
          section: roomSection || 'Section 1',
          teacherName: teacherName,
          teacherEmail: teacherEmail || initialTeacherEmail || '',
          participantCount: 0,
          status: 'WAITING'
        }, ...prev];
      });
    }
  }, [activeRoomCode, roomSection, teacherName, teacherEmail, initialTeacherEmail]);

  useEffect(() => {
    fetchTeacherRooms();
  }, [fetchTeacherRooms]);

  const fetchDashboardStats = useCallback(async (targetCode = activeRoomCode) => {
    if (!targetCode) return;
    try {
      const res = await authFetch(`/api/rooms/${targetCode}/dashboard`);
      // Drop stale responses: the teacher may have switched rooms while this
      // request was in flight.
      if (targetCode !== activeRoomCodeRef.current) return;
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
  }, [activeRoomCode]);

  // Section Switcher handler
  const handleSelectSection = (targetCode: string, targetSection?: string) => {
    if (!targetCode || targetCode === activeRoomCode) return;
    setActiveRoomCode(targetCode);
    if (targetSection) setRoomSection(targetSection);
    setStudents([]);
    setSummary(null);
    setLoading(true);
    onSwitchRoom?.(targetCode, targetSection);
  };

  // Create New Section Room handler
  const handleCreateSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) {
      setCreateSectionError('Section name is required (e.g., Grade 12 - ABM B).');
      return;
    }
    const emailToUse = (teacherEmail || initialTeacherEmail || '').trim();
    if (emailToUse && !/^[^\s@]+@gmail\.com$/i.test(emailToUse)) {
      setCreateSectionError('Teacher email must be a valid Gmail address ending in @gmail.com.');
      return;
    }

    setIsCreatingSection(true);
    setCreateSectionError('');

    try {
      const payload: Record<string, string> = {
        teacherName: teacherName,
        teacherEmail: emailToUse,
        section: newSectionName.trim()
      };
      if (newCustomCode.trim()) {
        payload.roomCode = newCustomCode.trim().toUpperCase();
      }

      const res = await authFetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const created = await res.json();
        setShowNewSectionModal(false);
        setNewSectionName('');
        setNewCustomCode('');
        setTeacherRooms(prev => {
          const exists = prev.some(r => r.roomCode === created.roomCode);
          if (exists) return prev;
          return [{
            roomCode: created.roomCode,
            section: created.section || newSectionName.trim(),
            teacherName: created.teacherName || teacherName,
            teacherEmail: created.teacherEmail || emailToUse,
            participantCount: 0,
            status: created.status || 'WAITING'
          }, ...prev];
        });
        await fetchTeacherRooms();
        handleSelectSection(created.roomCode, created.section);
      } else {
        const errData = await res.json().catch(() => ({}));
        setCreateSectionError(errData.error || 'Failed to create section room.');
      }
    } catch (err: any) {
      setCreateSectionError(err.message || 'Error creating section.');
    } finally {
      setIsCreatingSection(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCustomCode(code);
  };

  const handleSendReportEmail = async () => {
    if (!activeRoomCode) return;
    let targetEmail = (teacherEmail || initialTeacherEmail || '').trim();
    if (!targetEmail || !/^[^\s@]+@gmail\.com$/i.test(targetEmail)) {
      const emailInput = prompt('Enter your Gmail address (@gmail.com) to receive classroom report:', targetEmail);
      if (!emailInput || !emailInput.trim()) return;
      if (!/^[^\s@]+@gmail\.com$/i.test(emailInput.trim())) {
        alert('Please enter a valid Gmail address ending in @gmail.com');
        return;
      }
      targetEmail = emailInput.trim();
      setTeacherEmail(targetEmail);
    }
    sendDashboardEmailTo(targetEmail);
  };

  const sendDashboardEmailTo = async (email: string) => {
    setSendingEmailReport(true);
    setEmailReportToast('');
    try {
      const res = await authFetch(`/api/rooms/${activeRoomCode}/send-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherEmail: email })
      });
      if (res.ok) {
        setEmailReportToast(`✓ Section report sent to ${email}!`);
        setTimeout(() => setEmailReportToast(''), 5000);
      } else {
        const data = await res.json().catch(() => ({}));
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

  const handleDownloadExcel = async () => {
    if (!activeRoomCode) return;
    setDownloadingExcel(true);
    try {
      const res = await authFetch(`/api/rooms/${activeRoomCode}/report/excel`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to download Excel report.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `section-report-${activeRoomCode}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Excel download error: ' + err.message);
    } finally {
      setDownloadingExcel(false);
    }
  };

  useEffect(() => {
    if (activeRoomCode) {
      fetchDashboardStats(activeRoomCode);
      pollIntervalRef.current = setInterval(() => fetchDashboardStats(activeRoomCode), 5000);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeRoomCode, fetchDashboardStats]);

  const handleCopyCode = () => {
    if (!activeRoomCode) return;
    navigator.clipboard.writeText(activeRoomCode).then(() => {
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
      const res = await authFetch(`/api/rooms/${activeRoomCode}/students`, {
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
        fetchDashboardStats(activeRoomCode);
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

  const handleStartRoom = async () => {
    if (!activeRoomCode) return;
    setStartingRoom(true);
    try {
      const res = await authFetch(`/api/rooms/${activeRoomCode}/start`, {
        method: 'POST'
      });
      if (res.ok) {
        setEmailReportToast('🚀 Room session started! Students can now proceed.');
        setTimeout(() => setEmailReportToast(''), 4000);
        await fetchTeacherRooms();
      } else {
        const err = await res.json().catch(() => ({}));
        setEmailReportToast(`✕ ${err.error || 'Failed to start room.'}`);
        setTimeout(() => setEmailReportToast(''), 4000);
      }
    } catch (err: any) {
      setEmailReportToast(`✕ Network error: ${err.message || 'Failed to connect.'}`);
      setTimeout(() => setEmailReportToast(''), 4000);
    } finally {
      setStartingRoom(false);
    }
  };

  // Delete student handler
  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      const res = await authFetch(`/api/rooms/${activeRoomCode}/students/${studentToDelete.number}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setStudentToDelete(null);
        fetchDashboardStats(activeRoomCode);
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

  // Active Phase Stats for the selected audit stream
  const activePhaseStats: PhaseSummaryStat[] = useMemo(() => {
    if (!summary) return [];
    if (auditAttemptMode === 'FIRST_ATTEMPT' && summary.firstAttemptPhaseStats && summary.firstAttemptPhaseStats.length > 0) {
      return summary.firstAttemptPhaseStats;
    }
    if (auditAttemptMode === 'RE_AUDIT' && summary.reAuditPhaseStats && summary.reAuditPhaseStats.length > 0) {
      return summary.reAuditPhaseStats;
    }
    return summary.phaseStats || [];
  }, [summary, auditAttemptMode]);

  // Transformed students list reflecting the selected audit stream
  const displayedStudents = useMemo(() => {
    return students.map(s => {
      if (auditAttemptMode === 'FIRST_ATTEMPT' && s.firstAttempt) {
        return {
          ...s,
          completedPhases: s.firstAttempt.completedPhases,
          attempts: s.firstAttempt.attempts,
          totalTimeSpentSeconds: s.firstAttempt.totalTimeSpentSeconds,
          totalTimeFormatted: s.firstAttempt.totalTimeFormatted,
          status: s.firstAttempt.status,
          phases: (s.phases || []).map(p => {
            const f = p.firstAttempt;
            if (!f) return p;
            return {
              ...p,
              status: f.status as any,
              attempts: f.attempts,
              failedAttempts: f.failedAttempts,
              bestScore: f.bestScore,
              timeSpentSeconds: f.timeSpentSeconds,
              timeSpentFormatted: f.timeSpentFormatted
            };
          })
        };
      }
      if (auditAttemptMode === 'RE_AUDIT' && s.reAudit) {
        return {
          ...s,
          completedPhases: s.reAudit.completedPhases,
          attempts: s.reAudit.attempts,
          totalTimeSpentSeconds: s.reAudit.totalTimeSpentSeconds,
          totalTimeFormatted: s.reAudit.totalTimeFormatted,
          status: s.reAudit.status,
          hasReAudited: s.reAudit.hasReAudited,
          phases: (s.phases || []).map(p => {
            const r = p.reAudit;
            if (!r) return p;
            return {
              ...p,
              status: r.status as any,
              attempts: r.attempts,
              failedAttempts: r.failedAttempts,
              bestScore: r.bestScore,
              timeSpentSeconds: r.timeSpentSeconds,
              timeSpentFormatted: r.timeSpentFormatted
            };
          })
        };
      }
      return s;
    });
  }, [students, auditAttemptMode]);

  // Filtered students based on search and status
  const filteredStudents = useMemo(() => {
    return displayedStudents.filter(s => {
      const matchesSearch =
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        filterStatus === 'ALL' ? true : s.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [displayedStudents, searchQuery, filterStatus]);

  // Total class completion percent for current stream
  const totalCompletionPercent = useMemo(() => {
    if (displayedStudents.length === 0) return 0;
    const totalPhasesPossible = displayedStudents.length * 7;
    const completedPhasesSum = displayedStudents.reduce((sum, s) => sum + s.completedPhases, 0);
    return Math.round((completedPhasesSum / totalPhasesPossible) * 100);
  }, [displayedStudents]);

  // ---------------------------------------------------------------------------
  // SVG CHARTS RENDERERS
  // ---------------------------------------------------------------------------

  const renderFunnelChart = () => {
    const isComparison = auditAttemptMode === 'COMPARISON' || auditAttemptMode === 'ALL';
    const total = summary?.totalStudents || displayedStudents.length || 1;

    if (isComparison) {
      const firstStats = summary?.firstAttemptPhaseStats && summary.firstAttemptPhaseStats.length > 0
        ? summary.firstAttemptPhaseStats
        : (summary?.phaseStats || []);
      const reAuditStats = summary?.reAuditPhaseStats && summary.reAuditPhaseStats.length > 0
        ? summary.reAuditPhaseStats
        : [];

      const phases = Array.from({ length: 7 }, (_, idx) => {
        const phaseId = idx + 1;
        const f = firstStats.find(p => p.phaseId === phaseId) || {
          phaseId,
          title: PHASE_LABELS[idx],
          completedCount: 0
        };
        const r = reAuditStats.find(p => p.phaseId === phaseId) || {
          phaseId,
          title: PHASE_LABELS[idx],
          completedCount: 0
        };
        return { phaseId, title: f.title || PHASE_LABELS[idx], f, r };
      });

      return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 0, marginBottom: '20px' }}>
            Comparison of completion rates between <strong style={{ color: '#38bdf8' }}>1st Attempt (Blue)</strong> and <strong style={{ color: '#fb923c' }}>Re-Audit Mastery (Orange)</strong>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: '650px' }}>
            {phases.map(({ phaseId, title, f, r }) => {
              const fPercent = Math.round(((f.completedCount || 0) / total) * 100);
              const rPercent = Math.round(((r.completedCount || 0) / total) * 100);

              return (
                <div key={phaseId} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 180px', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Blue 1st Attempt bar */}
                    <div style={{ height: '14px', background: '#0b1120', borderRadius: '3px', overflow: 'hidden', border: '1px solid #1e293b' }}>
                      <div
                        style={{
                          width: `${fPercent}%`,
                          background: 'linear-gradient(90deg, #0ea5e9, #0284c7)',
                          height: '100%',
                          transition: 'width 0.5s ease',
                          boxShadow: fPercent > 0 ? '0 0 8px rgba(14, 165, 233, 0.4)' : 'none'
                        }}
                        title={`1st Attempt Completed: ${f.completedCount} students (${fPercent}%)`}
                      />
                    </div>
                    {/* Orange Re-Audit bar */}
                    <div style={{ height: '14px', background: '#0b1120', borderRadius: '3px', overflow: 'hidden', border: '1px solid #1e293b' }}>
                      <div
                        style={{
                          width: `${rPercent}%`,
                          background: 'linear-gradient(90deg, #fb923c, #ea580c)',
                          height: '100%',
                          transition: 'width 0.5s ease',
                          boxShadow: rPercent > 0 ? '0 0 8px rgba(234, 88, 12, 0.4)' : 'none'
                        }}
                        title={`Re-Audit Mastered: ${r.completedCount} students (${rPercent}%)`}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'right', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div>
                      <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>1st: {f.completedCount}</span>/{total} passed{' '}
                      <span style={{ color: '#60a5fa' }}>({fPercent}%)</span>
                    </div>
                    <div>
                      <span style={{ color: '#fb923c', fontWeight: 'bold' }}>Re: {r.completedCount}</span>/{total} mastered{' '}
                      <span style={{ color: '#f97316' }}>({rPercent}%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '16px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', background: 'linear-gradient(90deg, #0ea5e9, #0284c7)', borderRadius: '3px', display: 'inline-block' }}></span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>1st Attempt Passed (Diagnostic)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', background: 'linear-gradient(90deg, #fb923c, #ea580c)', borderRadius: '3px', display: 'inline-block' }}></span>
              <span style={{ color: '#fb923c', fontWeight: 600 }}>Re-Audit Mastered (Practice)</span>
            </div>
          </div>
        </div>
      );
    }

    // Single-stream funnel
    const phaseStats = activePhaseStats;

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
                      background: auditAttemptMode === 'RE_AUDIT'
                        ? 'linear-gradient(90deg, #fb923c, #ea580c)'
                        : 'linear-gradient(90deg, #0ea5e9, #0284c7)',
                      height: '100%',
                      transition: 'width 0.5s ease',
                      boxShadow: percent > 0 ? (auditAttemptMode === 'RE_AUDIT' ? '0 0 10px rgba(234, 88, 12, 0.4)' : '0 0 10px rgba(14, 165, 233, 0.4)') : 'none'
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
                  <strong style={{ color: auditAttemptMode === 'RE_AUDIT' ? '#fb923c' : '#38bdf8' }}>{p.completedCount}</strong>/{total} passed{' '}
                  <span style={{ color: '#60a5fa' }}>({percent}%)</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginTop: '16px', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: auditAttemptMode === 'RE_AUDIT' ? '#fb923c' : '#0ea5e9', borderRadius: '2px', display: 'inline-block' }}></span>
            <span style={{ color: '#94a3b8' }}>
              {auditAttemptMode === 'RE_AUDIT' ? 'Re-Audit Completed' : 'Completed'}
            </span>
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
    const isComparison = auditAttemptMode === 'COMPARISON' || auditAttemptMode === 'ALL';
    const firstStats = summary?.firstAttemptPhaseStats && summary.firstAttemptPhaseStats.length > 0
      ? summary.firstAttemptPhaseStats
      : (summary?.phaseStats || []);
    const reAuditStats = summary?.reAuditPhaseStats && summary.reAuditPhaseStats.length > 0
      ? summary.reAuditPhaseStats
      : [];

    if (isComparison) {
      const allTimes = [
        ...firstStats.map(p => p.avgTimeSeconds),
        ...reAuditStats.map(p => p.avgTimeSeconds)
      ];
      const maxTime = Math.max(...allTimes, 60);

      const phases = Array.from({ length: 7 }, (_, idx) => {
        const phaseId = idx + 1;
        const f = firstStats.find(p => p.phaseId === phaseId) || {
          phaseId,
          title: PHASE_LABELS[idx],
          avgTimeSeconds: 0,
          avgTimeFormatted: '--',
          avgAttempts: 0,
          completedCount: 0
        };
        const r = reAuditStats.find(p => p.phaseId === phaseId) || {
          phaseId,
          title: PHASE_LABELS[idx],
          avgTimeSeconds: 0,
          avgTimeFormatted: '--',
          avgAttempts: 0,
          completedCount: 0
        };
        return { phaseId, title: f.title || PHASE_LABELS[idx], f, r };
      });

      return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 0, marginBottom: '20px' }}>
            Side-by-side comparison of <strong style={{ color: '#38bdf8' }}>1st Attempt (Blue)</strong> baseline duration vs. <strong style={{ color: '#fb923c' }}>Re-Audit (Orange)</strong> practice duration across Phases 1–7. Highlights speedup and retention.
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '230px', paddingBottom: '30px', borderBottom: '1px solid #334155', minWidth: '650px' }}>
            {phases.map(({ phaseId, title, f, r }) => {
              const fHeight = Math.max(Math.round(((f.avgTimeSeconds || 0) / maxTime) * 160), f.avgTimeSeconds > 0 ? 8 : 4);
              const rHeight = Math.max(Math.round(((r.avgTimeSeconds || 0) / maxTime) * 160), r.avgTimeSeconds > 0 ? 8 : 4);

              return (
                <div key={phaseId} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  {/* Side-by-side grouped bars */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', width: '100%', justifyContent: 'center' }}>
                    {/* Blue bar: First Attempt */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '38px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                        {f.avgTimeFormatted !== '--' ? f.avgTimeFormatted : '0s'}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          height: `${fHeight}px`,
                          background: 'linear-gradient(180deg, #0ea5e9, #0284c7)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.4s ease',
                          boxShadow: '0 0 10px rgba(14, 165, 233, 0.35)'
                        }}
                        title={`${title} (1st Attempt): Avg ${f.avgTimeFormatted} (${f.completedCount} passed)`}
                      />
                    </div>

                    {/* Orange bar: Re-Audit */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '38px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#fb923c', fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                        {r.completedCount > 0 && r.avgTimeFormatted !== '--' ? r.avgTimeFormatted : '--'}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          height: `${rHeight}px`,
                          background: r.completedCount > 0
                            ? 'linear-gradient(180deg, #fb923c, #ea580c)'
                            : 'rgba(234, 88, 12, 0.25)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.4s ease',
                          boxShadow: r.completedCount > 0 ? '0 0 10px rgba(234, 88, 12, 0.35)' : 'none'
                        }}
                        title={`${title} (Re-Audit): Avg ${r.avgTimeFormatted} (${r.completedCount} re-audited)`}
                      />
                    </div>
                  </div>

                  <span style={{ fontSize: '0.78rem', color: '#e2e8f0', fontWeight: 'bold', marginTop: '8px', textAlign: 'center' }}>
                    P{phaseId}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '16px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', background: 'linear-gradient(180deg, #0ea5e9, #0284c7)', borderRadius: '3px', display: 'inline-block' }}></span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>1st Attempt (Initial Diagnostic)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', background: 'linear-gradient(180deg, #fb923c, #ea580c)', borderRadius: '3px', display: 'inline-block' }}></span>
              <span style={{ color: '#fb923c', fontWeight: 600 }}>Re-Audit Attempt (Practice &amp; Mastery)</span>
            </div>
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
    }

    // Single-stream view
    const phaseStats = activePhaseStats;
    const maxTime = Math.max(...phaseStats.map(p => p.avgTimeSeconds), 60);

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 0, marginBottom: '20px' }}>
          {auditAttemptMode === 'RE_AUDIT'
            ? 'Average duration students took during Re-Audit practice. Demonstrates mastery speedup.'
            : 'Average duration students took to successfully conquer each phase on initial audit. Highlights key learning bottlenecks.'}
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '220px', paddingBottom: '30px', borderBottom: '1px solid #334155', minWidth: '650px' }}>
          {phaseStats.map((p, idx) => {
            const barHeight = Math.max(Math.round((p.avgTimeSeconds / maxTime) * 160), 8);
            const isHighest = p.avgTimeSeconds === maxTime && maxTime > 0;

            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.75rem', color: isHighest ? '#fbbf24' : (auditAttemptMode === 'RE_AUDIT' ? '#fb923c' : '#38bdf8'), fontWeight: 'bold', marginBottom: '6px' }}>
                  {p.avgTimeFormatted !== '--' ? p.avgTimeFormatted : '0s'}
                </span>
                <div
                  style={{
                    width: '75%',
                    height: `${barHeight}px`,
                    background: isHighest
                      ? 'linear-gradient(180deg, #f59e0b, #b45309)'
                      : (auditAttemptMode === 'RE_AUDIT'
                          ? 'linear-gradient(180deg, #fb923c, #ea580c)'
                          : 'linear-gradient(180deg, #0ea5e9, #0284c7)'),
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
    const isComparison = auditAttemptMode === 'COMPARISON' || auditAttemptMode === 'ALL';
    const firstStats = summary?.firstAttemptPhaseStats && summary.firstAttemptPhaseStats.length > 0
      ? summary.firstAttemptPhaseStats
      : (summary?.phaseStats || []);
    const reAuditStats = summary?.reAuditPhaseStats && summary.reAuditPhaseStats.length > 0
      ? summary.reAuditPhaseStats
      : [];

    if (isComparison) {
      const allAtts = [
        ...firstStats.map(p => p.avgAttempts),
        ...reAuditStats.map(p => p.avgAttempts)
      ];
      const maxAttempts = Math.max(...allAtts, 5);

      const phases = Array.from({ length: 7 }, (_, idx) => {
        const phaseId = idx + 1;
        const f = firstStats.find(p => p.phaseId === phaseId) || {
          phaseId,
          title: PHASE_LABELS[idx],
          avgAttempts: 0,
          completedCount: 0
        };
        const r = reAuditStats.find(p => p.phaseId === phaseId) || {
          phaseId,
          title: PHASE_LABELS[idx],
          avgAttempts: 0,
          completedCount: 0
        };
        return { phaseId, title: f.title || PHASE_LABELS[idx], f, r };
      });

      return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 0, marginBottom: '20px' }}>
            Side-by-side comparison of <strong style={{ color: '#38bdf8' }}>1st Attempt (Blue)</strong> friction tries vs. <strong style={{ color: '#fb923c' }}>Re-Audit (Orange)</strong> retry counts across Phases 1–7.
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '230px', paddingBottom: '30px', borderBottom: '1px solid #334155', minWidth: '650px' }}>
            {phases.map(({ phaseId, title, f, r }) => {
              const fHeight = Math.max(Math.round(((f.avgAttempts || 0) / maxAttempts) * 160), f.avgAttempts > 0 ? 8 : 4);
              const rHeight = Math.max(Math.round(((r.avgAttempts || 0) / maxAttempts) * 160), r.avgAttempts > 0 ? 8 : 4);

              return (
                <div key={phaseId} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  {/* Side-by-side grouped bars */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', width: '100%', justifyContent: 'center' }}>
                    {/* Blue bar: First Attempt */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '38px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                        {(f.avgAttempts || 0).toFixed(1)}x
                      </span>
                      <div
                        style={{
                          width: '100%',
                          height: `${fHeight}px`,
                          background: 'linear-gradient(180deg, #0ea5e9, #0284c7)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.4s ease',
                          boxShadow: '0 0 10px rgba(14, 165, 233, 0.35)'
                        }}
                        title={`${title} (1st Attempt): Avg ${f.avgAttempts} attempts`}
                      />
                    </div>

                    {/* Orange bar: Re-Audit */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '38px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#fb923c', fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                        {r.completedCount > 0 ? `${(r.avgAttempts || 0).toFixed(1)}x` : '--'}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          height: `${rHeight}px`,
                          background: r.completedCount > 0
                            ? 'linear-gradient(180deg, #fb923c, #ea580c)'
                            : 'rgba(234, 88, 12, 0.25)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.4s ease',
                          boxShadow: r.completedCount > 0 ? '0 0 10px rgba(234, 88, 12, 0.35)' : 'none'
                        }}
                        title={`${title} (Re-Audit): Avg ${r.avgAttempts} attempts`}
                      />
                    </div>
                  </div>

                  <span style={{ fontSize: '0.78rem', color: '#e2e8f0', fontWeight: 'bold', marginTop: '8px', textAlign: 'center' }}>
                    P{phaseId}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '16px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', background: 'linear-gradient(180deg, #0ea5e9, #0284c7)', borderRadius: '3px', display: 'inline-block' }}></span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>1st Attempt Average Tries</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', background: 'linear-gradient(180deg, #fb923c, #ea580c)', borderRadius: '3px', display: 'inline-block' }}></span>
              <span style={{ color: '#fb923c', fontWeight: 600 }}>Re-Audit Average Tries</span>
            </div>
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
    }

    // Single-stream view
    const phaseStats = activePhaseStats;
    const maxAttempts = Math.max(...phaseStats.map(p => p.avgAttempts), 5);

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 0, marginBottom: '20px' }}>
          {auditAttemptMode === 'RE_AUDIT'
            ? 'Average attempts during Re-Audit runs. Shows how quickly students solve scenarios on subsequent practice.'
            : 'Average calculation attempts submitted on First Attempt. Spikes reflect where Infinite Drills or mistakes occurred.'}
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '220px', paddingBottom: '30px', borderBottom: '1px solid #334155', minWidth: '650px' }}>
          {phaseStats.map((p, idx) => {
            const barHeight = Math.max(Math.round((p.avgAttempts / maxAttempts) * 160), 8);
            const isFriction = p.avgAttempts >= 4.0;

            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.8rem', color: isFriction ? '#ef4444' : (auditAttemptMode === 'RE_AUDIT' ? '#fb923c' : '#38bdf8'), fontWeight: 'bold', marginBottom: '6px' }}>
                  {p.avgAttempts.toFixed(1)}x
                </span>
                <div
                  style={{
                    width: '75%',
                    height: `${barHeight}px`,
                    background: isFriction
                      ? 'linear-gradient(180deg, #ef4444, #991b1b)'
                      : (auditAttemptMode === 'RE_AUDIT'
                          ? 'linear-gradient(180deg, #fb923c, #ea580c)'
                          : 'linear-gradient(180deg, #0ea5e9, #0284c7)'),
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
    const isComparison = auditAttemptMode === 'COMPARISON' || auditAttemptMode === 'ALL';
    const total = students.length || 1;

    if (isComparison) {
      const firstCompleted = summary?.firstAttemptCompletedStudents ?? students.filter(s => s.firstAttempt ? s.firstAttempt.completedPhases === 7 : s.completedPhases === 7).length;
      const firstInProgress = students.filter(s => {
        const c = s.firstAttempt ? s.firstAttempt.completedPhases : s.completedPhases;
        return c > 0 && c < 7;
      }).length;
      const firstNotStarted = Math.max(0, total - firstCompleted - firstInProgress);

      const firstCompletedPct = Math.round((firstCompleted / total) * 100);
      const firstInProgressPct = Math.round((firstInProgress / total) * 100);

      const reCompleted = students.filter(s => s.reAudit && s.reAudit.completedPhases === 7).length;
      const reInProgress = students.filter(s => s.reAudit && s.reAudit.completedPhases > 0 && s.reAudit.completedPhases < 7).length;
      const reNotStarted = Math.max(0, total - reCompleted - reInProgress);

      const reCompletedPct = Math.round((reCompleted / total) * 100);
      const reInProgressPct = Math.round((reInProgress / total) * 100);

      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '48px', flexWrap: 'wrap', padding: '10px 0' }}>
          {/* Left: 1st Attempt Cohort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(14, 165, 233, 0.05)', padding: '16px 24px', borderRadius: '12px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
            <div style={{ position: 'relative', width: '130px', height: '130px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#1e293b" strokeWidth="4" />
                <circle
                  cx="18" cy="18" r="15.915" fill="transparent"
                  stroke="#0ea5e9" strokeWidth="4"
                  strokeDasharray={`${firstCompletedPct} ${100 - firstCompletedPct}`}
                  strokeDashoffset="0"
                />
                <circle
                  cx="18" cy="18" r="15.915" fill="transparent"
                  stroke="#38bdf8" strokeWidth="4"
                  strokeDasharray={`${firstInProgressPct} ${100 - firstInProgressPct}`}
                  strokeDashoffset={`${-firstCompletedPct}`}
                />
              </svg>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#38bdf8' }}>{firstCompleted}/{total}</span>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>1ST PASS</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <strong style={{ color: '#38bdf8', fontSize: '0.9rem', marginBottom: '2px' }}>🎯 1st Attempt Cohort</strong>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                <span style={{ color: '#0ea5e9', fontWeight: 'bold' }}>{firstCompleted}</span> passed 7/7 ({firstCompletedPct}%)
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{firstInProgress}</span> in progress ({firstInProgressPct}%)
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <span>{firstNotStarted}</span> not started
              </div>
            </div>
          </div>

          {/* Right: Re-Audit Cohort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(234, 88, 12, 0.05)', padding: '16px 24px', borderRadius: '12px', border: '1px solid rgba(234, 88, 12, 0.2)' }}>
            <div style={{ position: 'relative', width: '130px', height: '130px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#1e293b" strokeWidth="4" />
                <circle
                  cx="18" cy="18" r="15.915" fill="transparent"
                  stroke="#ea580c" strokeWidth="4"
                  strokeDasharray={`${reCompletedPct} ${100 - reCompletedPct}`}
                  strokeDashoffset="0"
                />
                <circle
                  cx="18" cy="18" r="15.915" fill="transparent"
                  stroke="#fb923c" strokeWidth="4"
                  strokeDasharray={`${reInProgressPct} ${100 - reInProgressPct}`}
                  strokeDashoffset={`${-reCompletedPct}`}
                />
              </svg>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fb923c' }}>{reCompleted}/{total}</span>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>RE-MASTER</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <strong style={{ color: '#fb923c', fontSize: '0.9rem', marginBottom: '2px' }}>↻ Re-Audit Cohort</strong>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                <span style={{ color: '#ea580c', fontWeight: 'bold' }}>{reCompleted}</span> mastered 7/7 ({reCompletedPct}%)
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                <span style={{ color: '#fb923c', fontWeight: 'bold' }}>{reInProgress}</span> practicing ({reInProgressPct}%)
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <span>{reNotStarted}</span> not re-audited yet
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Single-stream cohort status
    const completed = displayedStudents.filter(s => s.completedPhases === 7).length;
    const inProgress = displayedStudents.filter(s => s.completedPhases > 0 && s.completedPhases < 7).length;
    const justStarted = displayedStudents.filter(s => s.completedPhases === 0).length;

    const completedPct = Math.round((completed / total) * 100);
    const inProgressPct = Math.round((inProgress / total) * 100);
    const justStartedPct = Math.round((justStarted / total) * 100);

    const completedLabel = auditAttemptMode === 'RE_AUDIT'
      ? 'Mastered Re-Audit (7/7):'
      : '1st Attempt Passed (7/7):';
    const inProgressLabel = auditAttemptMode === 'RE_AUDIT'
      ? 'Re-Auditing (1-6):'
      : 'In Progress (1-6):';
    const justStartedLabel = auditAttemptMode === 'RE_AUDIT'
      ? 'No Re-Audit Yet:'
      : 'At Starting Line:';

    const accentColor = auditAttemptMode === 'RE_AUDIT' ? '#fb923c' : '#0ea5e9';

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', padding: '10px 0' }}>
        <div style={{ position: 'relative', width: '160px', height: '160px' }}>
          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#1e293b" strokeWidth="4" />
            <circle
              cx="18" cy="18" r="15.915" fill="transparent"
              stroke={accentColor} strokeWidth="4"
              strokeDasharray={`${completedPct} ${100 - completedPct}`}
              strokeDashoffset="0"
            />
            <circle
              cx="18" cy="18" r="15.915" fill="transparent"
              stroke="#f59e0b" strokeWidth="4"
              strokeDasharray={`${inProgressPct} ${100 - inProgressPct}`}
              strokeDashoffset={`${-completedPct}`}
            />
          </svg>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>{displayedStudents.length}</span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>STUDENTS</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '14px', height: '14px', background: accentColor, borderRadius: '3px' }}></span>
            <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{completedLabel}</span>
            <strong style={{ color: accentColor }}>{completed} ({completedPct}%)</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '14px', height: '14px', background: '#f59e0b', borderRadius: '3px' }}></span>
            <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{inProgressLabel}</span>
            <strong style={{ color: '#f59e0b' }}>{inProgress} ({inProgressPct}%)</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '14px', height: '14px', background: '#1e293b', borderRadius: '3px', border: '1px solid #475569' }}></span>
            <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{justStartedLabel}</span>
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
              <span>No Zero Days: Payroll Simulator</span>
              <span className="dash-badge dash-badge-pulse">TEACHER NEXUS</span>
            </h1>
            <div className="dash-meta-info">
              <span>
                Room:{' '}
                <span className="room-code-tag" onClick={handleCopyCode} title="Click to copy room code">
                  {activeRoomCode} 📋
                </span>
                {copied && <span style={{ color: '#10b981', marginLeft: '6px', fontSize: '0.8rem' }}>COPIED!</span>}
              </span>
              <span>Supervisor: <strong style={{ color: '#fff' }}>{teacherName}</strong></span>
              <span>Section: <strong style={{ color: '#60a5fa' }}>{roomSection || 'General'}</strong></span>
              {teacherEmail && (
                <span>Email: <strong style={{ color: '#38bdf8' }}>{teacherEmail}</strong></span>
              )}
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
              title={teacherEmail ? `Email section report to ${teacherEmail}` : 'Send section report to email'}
            >
              <span>✉️</span> {sendingEmailReport ? 'SENDING...' : 'EMAIL REPORT'}
            </button>
            <button className="dash-btn dash-btn-outline" onClick={() => fetchDashboardStats(activeRoomCode)} title="Refresh Live Data">
              <span>⟳</span> REFRESH
            </button>
            <button
              className="dash-btn dash-btn-danger"
              onClick={onExit || onBack}
              title="Exit room and log out safely back to login screen"
            >
              [ LOGOUT ]
            </button>
          </div>
        </header>

        {/* SECTION MANAGER & ROOM TABS */}
        <section className="section-manager-container">
          <div className="section-manager-header">
            <div className="section-manager-title">
              <span className="section-manager-icon">🏫</span>
              <div>
                <h3>SECTION &amp; CLASSROOM MANAGER</h3>
                <span className="section-manager-subtitle">Manage all class sections, student rosters &amp; performance reports</span>
              </div>
            </div>
            <button
              type="button"
              className="create-section-btn"
              onClick={() => {
                setCreateSectionError('');
                setShowNewSectionModal(true);
              }}
              title="Generate a new room code and section for another class"
            >
              <span>➕</span> GENERATE NEW CLASSROOM
            </button>
          </div>

          {teacherRooms.length > 0 && (
            <div className="section-tabs-container">
              <div className="section-tabs-scroll">
                {teacherRooms.map((r) => {
                  const isActive = r.roomCode === activeRoomCode;
                  return (
                    <div
                      key={r.roomCode}
                      className={`section-tab-card ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectSection(r.roomCode, r.section)}
                      title={`Switch to ${r.section || 'General'} (${r.roomCode})`}
                    >
                      <div className="section-tab-top">
                        <span className="section-tab-name" title={r.section || 'General'}>
                          {r.section || 'General'}
                        </span>
                        {isActive && <span className="active-indicator-badge">ACTIVE</span>}
                      </div>
                      <div className="section-tab-bottom">
                        <span className="section-tab-code">{r.roomCode}</span>
                        <span className="section-tab-count">👥 {r.participantCount ?? 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeRoomCode && (
                <div className="active-section-toolbar">
                  <div className="active-section-meta">
                    <span className="meta-label">CURRENT SECTION:</span>
                    <span className="meta-value">{roomSection || 'General'}</span>
                    <span className="meta-divider">|</span>
                    <span className="meta-label">ROOM CODE:</span>
                    <span
                      className="meta-code"
                      title="Click to copy room code"
                      onClick={() => {
                        navigator.clipboard.writeText(activeRoomCode);
                        setEmailReportToast('📋 Room code copied to clipboard!');
                        setTimeout(() => setEmailReportToast(''), 3000);
                      }}
                    >
                      {activeRoomCode} 📋
                    </span>
                    <span className="meta-divider">|</span>
                    <span className="meta-label">STUDENTS:</span>
                    <span className="meta-value">{students.length}</span>
                  </div>

                  <div className="active-section-actions">
                    {teacherRooms.find(r => r.roomCode === activeRoomCode)?.status === 'WAITING' && (
                      <button
                        type="button"
                        className="section-action-btn start-session-btn"
                        onClick={handleStartRoom}
                        disabled={startingRoom || !activeRoomCode}
                        title="Start this classroom session so waiting students can proceed"
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          fontWeight: 'bold',
                          border: '1px solid #34d399',
                          boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)'
                        }}
                      >
                        <span>▶️</span> {startingRoom ? 'STARTING...' : 'START SESSION'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="section-action-btn email"
                      onClick={handleSendReportEmail}
                      disabled={sendingEmailReport || !activeRoomCode}
                      title={`Email full audit report of ${roomSection || activeRoomCode} to ${teacherEmail}`}
                    >
                      <span>📧</span> {sendingEmailReport ? 'SENDING REPORT...' : 'EMAIL SECTION REPORT'}
                    </button>
                    <button
                      type="button"
                      className="section-action-btn excel"
                      onClick={handleDownloadExcel}
                      disabled={downloadingExcel || !activeRoomCode}
                      title="Download Excel spreadsheet of this section's performance"
                    >
                      <span>📊</span> {downloadingExcel ? 'DOWNLOADING...' : 'DOWNLOAD EXCEL'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

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

        {!activeRoomCode && teacherRooms.length === 0 ? (
          <div className="empty-teacher-state">
            <div className="empty-state-icon">🏫</div>
            <h2>NO CLASSROOMS CREATED YET</h2>
            <p>Welcome to your All-In-One Teacher Command Center!</p>
            <p className="empty-state-sub">
              As an O&amp;M Instructor, you can manage all your class sections and student cohorts under this single master account.
              Generate your first classroom section code to get started.
            </p>
            <button
              type="button"
              className="create-section-btn large"
              onClick={() => {
                setCreateSectionError('');
                setShowNewSectionModal(true);
              }}
            >
              <span>➕</span> GENERATE YOUR FIRST SECTION
            </button>
          </div>
        ) : (
          <>
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
          <div className="chart-header-controls">
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

            {/* AUDIT ATTEMPT STREAM DROPDOWN (Right of Cohort Status) */}
            <div className="audit-attempt-selector">
              <label className="audit-selector-label" htmlFor="auditAttemptSelect">
                AUDIT DATA STREAM:
              </label>
              <select
                id="auditAttemptSelect"
                className="audit-selector-dropdown"
                value={auditAttemptMode}
                onChange={(e) => setAuditAttemptMode(e.target.value as any)}
                title="Filter metrics by Comparison Stream (Blue vs. Orange), First Attempt, or Re-Audit practice"
              >
                <option value="COMPARISON">⚖️ Comparison Stream (1st Attempt vs. Re-Audit)</option>
                <option value="FIRST_ATTEMPT">🎯 First Attempt (Initial Diagnostic)</option>
                <option value="RE_AUDIT">↻ Re-Audit Attempt (Practice &amp; Mastery)</option>
              </select>
            </div>
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
              Showing {filteredStudents.length} of {students.length} students • Mode:{' '}
              <strong style={{
                color: auditAttemptMode === 'FIRST_ATTEMPT' ? '#60a5fa' : auditAttemptMode === 'RE_AUDIT' ? '#fb923c' : '#38bdf8',
                letterSpacing: '0.5px'
              }}>
                {auditAttemptMode === 'FIRST_ATTEMPT'
                  ? 'First Attempt Baseline'
                  : auditAttemptMode === 'RE_AUDIT'
                  ? 'Re-Audit Practice & Mastery'
                  : '1st Attempt (Blue) vs. Re-Audit (Orange) Comparison'}
              </strong>
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
              Share room code <strong style={{ color: '#fbbf24' }}>{activeRoomCode}</strong> with your students or click "ENROLL STUDENT" above.
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
                        {stu.hasReAudited && (
                          <span className="badge-reaudit-active" title="Student has engaged in Re-Audit practice">
                            ↻ RE-AUDITED
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`badge-status ${isCompleted ? 'badge-passed' : 'badge-active'}`}>
                      {isCompleted ? '✓ PASSED' : '⚡ ACTIVE'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="progress-bar-container">
                    <div className="progress-header">
                      <span style={{ color: '#94a3b8' }}>
                        {auditAttemptMode === 'RE_AUDIT' ? 'Re-Audited Phases' : auditAttemptMode === 'COMPARISON' ? 'Phases Cleared' : 'Phases Completed'}
                      </span>
                      <strong style={{ color: isCompleted ? '#34d399' : '#60a5fa' }}>
                        {percent}% ({stu.completedPhases} / 7)
                      </strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${percent}%`,
                          background: auditAttemptMode === 'RE_AUDIT'
                            ? 'linear-gradient(90deg, #fb923c, #ea580c)'
                            : undefined
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Quick stats: Total Time & Attempts */}
                  {auditAttemptMode === 'COMPARISON' ? (
                    <div className="stu-quick-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div className="stat-item" style={{ borderLeft: '3px solid #0ea5e9', paddingLeft: '8px' }}>
                        <span style={{ color: '#38bdf8', fontSize: '0.7rem' }}>1ST ATTEMPT</span>
                        <strong style={{ color: '#e0f2fe', fontSize: '0.82rem' }}>
                          ⏱️ {stu.firstAttempt?.totalTimeFormatted || stu.totalTimeFormatted || '--'} • {stu.firstAttempt?.attempts ?? stu.attempts} att
                        </strong>
                      </div>
                      <div className="stat-item" style={{ borderLeft: '3px solid #f97316', paddingLeft: '8px' }}>
                        <span style={{ color: '#fb923c', fontSize: '0.7rem' }}>RE-AUDIT</span>
                        <strong style={{ color: '#ffedd5', fontSize: '0.82rem' }}>
                          {stu.reAudit && stu.reAudit.hasReAudited ? (
                            <>⏱️ {stu.reAudit.totalTimeFormatted} • {stu.reAudit.attempts} att</>
                          ) : (
                            <span style={{ color: '#64748b', fontStyle: 'italic', fontWeight: 'normal' }}>Not Re-Audited</span>
                          )}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="stu-quick-stats">
                      <div className="stat-item">
                        <span>{auditAttemptMode === 'RE_AUDIT' ? 'RE-AUDIT TIME' : 'TOTAL TIME SPENT'}</span>
                        <strong style={{ color: auditAttemptMode === 'RE_AUDIT' ? '#fb923c' : '#38bdf8' }}>{stu.totalTimeFormatted || '--'}</strong>
                      </div>
                      <div className="stat-item">
                        <span>{auditAttemptMode === 'RE_AUDIT' ? 'RE-AUDIT TRIES' : 'TOTAL ATTEMPTS'}</span>
                        <strong style={{ color: stu.attempts === 0 ? '#10b981' : stu.attempts >= 3 ? '#f87171' : '#fbbf24' }}>
                          {stu.attempts} attempt{stu.attempts !== 1 ? 's' : ''}
                        </strong>
                      </div>
                    </div>
                  )}

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
                      <span>PHASE STATUS &amp; METRICS</span>
                      <span style={{ color: '#60a5fa', cursor: 'pointer' }} onClick={() => setExpandedStudent(isExpanded ? null : stu.studentNumber)}>
                        {isExpanded ? '▲ Hide Breakdown' : '▼ Compare 1st vs Re-Audit'}
                      </span>
                    </div>

                    <div className="phase-chips-row">
                      {(stu.phases || []).map((p) => (
                        <div
                          key={p.phaseId}
                          className={`phase-chip ${p.status}`}
                          title={`${p.title}: ${p.status === 'NOT_ATTEMPTED' ? 'OPEN' : p.status} | Attempts: ${p.attempts} | Time: ${p.timeSpentFormatted}`}
                          onClick={() => setExpandedStudent(isExpanded ? null : stu.studentNumber)}
                        >
                          <span className="chip-num">P{p.phaseId}</span>
                          <span className="chip-icon">
                            {p.status === 'COMPLETED' ? '✓' : p.status === 'ACTIVE' || p.attempts > 0 ? '⚡' : '○'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Detailed Accordion for this student: Side-by-side First Attempt vs Re-Audit */}
                    {isExpanded && (
                      <div className="phase-details-list">
                        <div className="comparative-detail-header">
                          <span>PHASE</span>
                          <span>1ST ATTEMPT</span>
                          <span>RE-AUDIT</span>
                          <span>STATUS</span>
                        </div>
                        {(stu.phases || []).map((p) => {
                          const first = p.firstAttempt;
                          const re = p.reAudit;
                          return (
                            <div key={p.phaseId} className={`comparative-detail-row ${p.status}`}>
                              <div className="p-col-name">
                                <strong>P{p.phaseId}</strong>: {p.title.replace(/^Phase \d+: /, '')}
                              </div>
                              <div className="p-col-first">
                                <span className="p-metric-tag" title="First attempt tries">
                                  🎯 {first?.attempts ?? p.attempts} att
                                </span>
                                <span className="p-metric-tag" title="First attempt duration">
                                  ⏱️ {first?.timeSpentFormatted ?? p.timeSpentFormatted}
                                </span>
                              </div>
                              <div className="p-col-reaudit">
                                {re && re.hasReAudited ? (
                                  <>
                                    <span className="p-metric-tag reaudit" title="Re-audit practice tries">
                                      ↻ {re.attempts} att
                                    </span>
                                    <span className="p-metric-tag reaudit" title="Re-audit duration">
                                      ⏱️ {re.timeSpentFormatted}
                                    </span>
                                  </>
                                ) : (
                                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                    --
                                  </span>
                                )}
                              </div>
                              <div className="p-col-status">
                                <span style={{
                                  fontSize: '0.75rem',
                                  color: p.status === 'COMPLETED' ? '#10b981' : p.status === 'ACTIVE' || p.attempts > 0 ? '#f59e0b' : '#94a3b8',
                                  fontWeight: 'bold'
                                }}>
                                  {p.status === 'COMPLETED' ? 'COMPLETED' : p.status === 'ACTIVE' || p.attempts > 0 ? 'ACTIVE' : 'OPEN'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
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
                  <th style={{ width: '130px' }}>
                    {auditAttemptMode === 'RE_AUDIT'
                      ? 'RE-AUDIT TIME'
                      : auditAttemptMode === 'COMPARISON'
                      ? 'TIME (1st vs Re)'
                      : 'TOTAL TIME'}
                  </th>
                  <th style={{ width: '110px' }}>
                    {auditAttemptMode === 'RE_AUDIT'
                      ? 'RE-AUD TRIES'
                      : auditAttemptMode === 'COMPARISON'
                      ? 'TRIES (1st vs Re)'
                      : 'ATTEMPTS'}
                  </th>
                  <th style={{ width: '100px' }}>
                    {auditAttemptMode === 'RE_AUDIT' ? 'RE-AUD PASSED' : 'PROGRESS'}
                  </th>
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
                        {auditAttemptMode === 'COMPARISON' ? (
                          <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ color: '#38bdf8' }}>1st: {stu.firstAttempt?.totalTimeFormatted || stu.totalTimeFormatted || '--'}</span>
                            <span style={{ color: '#fb923c' }}>Re: {stu.reAudit?.hasReAudited ? stu.reAudit.totalTimeFormatted : '--'}</span>
                          </div>
                        ) : (
                          stu.totalTimeFormatted || '--'
                        )}
                      </td>
                      <td style={{ color: stu.attempts > 8 ? '#f87171' : '#cbd5e1' }}>
                        {auditAttemptMode === 'COMPARISON' ? (
                          <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ color: '#38bdf8' }}>1st: {stu.firstAttempt?.attempts ?? stu.attempts}</span>
                            <span style={{ color: '#fb923c' }}>Re: {stu.reAudit?.hasReAudited ? stu.reAudit.attempts : '--'}</span>
                          </div>
                        ) : (
                          stu.attempts
                        )}
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
                      {(stu.phases || []).map((p) => {
                        const first = p.firstAttempt;
                        const re = p.reAudit;

                        if (auditAttemptMode === 'COMPARISON') {
                          return (
                            <td key={p.phaseId} className={`matrix-phase-cell ${p.status}`}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.72rem' }}>
                                <div style={{ color: '#38bdf8', display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                                  <span style={{ fontWeight: 'bold' }}>1st:</span>
                                  <span>{first?.timeSpentFormatted || p.timeSpentFormatted || '--'}</span>
                                  <span style={{ color: '#64748b' }}>({first?.attempts ?? p.attempts}a)</span>
                                </div>
                                <div style={{ color: '#fb923c', display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                                  <span style={{ fontWeight: 'bold' }}>Re:</span>
                                  {re && re.hasReAudited ? (
                                    <>
                                      <span>{re.timeSpentFormatted}</span>
                                      <span style={{ color: '#fdba74' }}>({re.attempts}a)</span>
                                    </>
                                  ) : (
                                    <span style={{ color: '#475569', fontStyle: 'italic' }}>--</span>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={p.phaseId} className={`matrix-phase-cell ${p.status}`}>
                            {p.status === 'COMPLETED' || p.status === 'ACTIVE' || p.attempts > 0 || (p.timeSpentSeconds && p.timeSpentSeconds > 0) ? (
                              <div>
                                <div style={{ fontWeight: 'bold', color: auditAttemptMode === 'RE_AUDIT' ? '#fb923c' : undefined }}>
                                  {p.status === 'COMPLETED' ? '✓ ' : '⚡ '}
                                  {p.timeSpentFormatted !== '--' ? p.timeSpentFormatted : '0s'}
                                </div>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                  {p.attempts} att
                                </span>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontWeight: 'bold', color: '#64748b' }}>--</div>
                                <span style={{ fontSize: '0.7rem', color: '#475569' }}>0 att</span>
                              </div>
                            )}
                          </td>
                        );
                      })}

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
          </>
        )}
      </div>

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>➕ ENROLL STUDENT IN ROOM {activeRoomCode}</h3>
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
              <strong style={{ color: '#fbbf24' }}>{activeRoomCode}</strong>?
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

      {/* CREATE NEW SECTION MODAL */}
      {showNewSectionModal && (
        <div className="modal-backdrop" onClick={() => setShowNewSectionModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ CREATE NEW CLASS SECTION</h3>
              <button className="modal-close-btn" onClick={() => setShowNewSectionModal(false)}>✕</button>
            </div>

            {createSectionError && (
              <div className="modal-error" style={{ color: '#fca5a5', background: 'rgba(239, 68, 68, 0.15)', padding: '10px', borderRadius: '4px', marginBottom: '12px' }}>
                {createSectionError}
              </div>
            )}

            <form onSubmit={handleCreateSectionSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', color: '#60a5fa', marginBottom: '6px', fontSize: '0.85rem' }}>SECTION NAME</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Grade 12 - ABM B"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', background: '#0b1120', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ color: '#60a5fa', fontSize: '0.85rem' }}>CUSTOM ROOM CODE (Optional)</label>
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #475569',
                      color: '#fbbf24',
                      fontSize: '0.75rem',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    🎲 RANDOM CODE
                  </button>
                </div>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Leave empty or click Random"
                  value={newCustomCode}
                  onChange={(e) => setNewCustomCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', background: '#0b1120', border: '1px solid #334155', color: '#fff', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '2px' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="dash-btn dash-btn-outline"
                  onClick={() => setShowNewSectionModal(false)}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSection}
                  className="dash-btn dash-btn-primary"
                >
                  {isCreatingSection ? 'CREATING...' : 'CREATE & SWITCH TO SECTION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
