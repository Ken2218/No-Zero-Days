import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '../utils/api';
import './Auth.css';

interface StudentWaitingProps {
  roomCode: string;
  studentName: string;
  studentNumber?: string;
  onSessionStarted: () => void;
  onKickedOut: () => void;
  onBack: () => void;
}

export default function StudentWaiting({ roomCode, studentName, studentNumber, onSessionStarted, onKickedOut, onBack }: StudentWaitingProps) {
  const [status, setStatus] = useState('WAITING');
  const [participantCount, setParticipantCount] = useState(0);
  const [dots, setDots] = useState('');
  const [kickedOut, setKickedOut] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dotsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitiallyJoinedRef = useRef(false);
  const cancelledRef = useRef(false);

  // Poll for session status and membership every 2.5 seconds
  useEffect(() => {
    cancelledRef.current = false;
    const checkStatus = async () => {
      try {
        // 1. Check room status
        const res = await authFetch(`/api/rooms/${roomCode}/status`);
        if (cancelledRef.current) return;
        if (!res.ok) {
          if (res.status === 404) {
            handleKickOut();
            return;
          }
        } else {
          const data = await res.json();
          setStatus(data.status);
          setParticipantCount(data.participantCount || 0);

          if (data.status === 'ACTIVE') {
            // Session has started! Navigate to Phases dashboard
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (dotsIntervalRef.current) clearInterval(dotsIntervalRef.current);
            onSessionStarted();
            return;
          }
        }

        // 2. Check if student is still in participants list
        if (studentNumber) {
          const partRes = await authFetch(`/api/rooms/${roomCode}/participants`);
          if (cancelledRef.current) return;
          if (partRes.ok) {
            const partData = await partRes.json();
            const list = partData.participants || [];
            const isPresent = list.some((p: any) => p.studentNumber === studentNumber);

            if (isPresent) {
              hasInitiallyJoinedRef.current = true;
            } else if (hasInitiallyJoinedRef.current) {
              // Was present before, now removed by teacher!
              handleKickOut();
            }
          }
        }
      } catch (err) {
        console.error('[StudentWaiting] Poll error:', err);
      }
    };

    const handleKickOut = () => {
      if (cancelledRef.current) return;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (dotsIntervalRef.current) clearInterval(dotsIntervalRef.current);
      setKickedOut(true);
    };

    checkStatus(); // Immediate first check
    pollIntervalRef.current = setInterval(checkStatus, 2500);

    return () => {
      cancelledRef.current = true;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [roomCode, studentNumber, onSessionStarted]);

  // Animated loading dots
  useEffect(() => {
    dotsIntervalRef.current = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => {
      if (dotsIntervalRef.current) clearInterval(dotsIntervalRef.current);
    };
  }, []);

  if (kickedOut) {
    return (
      <div className="auth-container">
        <div className="glow-overlay"></div>
        <div className="scanlines"></div>

        <div className="auth-card" style={{ maxWidth: '480px', textAlign: 'center', borderColor: '#ef4444', boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)' }}>
          <div className="terminal-header" style={{ borderColor: '#ef4444' }}>
            <span className="dot red"></span>
            <span className="dot yellow"></span>
            <span className="dot green"></span>
            <span className="terminal-title" style={{ color: '#f87171' }}>ROOM_NOTICE.EXE</span>
          </div>

          <div className="auth-body" style={{ padding: '30px 20px' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>🚫</div>
            <h2 style={{ color: '#ef4444', fontSize: '1.4rem', margin: '0 0 10px 0', letterSpacing: '1px' }}>
              YOU HAVE BEEN KICKED OUT
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '25px', lineHeight: '1.5' }}>
              You were removed from room <strong style={{ color: '#facc15' }}>{roomCode}</strong> by the instructor.
            </p>
            <button
              onClick={onKickedOut}
              style={{
                width: '100%',
                padding: '12px',
                background: '#ef4444',
                border: 'none',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '4px',
                cursor: 'pointer',
                letterSpacing: '1px'
              }}
            >
              PROCEED TO PHASES &gt;
            </button>
          </div>

          <div className="auth-footer" style={{ borderColor: '#ef4444' }}>
            <span>Disconnected from classroom session</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="glow-overlay"></div>
      <div className="scanlines"></div>

      <div className="auth-card" style={{ maxWidth: '520px' }}>
        <div className="terminal-header">
          <span className="dot red"></span>
          <span className="dot yellow"></span>
          <span className="dot green"></span>
          <span className="terminal-title">NO_ZERO_DAYS_WAITING.EXE</span>
        </div>

        <div className="auth-body" style={{ textAlign: 'center' }}>
          {/* Waiting Animation */}
          <div style={{ marginBottom: '25px' }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '10px',
              animation: 'pulse-glow-border 2s infinite'
            }}>
              📡
            </div>
            <h2 style={{ color: '#facc15', fontSize: '1.4rem', margin: '0 0 8px 0' }}>
              WAITING FOR TEACHER{dots}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              Your teacher will initiate the session when everyone is ready.
            </p>
          </div>

          {/* Room Info Card */}
          <div style={{
            background: '#0b1120',
            border: '1px solid #1e293b',
            borderRadius: '6px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: '#60a5fa', fontSize: '0.85rem' }}>ROOM CODE:</span>
              <strong style={{ color: '#facc15', fontSize: '1.1rem', letterSpacing: '3px' }}>{roomCode}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: '#60a5fa', fontSize: '0.85rem' }}>YOUR NAME:</span>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{studentName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: '#60a5fa', fontSize: '0.85rem' }}>STATUS:</span>
              <strong style={{ color: status === 'ACTIVE' ? '#10b981' : '#fbbf24', fontSize: '0.95rem' }}>
                {status === 'ACTIVE' ? '✓ SESSION STARTED' : '⏳ WAITING'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#60a5fa', fontSize: '0.85rem' }}>STUDENTS IN ROOM:</span>
              <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>{participantCount}</strong>
            </div>
          </div>

          {/* Loading Bar Animation */}
          <div style={{
            width: '100%',
            height: '4px',
            background: '#1e293b',
            borderRadius: '2px',
            overflow: 'hidden',
            marginBottom: '20px'
          }}>
            <div style={{
              width: '30%',
              height: '100%',
              background: 'linear-gradient(90deg, #60a5fa, #facc15)',
              borderRadius: '2px',
              animation: 'loadingSweep 1.5s ease-in-out infinite'
            }}></div>
          </div>

          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: '#94a3b8',
              padding: '10px 20px',
              fontFamily: "'Share Tech Mono', monospace",
              cursor: 'pointer',
              borderRadius: '4px',
              fontSize: '0.85rem',
              transition: 'border-color 0.2s, color 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            [ LEAVE ROOM ]
          </button>
        </div>

        <div className="auth-footer">
          <span>Connected to room // Listening for session start signal</span>
        </div>
      </div>

      {/* Loading sweep keyframes */}
      <style>{`
        @keyframes loadingSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
