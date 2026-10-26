import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { authFetch } from '../../utils/api';
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
  totalCompleted7Count?: number;
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
      const res = await authFetch(`/api/rooms/${trimmed}/reaudit-rankings`);
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

  // Only participants who completed all 7 phases are shown on the list
  const filteredRankings = useMemo(() => {
    if (!data?.rankings) return [];
    return data.rankings.filter((item) => {
      // Must have completed all 7 phases
      if (item.completedPhasesCount < 7) return false;

      // Optional search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.fullName.toLowerCase().includes(query);
        const matchesNum = item.studentNumber.toLowerCase().includes(query);
        return matchesName || matchesNum;
      }
      return true;
    });
  }, [data, searchQuery]);

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
              <strong>EXTRA POINTS CONTEST:</strong> Top 10 fastest students will be awarded extra points! Total speed is the sum of your fastest completed runs across <strong>Phase 1 to Phase 7</strong>. Only participants who completed all 7 re-audit phases are ranked.
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

        {/* Single Tab Header Bar & Search Filter */}
        {data && (
          <div className="leaderboard-single-tab-bar">
            <div className="single-tab-pill">
              <span className="pill-trophy">⚡</span>
              <span className="pill-text">7-PHASE RE-AUDIT SPEED RANKINGS</span>
              <span className="pill-badge">{filteredRankings.length} {filteredRankings.length === 1 ? 'CONTENDER' : 'CONTENDERS'}</span>
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
            <div className="leaderboard-state-message leaderboard-empty-contenders">
              <span className="empty-icon">⏳</span>
              <h3 className="empty-title">Awaiting 7-Phase Re-Audit Contenders</h3>
              <p className="empty-desc">
                Only students who have completed the re-audit of <strong>all 7 phases (Phase 1 to Phase 7)</strong> will appear on this speed leaderboard.
              </p>
              <div className="empty-tip-note">
                💡 Re-audit any phase as many times as you like — your single fastest winning time in each phase will automatically be counted towards your overall time!
              </div>
            </div>
          )}

          {data && filteredRankings.length > 0 && (
            <div className="rankings-table">
              <div className="table-header-row">
                <span className="col-rank">RANK</span>
                <span className="col-student">STUDENT PARTICIPANT</span>
                <span className="col-time">TOTAL RE-AUDIT TIME (7 PHASES)</span>
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

                      {/* Cumulative Fastest Time Col */}
                      <div className="col-time">
                        <div className="time-display-group">
                          <span className="time-timer-val">
                            ⏱️ {formatTimerDigits(student.totalFastestSeconds)}
                          </span>
                          <span className="time-words-val">
                            {student.totalFastestFormatted}
                          </span>
                        </div>
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
                            Total Speed = Sum of your fastest winning times across all 7 phases
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
