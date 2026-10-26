import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API_BASE_URL from '../../config';
import './ReAuditLeaderboardModal.css';

export interface PhaseBreakdownItem {
  phaseId: number;
  title: string;
  hasReAudited: boolean;
  isCompleted: boolean;
  fastestSeconds: number;
  fastestFormatted: string;
}

export interface StudentRankingItem {
  studentNumber: string;
  fullName: string;
  section: string;
  completedPhasesCount: number;
  totalPhases: number;
  isMasteredAll: boolean;
  hasReAudited: boolean;
  totalFastestSeconds: number;
  totalFastestFormatted: string;
  phaseBreakdown: PhaseBreakdownItem[];
  rank: number;
  isTop10: boolean;
}

export interface LeaderboardResponse {
  roomCode: string;
  section: string;
  teacherName: string;
  totalParticipants: number;
  rankings: StudentRankingItem[];
}

interface ReAuditLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoomCode?: string;
  currentStudentNumber?: string;
  isTeacher?: boolean;
}

export default function ReAuditLeaderboardModal({
  isOpen,
  onClose,
  initialRoomCode = '',
  currentStudentNumber = '',
  isTeacher = false
}: ReAuditLeaderboardModalProps) {
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode);
  const [inputCode, setInputCode] = useState<string>(initialRoomCode);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'ALL' | 'TOP10' | 'MASTERED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [showCodeInput, setShowCodeInput] = useState<boolean>(!initialRoomCode);

  // Sync initialRoomCode when modal opens
  useEffect(() => {
    if (isOpen) {
      const code = initialRoomCode || localStorage.getItem('studentRoomCode') || '';
      setRoomCode(code);
      setInputCode(code);
      setShowCodeInput(!code);
      if (code) {
        fetchLeaderboard(code);
      }
    }
  }, [isOpen, initialRoomCode]);

  const fetchLeaderboard = useCallback(async (targetCode: string) => {
    const trimmed = targetCode.trim().toUpperCase();
    if (!trimmed) {
      setError('Please provide a valid Room Code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${trimmed}/reaudit-rankings`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Room '${trimmed}' not found.`);
      }
      const json: LeaderboardResponse = await res.json();
      setData(json);
      setRoomCode(trimmed);
      setShowCodeInput(false);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to server.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      fetchLeaderboard(inputCode.trim());
    }
  };

  const formatTimerDigits = (sec: number) => {
    if (!sec || sec <= 0) return '--';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const filteredRankings = useMemo(() => {
    if (!data?.rankings) return [];
    return data.rankings.filter((item) => {
      // Tab filter
      if (filterTab === 'TOP10' && !item.isTop10) return false;
      if (filterTab === 'MASTERED' && !item.isMasteredAll) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.fullName.toLowerCase().includes(query);
        const matchesNum = item.studentNumber.toLowerCase().includes(query);
        return matchesName || matchesNum;
      }
      return true;
    });
  }, [data, filterTab, searchQuery]);

  const stats = useMemo(() => {
    if (!data?.rankings) {
      return { totalEnrolled: 0, reAuditors: 0, masteredAll: 0, leader: null as StudentRankingItem | null };
    }
    const totalEnrolled = data.totalParticipants || data.rankings.length;
    const reAuditors = data.rankings.filter(r => r.hasReAudited).length;
    const masteredAll = data.rankings.filter(r => r.isMasteredAll).length;
    const leader = data.rankings.find(r => r.completedPhasesCount > 0) || null;
    return { totalEnrolled, reAuditors, masteredAll, leader };
  }, [data]);

  if (!isOpen) return null;

  return (
    <div className="reaudit-leaderboard-overlay" onClick={onClose}>
      <div className="reaudit-leaderboard-card" onClick={(e) => e.stopPropagation()}>
        {/* Terminal Header */}
        <div className="terminal-header leaderboard-header">
          <div className="terminal-dots">
            <span className="dot red"></span>
            <span className="dot yellow"></span>
            <span className="dot green"></span>
          </div>
          <div className="leaderboard-header-title">
            <span>🏆</span> RE-AUDIT SPEED LEADERBOARD
            {data?.section && <span className="header-section-tag">SECTION: {data.section}</span>}
            {roomCode && <span className="header-room-tag">ROOM: {roomCode}</span>}
          </div>
          <button className="leaderboard-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Contest Callout Banner & Strategy Tip */}
        <div className="leaderboard-banner">
          <div className="banner-icon">⭐</div>
          <div className="banner-content">
            <div className="banner-main-text">
              <strong>EXTRA POINTS CONTEST:</strong> Top 10 fastest students will be awarded extra points! Total speed is the sum of your fastest completed runs across <strong>Phase 1 to Phase 7</strong>.
            </div>
            <div className="banner-tip-box">
              <span className="tip-badge">💡 PRO-TIP</span>
              <span>If you feel like you spent a lot of time in a single phase, you can <strong>re-audit as much as you want</strong>! Only your <strong>single fastest / best winning time in each phase</strong> will be recorded and added to your overall time in the rankings.</span>
            </div>
          </div>
        </div>

        {/* Room Switcher / Input Bar */}
        <div className="leaderboard-room-bar">
          <div className="room-bar-left">
            {roomCode && !showCodeInput ? (
              <div className="active-room-display">
                <span className="room-label">ROOM:</span>
                <span className="room-val">{roomCode}</span>
                {data?.section && (
                  <>
                    <span className="sep">•</span>
                    <span className="section-val">{data.section}</span>
                  </>
                )}
                <button
                  className="switch-room-link"
                  onClick={() => setShowCodeInput(true)}
                  title="Switch room code"
                >
                  Change Room
                </button>
              </div>
            ) : (
              <form onSubmit={handleSearchSubmit} className="room-search-form">
                <input
                  type="text"
                  placeholder="Enter Room Code (e.g. 9VKUEE)"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="room-code-input"
                  maxLength={10}
                  autoFocus
                />
                <button type="submit" disabled={loading || !inputCode.trim()} className="btn-load-room">
                  {loading ? 'LOADING...' : 'LOAD RANKINGS'}
                </button>
              </form>
            )}
          </div>
          <div className="room-bar-right">
            {roomCode && (
              <button
                className="btn-refresh-leaderboard"
                onClick={() => fetchLeaderboard(roomCode)}
                disabled={loading}
                title="Refresh Live Leaderboard"
              >
                <span>🔄</span> {loading ? 'UPDATING...' : 'REFRESH'}
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="leaderboard-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Stats Row */}
        {data && (
          <div className="leaderboard-stats-grid">
            <div className="stat-card">
              <span className="stat-label">ENROLLED</span>
              <strong className="stat-number">{stats.totalEnrolled}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">RE-AUDITORS</span>
              <strong className="stat-number color-cyan">{stats.reAuditors}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">7/7 MASTERED</span>
              <strong className="stat-number color-green">{stats.masteredAll}</strong>
            </div>
            <div className="stat-card highlight-card">
              <span className="stat-label">⚡ #1 SPEED RECORD</span>
              {stats.leader ? (
                <div className="leader-info">
                  <span className="leader-name" title={stats.leader.fullName}>{stats.leader.fullName}</span>
                  <strong className="leader-time">{formatTimerDigits(stats.leader.totalFastestSeconds)}</strong>
                </div>
              ) : (
                <span className="no-leader">Awaiting Contenders</span>
              )}
            </div>
          </div>
        )}

        {/* Controls: Tabs & Search */}
        {data && (
          <div className="leaderboard-controls">
            <div className="filter-tabs">
              <button
                className={`tab-btn ${filterTab === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterTab('ALL')}
              >
                ALL PARTICIPANTS ({data.rankings.length})
              </button>
              <button
                className={`tab-btn ${filterTab === 'TOP10' ? 'active' : ''}`}
                onClick={() => setFilterTab('TOP10')}
              >
                ⭐ TOP 10 AWARD RECIPIENTS ({Math.min(10, data.rankings.filter(r => r.isTop10).length)})
              </button>
              <button
                className={`tab-btn ${filterTab === 'MASTERED' ? 'active' : ''}`}
                onClick={() => setFilterTab('MASTERED')}
              >
                ✔️ 7/7 MASTERED ({stats.masteredAll})
              </button>
            </div>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search student name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>
          </div>
        )}

        {/* Rankings List / Table */}
        <div className="leaderboard-content-scroll">
          {loading && !data && (
            <div className="leaderboard-state-message">
              <div className="loading-spinner"></div>
              <p>Calculating live Re-Audit speeds for Room {roomCode}...</p>
            </div>
          )}

          {!loading && !data && !error && (
            <div className="leaderboard-state-message">
              <span className="empty-icon">🎮</span>
              <p>Enter your Section Room Code above to display the Re-Audit Leaderboard.</p>
            </div>
          )}

          {data && filteredRankings.length === 0 && (
            <div className="leaderboard-state-message">
              <span className="empty-icon">🔍</span>
              <p>No students match the current filter or search criteria.</p>
            </div>
          )}

          {data && filteredRankings.length > 0 && (
            <div className="rankings-table">
              <div className="table-header-row">
                <span className="col-rank">RANK</span>
                <span className="col-student">STUDENT PARTICIPANT</span>
                <span className="col-progress">RE-AUDIT PROGRESS</span>
                <span className="col-time">FASTEST TOTAL TIME</span>
                <span className="col-actions">BREAKDOWN</span>
              </div>

              {filteredRankings.map((student) => {
                const isMe = currentStudentNumber && student.studentNumber === currentStudentNumber;
                const isExpanded = expandedStudent === student.studentNumber;
                const rankClass =
                  student.rank === 1
                    ? 'rank-gold'
                    : student.rank === 2
                    ? 'rank-silver'
                    : student.rank === 3
                    ? 'rank-bronze'
                    : student.isTop10
                    ? 'rank-top10'
                    : 'rank-standard';

                return (
                  <div
                    key={student.studentNumber}
                    className={`ranking-row-container ${rankClass} ${isMe ? 'is-current-user' : ''}`}
                  >
                    <div className="ranking-row">
                      {/* Rank Col */}
                      <div className="col-rank">
                        <div className={`rank-badge ${rankClass}`}>
                          {student.rank === 1 && '🥇'}
                          {student.rank === 2 && '🥈'}
                          {student.rank === 3 && '🥉'}
                          {student.rank > 3 && `#${student.rank}`}
                        </div>
                      </div>

                      {/* Student Info Col */}
                      <div className="col-student">
                        <div className="student-name-group">
                          <strong className="student-full-name">{student.fullName}</strong>
                          {isMe && <span className="you-tag">YOU</span>}
                          {student.isTop10 && (
                            <span className="top10-tag" title="Extra points award contender">
                              ⭐ TOP 10
                            </span>
                          )}
                        </div>
                        <span className="student-id-sub">ID: {student.studentNumber}</span>
                      </div>

                      {/* Progress / Mastery Col */}
                      <div className="col-progress">
                        <div className="progress-badge-wrapper">
                          {student.isMasteredAll ? (
                            <span className="mastery-pill full">
                              ✔️ 7 / 7 MASTERED
                            </span>
                          ) : student.completedPhasesCount > 0 ? (
                            <span className="mastery-pill partial">
                              {student.completedPhasesCount} / 7 PHASES
                            </span>
                          ) : student.hasReAudited ? (
                            <span className="mastery-pill in-progress">
                              IN PROGRESS (0/7)
                            </span>
                          ) : (
                            <span className="mastery-pill none">
                              NO RE-AUDITS
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cumulative Fastest Time Col */}
                      <div className="col-time">
                        {student.completedPhasesCount > 0 ? (
                          <div className="time-display-group">
                            <span className="time-timer-val">
                              ⏱️ {formatTimerDigits(student.totalFastestSeconds)}
                            </span>
                            <span className="time-words-val">
                              {student.totalFastestFormatted}
                            </span>
                          </div>
                        ) : (
                          <span className="time-empty">--:--</span>
                        )}
                      </div>

                      {/* Actions / Breakdown Toggle Col */}
                      <div className="col-actions">
                        <button
                          type="button"
                          className={`btn-toggle-breakdown ${isExpanded ? 'active' : ''}`}
                          onClick={() => setExpandedStudent(isExpanded ? null : student.studentNumber)}
                          title="View Phase 1 to 7 breakdown"
                        >
                          {isExpanded ? '▲ HIDE' : '▼ PHASES'}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Phase 1 to Phase 7 Breakdown */}
                    {isExpanded && (
                      <div className="phase-breakdown-panel">
                        <div className="breakdown-header">
                          <span>FASTEST RE-AUDIT RUN PER PHASE (P1 - P7):</span>
                          <span className="breakdown-sum-note">
                            Total Speed = Sum of completed phase winning times
                          </span>
                        </div>
                        <div className="phase-chips-grid">
                          {student.phaseBreakdown.map((p) => {
                            return (
                              <div
                                key={p.phaseId}
                                className={`phase-chip ${p.isCompleted ? 'completed' : p.hasReAudited ? 'active' : 'empty'}`}
                              >
                                <span className="chip-phase-num">P{p.phaseId}</span>
                                <span className="chip-phase-time">
                                  {p.isCompleted && p.fastestSeconds > 0
                                    ? formatTimerDigits(p.fastestSeconds)
                                    : p.hasReAudited
                                    ? 'IN RUN'
                                    : '--:--'}
                                </span>
                                <span className="chip-phase-status">
                                  {p.isCompleted ? '✔️ WIN' : p.hasReAudited ? '🔄' : '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="leaderboard-footer">
          <div className="footer-legend">
            <span>🥇 #1 Gold</span>
            <span>🥈 #2 Silver</span>
            <span>🥉 #3 Bronze</span>
            <span className="legend-top10">⭐ Top 10 = Extra Points Awardees</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
