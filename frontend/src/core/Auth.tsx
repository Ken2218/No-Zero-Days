import React, { useState } from 'react';
import API_BASE_URL from '../config';
import './Auth.css';

export default function Login({ onLoginSuccess, onTeacherCreateRoom, onStudentJoinRoom }) {
  const [studentNumber, setStudentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('GRADE12-ABM');
  const [section, setSection] = useState('GRADE12-ABM'); // kept for backward compatibility
  const [teacherSection, setTeacherSection] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isTeacher = role === 'OM-TEACHER';

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    setRole(newRole);
    setSection(newRole); // For backward compatibility with student registration
    setError('');
  };

  // Student registration (standard login)
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (!studentNumber.trim() || !fullName.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/students/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentNumber: studentNumber.trim(),
          fullName: fullName.trim(),
          section: '' // Section will be inherited when student joins teacher's room
        })
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errBody = await response.text();
          errorDetail += `: ${errBody.substring(0, 200)}`;
        } catch (_) { }
        throw new Error(`Backend error — ${errorDetail}`);
      }

      const student = await response.json();
      localStorage.setItem('student', JSON.stringify(student));
      onLoginSuccess(student);
    } catch (err) {
      console.error('[Auth] Login error:', err);
      setError(err.message || 'Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  // Teacher: Login
  const handleTeacherSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!teacherSection.trim()) {
      setError('Please enter your section (e.g., Grade 12 - ABM A).');
      return;
    }
    if (!teacherEmail.trim()) {
      setError('Please enter your email address to receive completion reports.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(teacherEmail.trim())) {
      setError('Please enter a valid email address (e.g., teacher@school.edu).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if teacher already has an existing active room for this name and section
      let existingCode = '';
      let existingSection = teacherSection.trim();
      try {
        const queryParams = new URLSearchParams({
          teacherName: fullName.trim(),
          section: teacherSection.trim(),
          teacherEmail: teacherEmail.trim()
        });
        console.log('[Auth] Checking for existing room:', { teacherName: fullName.trim(), section: teacherSection.trim() });
        const findRes = await fetch(`${API_BASE_URL}/api/rooms/find-by-teacher?${queryParams.toString()}`);
        if (findRes.ok) {
          const findData = await findRes.json();
          console.log('[Auth] find-by-teacher response:', findData);
          if (findData.found && findData.roomCode) {
            existingCode = findData.roomCode;
            // Use the section from the existing room if available
            if (findData.section) {
              existingSection = findData.section;
            }
          }
        } else {
          console.warn('[Auth] find-by-teacher returned non-OK status:', findRes.status);
        }
      } catch (checkErr) {
        console.warn('[Auth] Room recovery check error:', checkErr);
      }

      // Store teacher info in localStorage with restored room code
      localStorage.setItem('teacher', JSON.stringify({
        teacherName: fullName.trim(),
        teacherEmail: teacherEmail.trim(),
        section: existingSection,
        roomCode: existingCode
      }));
      if (existingCode) {
        localStorage.setItem('teacherRoomStatus', 'ACTIVE');
        console.log('[Auth] Recovered existing room:', existingCode, 'section:', existingSection);
      }

      onTeacherCreateRoom(existingCode, fullName.trim(), existingSection, teacherEmail.trim());
    } catch (err) {
      console.error('[Auth] Login error:', err);
      setError('Failed to login.');
    } finally {
      setLoading(false);
    }
  };

  // Student: Join Room logic moved to Dashboard

  return (
    <div className="auth-container">
      <div className="glow-overlay"></div>
      <div className="scanlines"></div>

      <div className="auth-card">
        <div className="terminal-header">
          <span className="dot red"></span>
          <span className="dot yellow"></span>
          <span className="dot green"></span>
          <span className="terminal-title">NO_ZERO_DAYS_LOGIN.EXE</span>
        </div>

        <div className="auth-body">
          <div className="logo-section">
            <h1 className="title-glow">NO ZERO DAYS!</h1>
            <p className="subtitle">Interactive Philippine Payroll Simulator</p>
          </div>

          <form onSubmit={isTeacher ? handleTeacherSubmit : handleStudentSubmit} className="auth-form">
            {error && <div className="error-banner">{error}</div>}

            {/* Student Number — only for Students */}
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
                />
              </div>
            )}

            {/* Teacher Fields: Email & Section */}
            {isTeacher && (
              <>
                <div className="input-group">
                  <label>EMAIL ADDRESS (FOR STUDENT REPORTS)</label>
                  <input
                    type="email"
                    placeholder="e.g., teacher@school.edu"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    disabled={loading}
                    className="retro-input"
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Phase time &amp; attempt reports will be sent here upon student completion.
                  </span>
                </div>

                <div className="input-group">
                  <label>SECTION</label>
                  <input
                    type="text"
                    placeholder="e.g., Grade 12 - ABM A"
                    value={teacherSection}
                    onChange={(e) => setTeacherSection(e.target.value)}
                    disabled={loading}
                    className="retro-input"
                  />
                </div>
              </>
            )}

            <div className="input-group">
              <label>FULL NAME</label>
              <input
                type="text"
                placeholder="e.g., Juan Dela Cruz"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                className="retro-input"
              />
            </div>

            <div className="input-group">
              <label>ROLE</label>
              <select
                value={role}
                onChange={handleRoleChange}
                disabled={loading}
                className="retro-select"
              >
                <option value="GRADE12-ABM">Grade 12 ABM Student</option>
                <option value="OM-TEACHER">O&amp;M Teacher</option>
                <option value="COLLEGE-STUDENT">College Student</option>
              </select>
            </div>

            {/* Teacher: Login button */}
            {isTeacher && (
              <button type="submit" disabled={loading} className="login-btn">
                {loading ? 'LOGGING IN...' : 'LOGIN >'}
              </button>
            )}

            {/* Student: Login / Register button */}
            {!isTeacher && (
              <>
                <button type="submit" disabled={loading} className="login-btn">
                  {loading ? 'CONNECTING...' : 'LOGIN / REGISTER >'}
                </button>
              </>
            )}
          </form>
        </div>

        <div className="auth-footer">
          <span>CIT-U // Grade 12 ABM Capstone</span>
        </div>
      </div>


    </div>
  );
}
