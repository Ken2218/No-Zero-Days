import React, { useState } from 'react';
import API_BASE_URL from '../config';
import './Auth.css';

interface LoginProps {
  onLoginSuccess: (student: any) => void;
  onTeacherCreateRoom: (roomCode: string, teacherName: string, section: string, teacherEmail: string) => void;
  onStudentJoinRoom?: (roomCode: string, student: any) => void;
}

export default function Login({ onLoginSuccess, onTeacherCreateRoom }: LoginProps) {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [studentNumber, setStudentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'GRADE12-ABM' | 'OM-TEACHER'>('GRADE12-ABM');
  const [teacherSection, setTeacherSection] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isTeacher = role === 'OM-TEACHER';

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as 'GRADE12-ABM' | 'OM-TEACHER';
    setRole(newRole);
    setError('');
  };

  const validateTeacherEmail = (email: string) => {
    const gmailRegex = /^[^\s@]+@gmail\.com$/i;
    return gmailRegex.test(email.trim());
  };

  // Student: Login handler (existing account check)
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNumber.trim()) {
      setError('Please enter your Student Number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const trimmedId = studentNumber.trim();
      const trimmedName = fullName.trim();

      const payload: Record<string, any> = {
        studentNumber: trimmedId,
        role: role
      };

      if (trimmedName) {
        payload.name = trimmedName;
        payload.fullName = trimmedName;
      }

      // Primary endpoint /api/auth/login with fallback to /api/students/login
      let response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.status === 404 || response.status === 405) {
        response = await fetch(`${API_BASE_URL}/api/students/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        let errMessage = 'Login failed.';
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch (_) {
          const errText = await response.text();
          if (errText) errMessage = errText;
        }
        throw new Error(errMessage);
      }

      const student = await response.json();
      localStorage.setItem('student', JSON.stringify(student));
      onLoginSuccess(student);
    } catch (err: any) {
      console.error('[Auth] Student Login error:', err);
      setError(err.message || 'Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  // Student: Sign Up handler (register new profile)
  const handleStudentSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNumber.trim() || !fullName.trim()) {
      setError('Please fill in both Student Number and Full Name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        studentNumber: studentNumber.trim(),
        name: fullName.trim(),
        fullName: fullName.trim(),
        role: role,
        section: '' // Inherited upon joining teacher room
      };

      let response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.status === 404 || response.status === 405) {
        response = await fetch(`${API_BASE_URL}/api/students/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        let errMessage = 'Sign up failed.';
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch (_) {
          const errText = await response.text();
          if (errText) errMessage = errText;
        }
        throw new Error(errMessage);
      }

      const student = await response.json();
      localStorage.setItem('student', JSON.stringify(student));
      onLoginSuccess(student);
    } catch (err: any) {
      console.error('[Auth] Student Sign Up error:', err);
      setError(err.message || 'Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  // Teacher: Login handler (Master Teacher Account)
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherEmail.trim()) {
      setError('Please enter your Gmail address (e.g., teacher@gmail.com).');
      return;
    }
    if (!validateTeacherEmail(teacherEmail)) {
      setError('Please enter a valid Gmail address ending in @gmail.com (e.g., teacher@gmail.com).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Authenticate Teacher via Master Account endpoint
      let teacherData: any = null;
      try {
        const payload = {
          email: teacherEmail.trim(),
          teacherEmail: teacherEmail.trim(),
          name: fullName.trim(),
          fullName: fullName.trim(),
          role: role
        };

        let loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (loginRes.status === 404 || loginRes.status === 405) {
          loginRes = await fetch(`${API_BASE_URL}/api/teachers/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        if (loginRes.ok) {
          teacherData = await loginRes.json();
        } else if (loginRes.status === 404) {
          // If master account not found and name provided, try registering
          if (fullName.trim()) {
            let regRes = await fetch(`${API_BASE_URL}/api/auth/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (regRes.status === 404 || regRes.status === 405) {
              regRes = await fetch(`${API_BASE_URL}/api/teachers/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
            }
            if (regRes.ok) {
              teacherData = await regRes.json();
            }
          }
          if (!teacherData) {
            const errJson = await loginRes.json().catch(() => ({}));
            throw new Error(errJson.error || `No account found for ${teacherEmail.trim()}. Please switch to Sign Up.`);
          }
        } else {
          const errJson = await loginRes.json().catch(() => ({}));
          throw new Error(errJson.error || 'Teacher login failed.');
        }
      } catch (authFetchErr: any) {
        if (authFetchErr.message && !authFetchErr.message.includes('fetch')) {
          throw authFetchErr;
        }
        // Fallback for offline/legacy server response
        teacherData = {
          email: teacherEmail.trim(),
          fullName: fullName.trim() || 'O&M Teacher'
        };
      }

      const effectiveName = teacherData?.fullName || fullName.trim() || 'O&M Teacher';
      const effectiveEmail = teacherData?.email || teacherEmail.trim();

      // 2. Fetch existing rooms for this teacher
      let activeCode = '';
      let activeSection = '';
      try {
        const roomsRes = await fetch(`${API_BASE_URL}/api/teachers/rooms?email=${encodeURIComponent(effectiveEmail)}`);
        if (roomsRes.ok) {
          const rooms = await roomsRes.json();
          if (Array.isArray(rooms) && rooms.length > 0) {
            activeCode = rooms[0].roomCode || '';
            activeSection = rooms[0].section || '';
          }
        }
      } catch (_) {}

      // Fallback lookup via /rooms/find-by-teacher if /teachers/rooms was empty
      if (!activeCode) {
        try {
          const findRes = await fetch(`${API_BASE_URL}/api/rooms/find-by-teacher?teacherEmail=${encodeURIComponent(effectiveEmail)}`);
          if (findRes.ok) {
            const findData = await findRes.json();
            if (findData.found && findData.roomCode) {
              activeCode = findData.roomCode;
              activeSection = findData.section || '';
            }
          }
        } catch (_) {}
      }

      const teacherStorage = {
        teacherId: teacherData?.id,
        teacherName: effectiveName,
        teacherEmail: effectiveEmail,
        section: activeSection,
        roomCode: activeCode
      };
      localStorage.setItem('teacher', JSON.stringify(teacherStorage));
      if (activeCode) {
        localStorage.setItem('teacherRoomStatus', 'ACTIVE');
      }

      onTeacherCreateRoom(activeCode, effectiveName, activeSection, effectiveEmail);
    } catch (err: any) {
      console.error('[Auth] Teacher Login error:', err);
      setError(err.message || 'Failed to login.');
    } finally {
      setLoading(false);
    }
  };

  // Teacher: Sign Up handler (Master Teacher Account Creation)
  const handleTeacherSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!teacherEmail.trim()) {
      setError('Please enter your Gmail address (e.g., teacher@gmail.com).');
      return;
    }
    if (!validateTeacherEmail(teacherEmail)) {
      setError('Please enter a valid Gmail address ending in @gmail.com (e.g., teacher@gmail.com).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create or register Master Teacher Account
      let teacherData: any = null;
      try {
        const payload = {
          email: teacherEmail.trim(),
          teacherEmail: teacherEmail.trim(),
          name: fullName.trim(),
          fullName: fullName.trim(),
          role: role,
          section: teacherSection.trim()
        };

        let regRes = await fetch(`${API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (regRes.status === 404 || regRes.status === 405) {
          regRes = await fetch(`${API_BASE_URL}/api/teachers/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        if (regRes.ok) {
          teacherData = await regRes.json();
        } else {
          const errJson = await regRes.json().catch(() => ({}));
          throw new Error(errJson.error || 'Failed to register teacher account.');
        }
      } catch (regErr: any) {
        if (regErr.message && !regErr.message.includes('fetch')) {
          throw regErr;
        }
        teacherData = {
          email: teacherEmail.trim(),
          fullName: fullName.trim()
        };
      }

      const effectiveName = teacherData?.fullName || fullName.trim();
      const effectiveEmail = teacherData?.email || teacherEmail.trim();
      const initialSectionName = teacherSection.trim() || 'Grade 12 - ABM A';

      // 2. Optionally create the initial classroom room for this teacher
      let initialRoomCode = '';
      try {
        const createRes = await fetch(`${API_BASE_URL}/api/rooms/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacherName: effectiveName,
            teacherEmail: effectiveEmail,
            section: initialSectionName
          })
        });
        if (createRes.ok) {
          const roomData = await createRes.json();
          initialRoomCode = roomData.roomCode || '';
        }
      } catch (createErr) {
        console.warn('[Auth] Initial room creation error:', createErr);
      }

      const teacherStorage = {
        teacherId: teacherData?.id,
        teacherName: effectiveName,
        teacherEmail: effectiveEmail,
        section: initialSectionName,
        roomCode: initialRoomCode
      };
      localStorage.setItem('teacher', JSON.stringify(teacherStorage));
      if (initialRoomCode) {
        localStorage.setItem('teacherRoomStatus', 'ACTIVE');
      }

      onTeacherCreateRoom(initialRoomCode, effectiveName, initialSectionName, effectiveEmail);
    } catch (err: any) {
      console.error('[Auth] Teacher Sign Up error:', err);
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (authMode === 'LOGIN') {
      if (isTeacher) {
        handleTeacherLogin(e);
      } else {
        handleStudentLogin(e);
      }
    } else {
      if (isTeacher) {
        handleTeacherSignup(e);
      } else {
        handleStudentSignup(e);
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="glow-overlay"></div>
      <div className="scanlines"></div>

      <div className="auth-card">
        <div className="terminal-header">
          <span className="dot red"></span>
          <span className="dot yellow"></span>
          <span className="dot green"></span>
          <span className="terminal-title">No Zero Days: Payroll Simulator</span>
        </div>

        <div className="auth-body">
          <div className="logo-section">
            <h1 className="title-glow" style={{ fontSize: '1.9rem', letterSpacing: '0.5px' }}>
              No Zero Days: Payroll Simulator
            </h1>
            <p className="subtitle">Interactive Philippine Payroll Accounting Laboratory</p>
          </div>

          {/* Unmerged Login & Sign Up Navigation Tabs */}
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'LOGIN'}
              className={`auth-tab-btn ${authMode === 'LOGIN' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('LOGIN');
                setError('');
              }}
            >
              [ LOGIN ]
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'SIGNUP'}
              className={`auth-tab-btn ${authMode === 'SIGNUP' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('SIGNUP');
                setError('');
              }}
            >
              [ SIGN UP ]
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="error-banner">{error}</div>}

            {/* Role Selection: strictly Grade 12 ABM Student and O&M Teacher */}
            <div className="input-group">
              <label>ACCOUNT ROLE</label>
              <select
                value={role}
                onChange={handleRoleChange}
                disabled={loading}
                className="retro-select"
              >
                <option value="GRADE12-ABM">Grade 12 ABM Student</option>
                <option value="OM-TEACHER">O&amp;M Teacher</option>
              </select>
            </div>

            {/* Student ID Field — Only for Students */}
            {!isTeacher && (
              <div className="input-group">
                <label>STUDENT NUMBER</label>
                <input
                  type="text"
                  placeholder="e.g., 2026-1002"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  disabled={loading}
                  className="retro-input"
                  required
                />
              </div>
            )}

            {/* Teacher Fields: Gmail & Section */}
            {isTeacher && (
              <>
                <div className="input-group">
                  <label>GMAIL ADDRESS (FOR AUDIT REPORTS)</label>
                  <input
                    type="email"
                    placeholder="e.g., teacher@gmail.com"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    disabled={loading}
                    className="retro-input"
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Section completion summaries and Excel reports will be sent to this Gmail.
                  </span>
                </div>

                {authMode === 'SIGNUP' && (
                  <div className="input-group">
                    <label>CLASS SECTION NAME</label>
                    <input
                      type="text"
                      placeholder="e.g., Grade 12 - ABM A"
                      value={teacherSection}
                      onChange={(e) => setTeacherSection(e.target.value)}
                      disabled={loading}
                      className="retro-input"
                      required
                    />
                  </div>
                )}
              </>
            )}

            {/* Full Name Field */}
            <div className="input-group">
              <label>
                {isTeacher
                  ? 'TEACHER FULL NAME'
                  : authMode === 'LOGIN'
                  ? 'STUDENT FULL NAME (OPTIONAL)'
                  : 'STUDENT FULL NAME'}
              </label>
              <input
                type="text"
                placeholder={
                  isTeacher
                    ? 'e.g., Maria Santos'
                    : authMode === 'LOGIN'
                    ? 'Optional during login (e.g., Juan Dela Cruz)'
                    : 'e.g., Juan Dela Cruz'
                }
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                className="retro-input"
                required={authMode === 'SIGNUP' || isTeacher}
              />
            </div>

            {/* Action Submit Button */}
            <button type="submit" disabled={loading} className="login-btn">
              {loading
                ? (authMode === 'LOGIN' ? 'AUTHENTICATING...' : 'CREATING ACCOUNT...')
                : (authMode === 'LOGIN' ? 'LOG IN >' : 'SIGN UP >')}
            </button>
          </form>

          {/* Quick tab switcher prompt */}
          <div className="auth-switch-prompt">
            {authMode === 'LOGIN' ? (
              <span>
                New user?{' '}
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => {
                    setAuthMode('SIGNUP');
                    setError('');
                  }}
                >
                  Create an account
                </button>
              </span>
            ) : (
              <span>
                Already registered?{' '}
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setError('');
                  }}
                >
                  Log in to your account
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="auth-footer" style={{ borderTop: '1px solid #1e293b' }}>
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
            Philippine Labor &amp; Payroll Compliance Simulation
          </span>
        </div>
      </div>
    </div>
  );
}
