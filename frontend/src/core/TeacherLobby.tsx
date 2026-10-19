import React, { useState, useEffect, useCallback, useRef } from 'react';
import API_BASE_URL from '../config';
import './TeacherLobby.css';

interface Participant {
  studentNumber: string;
  fullName: string;
  section: string;
  joinedAt: string;
}

interface TeacherLobbyProps {
  roomCode: string;
  teacherName: string;
  section: string;
  onInitiateSession: () => void;
  onBack: () => void;
  onRoomCreated: (code: string) => void;
}

export default function TeacherLobby({ roomCode, teacherName, section, onInitiateSession, onBack, onRoomCreated }: TeacherLobbyProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState('');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [customRoomCode, setCustomRoomCode] = useState('');

  // Add Student state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudentNumber, setNewStudentNumber] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState('');

  // Delete student loading state
  const [deletingStudentNum, setDeletingStudentNum] = useState<string | null>(null);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCustomRoomCode(code);
  };

  // Fetch participants from backend
  const fetchParticipants = useCallback(async () => {
    if (!roomCode) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/participants`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
        setParticipantCount(data.participantCount || 0);
      }
    } catch (err) {
      console.error('[TeacherLobby] Failed to fetch participants:', err);
    }
  }, [roomCode]);

  // Poll every 3 seconds for new participants, but ONLY if a room is active
  useEffect(() => {
    if (roomCode) {
      fetchParticipants(); // Initial fetch
      pollIntervalRef.current = setInterval(fetchParticipants, 3000);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchParticipants, roomCode]);

  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);
    setError('');

    try {
      const payload: Record<string, string> = {
        teacherName: teacherName,
        section: section
      };
      if (customRoomCode.trim()) {
        payload.roomCode = customRoomCode.trim().toUpperCase();
      }
      const response = await fetch(`${API_BASE_URL}/api/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errorDetail = errData.error || errorDetail;
        } catch (_) {
          const errBody = await response.text();
          if (errBody) errorDetail += `: ${errBody.substring(0, 150)}`;
        }
        throw new Error(errorDetail);
      }

      const data = await response.json();
      
      // Update localStorage
      const saved = localStorage.getItem('teacher');
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.roomCode = data.roomCode;
        localStorage.setItem('teacher', JSON.stringify(parsed));
      }

      onRoomCreated(data.roomCode);
    } catch (err: any) {
      console.error('[TeacherLobby] Create room error:', err);
      setError(err.message || 'Failed to create room.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Copy room code to clipboard
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Fallback
    });
  };

  // Initiate the session
  const handleInitiate = async () => {
    if (participantCount === 0) {
      setError('Cannot start a session with no students. Add or wait for students to join.');
      return;
    }
    setInitiating(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        // Stop polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        onInitiateSession();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to start session.');
      }
    } catch (err) {
      console.error('[TeacherLobby] Initiate error:', err);
      setError('Network error. Cannot connect to server.');
    } finally {
      setInitiating(false);
    }
  };

  // Add student manually
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentNumber.trim() || !newStudentName.trim()) {
      setAddStudentError('Student number and full name are required.');
      return;
    }
    setIsAddingStudent(true);
    setAddStudentError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentNumber: newStudentNumber.trim(),
          fullName: newStudentName.trim(),
          section: section
        })
      });
      if (res.ok) {
        setNewStudentNumber('');
        setNewStudentName('');
        setShowAddModal(false);
        fetchParticipants();
      } else {
        const data = await res.json().catch(() => ({}));
        setAddStudentError(data.error || 'Failed to add student.');
      }
    } catch (err: any) {
      setAddStudentError(err.message || 'Connection error.');
    } finally {
      setIsAddingStudent(false);
    }
  };

  // Remove student from room
  const handleRemoveStudent = async (studentNum: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${studentName} (${studentNum}) from the room?`)) {
      return;
    }
    setDeletingStudentNum(studentNum);
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${roomCode}/students/${studentNum}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchParticipants();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to remove student.');
      }
    } catch (err: any) {
      alert('Error removing student: ' + err.message);
    } finally {
      setDeletingStudentNum(null);
    }
  };

  return (
    <div className="lobby-container">
      <div className="glow-overlay"></div>
      <div className="scanlines"></div>

      <div className="lobby-card">
        <div className="terminal-header">
          <span className="dot red"></span>
          <span className="dot yellow"></span>
          <span className="dot green"></span>
          <span className="terminal-title">NO_ZERO_DAYS_ROOM.EXE</span>
        </div>

        <div className="lobby-body">
          {/* Room Creation UI (if room not yet created) */}
          {!roomCode ? (
            <div style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #334155', borderRadius: '8px', marginBottom: '20px' }}>
              <h3 style={{ color: '#fbbf24', marginTop: 0 }}>GENERATE A CLASSROOM</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>
                Create a room session to generate a passcode for your enrolled students.
              </p>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#60a5fa', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '5px' }}>ROOM CODE (Optional)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="text" 
                    placeholder="E.G., NZD4X9"
                    value={customRoomCode}
                    onChange={(e) => setCustomRoomCode(e.target.value.toUpperCase())}
                    disabled={isCreatingRoom}
                    maxLength={10}
                    style={{ flex: 1, padding: '10px', background: '#0b1120', border: '1px solid #334155', color: '#fff', fontSize: '1.2rem', letterSpacing: '3px', textTransform: 'uppercase' }}
                  />
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    disabled={isCreatingRoom}
                    style={{ padding: '0 15px', background: '#1e293b', border: '1px solid #475569', color: '#cbd5e1', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🎲 GENERATE
                  </button>
                </div>
                <span style={{ color: '#475569', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  Leave blank for a random 6-character code.
                </span>
              </div>

              <button 
                onClick={handleCreateRoom}
                disabled={isCreatingRoom}
                style={{ width: '100%', padding: '12px', background: '#3b82f6', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' }}
              >
                {isCreatingRoom ? 'CREATING...' : 'CREATE ROOM >'}
              </button>
            </div>
          ) : (
            <div className="room-code-display" onClick={handleCopyCode} title="Click to copy code">
              <span className="room-code-label">SHARE THIS ROOM CODE WITH YOUR STUDENTS</span>
              <div className="room-code-value">{roomCode}</div>
              <span className="room-code-hint">Click anywhere to copy</span>
              {copied && <span className="copied-toast">COPIED!</span>}
            </div>
          )}

          {/* Room Info */}
          <div className="room-info-bar">
            <div className="room-info-item">
              <span>TEACHER: </span><strong>{teacherName}</strong>
            </div>
            <div className="room-info-item">
              <span>SECTION: </span><strong>{section || 'N/A'}</strong>
            </div>
            <button className="lobby-back-btn" onClick={onBack}>[ EXIT ROOM ]</button>
          </div>

          {/* Action Row & Student Counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div className="student-counter" style={{ margin: 0 }}>
              <span className="counter-icon">👥</span>
              <span className="counter-text">{participantCount} STUDENT{participantCount !== 1 ? 'S' : ''} ENROLLED</span>
              <div className="counter-pulse"></div>
            </div>

            {roomCode && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid #3b82f6',
                  color: '#60a5fa',
                  padding: '8px 14px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>➕</span> ADD STUDENT
              </button>
            )}
          </div>

          {/* Student List */}
          <div className="student-list-container">
            <div className="student-list-header" style={{ gridTemplateColumns: '40px 1.5fr 1.2fr 80px' }}>
              <span>#</span>
              <span>STUDENT NAME</span>
              <span>STUDENT NUMBER</span>
              <span style={{ textAlign: 'right' }}>ACTION</span>
            </div>
            {participants.length === 0 ? (
              <div className="empty-list-message">
                <span className="empty-icon">📡</span>
                Waiting for students to join using code <strong style={{ color: '#facc15' }}>{roomCode}</strong> or add them manually above.
              </div>
            ) : (
              participants.map((p, index) => (
                <div key={p.studentNumber} className="student-list-row" style={{ gridTemplateColumns: '40px 1.5fr 1.2fr 80px', animationDelay: `${index * 0.05}s`, alignItems: 'center' }}>
                  <span className="row-index">{index + 1}</span>
                  <span style={{ fontWeight: 'bold' }}>{p.fullName}</span>
                  <span style={{ color: '#94a3b8' }}>{p.studentNumber}</span>
                  <div style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      disabled={deletingStudentNum === p.studentNumber}
                      onClick={() => handleRemoveStudent(p.studentNumber, p.fullName)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid #ef4444',
                        color: '#f87171',
                        padding: '3px 8px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                      title="Remove from room"
                    >
                      {deletingStudentNum === p.studentNumber ? '...' : 'DELETE'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '4px',
              fontSize: '0.85rem',
              marginBottom: '15px'
            }}>
              {error}
            </div>
          )}

          {/* Initiate Session Button */}
          <button
            className="initiate-btn"
            onClick={handleInitiate}
            disabled={initiating || participantCount === 0 || !roomCode}
          >
            {initiating ? 'STARTING SESSION...' : `INITIATE SESSION > (${participantCount} STUDENT${participantCount !== 1 ? 'S' : ''})`}
          </button>
        </div>

        <div className="lobby-footer">
          <span>Room active // Students will be directed to Phase 1 after session initiation</span>
        </div>
      </div>

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '450px',
            padding: '24px',
            boxShadow: '0 0 30px rgba(59, 130, 246, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ color: '#60a5fa', margin: 0, fontSize: '1.2rem' }}>➕ ENROLL NEW STUDENT</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {addStudentError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '12px' }}>
                {addStudentError}
              </div>
            )}

            <form onSubmit={handleAddStudent}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px' }}>STUDENT NUMBER / ID</label>
                <input
                  type="text"
                  placeholder="e.g., 2024-00142"
                  value={newStudentNumber}
                  onChange={(e) => setNewStudentNumber(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#0b1120', border: '1px solid #334155', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px' }}>FULL NAME</label>
                <input
                  type="text"
                  placeholder="e.g., Maria Santos"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#0b1120', border: '1px solid #334155', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isAddingStudent}
                  style={{ padding: '8px 18px', background: '#3b82f6', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {isAddingStudent ? 'ADDING...' : 'CONFIRM & ADD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
