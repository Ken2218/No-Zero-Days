import React, { useState, useEffect } from 'react';
import './OnboardingGuide.css';

interface OnboardingGuideProps {
  /** When true the modal is visible */
  isOpen: boolean;
  /** Called when the user dismisses the guide */
  onClose: () => void;
}

// ── Slide content ────────────────────────────────────────────────────────────
interface GuideSlide {
  step: number;
  icon: string;
  title: string;
  accentColor: string;
  body: React.ReactNode;
}

const SLIDES: GuideSlide[] = [
  {
    step: 1,
    icon: '🗺️',
    title: 'WELCOME TO NO ZERO DAYS',
    accentColor: '#facc15',
    body: (
      <>
        <p className="og-intro-text">
          You are a <strong>Payroll Auditor</strong> working your way through 7 rooms of a
          fictional company. Each room teaches a real Philippine payroll concept —
          from basic gross pay all the way to final net take-home pay.
        </p>
        <div className="og-highlight-box og-highlight--amber">
          <span className="og-highlight-icon">🎯</span>
          <div>
            <strong>Your Mission:</strong> Complete all 7 audit rooms by correctly
            extracting data from the room, identifying the correct formula, and computing
            the right payroll value.
          </div>
        </div>
        <div className="og-stat-row">
          <div className="og-stat">
            <span className="og-stat-num">7</span>
            <span className="og-stat-label">Audit Rooms</span>
          </div>
          <div className="og-stat">
            <span className="og-stat-num">3</span>
            <span className="og-stat-label">Modules</span>
          </div>
          <div className="og-stat">
            <span className="og-stat-num">100%</span>
            <span className="og-stat-label">Target Score</span>
          </div>
        </div>
      </>
    ),
  },
  {
    step: 2,
    icon: '🏢',
    title: 'HOW TO READ A ROOM',
    accentColor: '#60a5fa',
    body: (
      <>
        <p className="og-intro-text">
          Every room contains <strong>clickable objects</strong> outlined with a glowing
          border. Clicking them opens a document, poster, or terminal that contains the
          payroll data you need.
        </p>
        <div className="og-step-list">
          <div className="og-step-item">
            <span className="og-step-badge" style={{ background: '#1e3a8a', color: '#60a5fa' }}>1</span>
            <div>
              <strong>Scan the room</strong> — look for glowing outlined areas. These are
              interactive hotspots (desks, calendars, terminals, corkboards).
            </div>
          </div>
          <div className="og-step-item">
            <span className="og-step-badge" style={{ background: '#1e3a8a', color: '#60a5fa' }}>2</span>
            <div>
              <strong>Click each hotspot</strong> — a popup document will open with the
              employee data you need to solve the payroll step.
            </div>
          </div>
          <div className="og-step-item">
            <span className="og-step-badge" style={{ background: '#1e3a8a', color: '#60a5fa' }}>3</span>
            <div>
              <strong>Use the ⓘ hint icons</strong> in the Audit Log panel on the right —
              they tell you exactly which room object holds each variable.
            </div>
          </div>
        </div>
        <div className="og-highlight-box og-highlight--blue">
          <span className="og-highlight-icon">💡</span>
          <div>The <strong>Scientific Calculator</strong> button on the left edge of the screen
          can be opened anytime to help you crunch numbers.</div>
        </div>
      </>
    ),
  },
  {
    step: 3,
    icon: '📋',
    title: 'THE COGNITIVE AUDIT LOG',
    accentColor: '#10b981',
    body: (
      <>
        <p className="og-intro-text">
          The <strong>Cognitive Audit Log</strong> panel on the right side of every room is
          your step-by-step task checklist. Complete each step in order to unlock the next.
        </p>
        <div className="og-step-list">
          <div className="og-step-item">
            <span className="og-step-badge" style={{ background: '#064e3b', color: '#34d399' }}>①</span>
            <div><strong>Step 1 — Variable Extraction:</strong> Enter the key payroll values
            you found inside the room (e.g. Daily Rate, Days Present).</div>
          </div>
          <div className="og-step-item">
            <span className="og-step-badge" style={{ background: '#064e3b', color: '#34d399' }}>②</span>
            <div><strong>Step 2 — Identify Formula:</strong> Select the correct payroll
            equation from the dropdown (e.g. Daily Rate × Days Present).</div>
          </div>
          <div className="og-step-item">
            <span className="og-step-badge" style={{ background: '#064e3b', color: '#34d399' }}>③</span>
            <div><strong>Step 3 — Execute Arithmetic:</strong> Enter the final computed
            monetary value. The system validates it against the correct answer.</div>
          </div>
        </div>
        <div className="og-badge-row">
          <span className="og-status-badge" style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid #facc15', color: '#facc15' }}>ACTIVE</span>
          <span className="og-status-badge" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', color: '#10b981' }}>SUCCESS</span>
          <span className="og-status-badge" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', color: '#ef4444' }}>ERROR</span>
          <span className="og-status-badge" style={{ background: 'rgba(100,116,139,0.12)', border: '1px solid #64748b', color: '#64748b' }}>LOCKED</span>
        </div>
      </>
    ),
  },
  {
    step: 4,
    icon: '🚪',
    title: 'COMPLETING A ROOM & THE EXIT DOOR',
    accentColor: '#a78bfa',
    body: (
      <>
        <p className="og-intro-text">
          Once all audit steps are marked <strong style={{ color: '#10b981' }}>SUCCESS</strong>,
          the room is complete. Click the <strong>Exit Door</strong> hotspot inside the room
          to trigger the completion screen.
        </p>
        <div className="og-highlight-box og-highlight--purple">
          <span className="og-highlight-icon">🚪</span>
          <div>
            <strong>Exit Door popup</strong> gives you two choices:
            <ul className="og-door-list">
              <li><strong style={{ color: '#10b981' }}>PROCEED →</strong> Move to the next room in the sequence.</li>
              <li><strong style={{ color: '#f59e0b' }}>REROLL SCENARIO →</strong> Generate a fresh random payroll scenario to practice again.</li>
            </ul>
          </div>
        </div>
        <div className="og-highlight-box og-highlight--green" style={{ marginTop: '10px' }}>
          <span className="og-highlight-icon">📊</span>
          <div>
            Your <strong>Audit Score</strong> starts at 100% and drops 10% per wrong
            answer attempt (floor: 50%). Your best score is saved to your profile!
          </div>
        </div>
      </>
    ),
  },
  {
    step: 5,
    icon: '🚨',
    title: 'THE 3-STRIKE SYSTEM',
    accentColor: '#ef4444',
    body: (
      <>
        <p className="og-intro-text">
          Each <strong>Step 1 (Variable Extraction)</strong> has a 3-Strike limit. Enter the
          wrong values three times in a row and the system automatically rerolls to a new
          scenario — so read the room carefully first!
        </p>
        <div className="og-strike-demo">
          <div className="og-strike-row">
            <span className="og-strike og-strike--warn">⚠️ Attempt 1</span>
            <span className="og-strike-msg">Warning issued. 2 attempts remaining.</span>
          </div>
          <div className="og-strike-row">
            <span className="og-strike og-strike--danger">🚨 Attempt 2</span>
            <span className="og-strike-msg">Critical warning. 1 attempt remaining!</span>
          </div>
          <div className="og-strike-row">
            <span className="og-strike og-strike--critical">💥 Attempt 3</span>
            <span className="og-strike-msg">Auto-reroll triggered. New scenario generated.</span>
          </div>
        </div>
        <div className="og-highlight-box og-highlight--red" style={{ marginTop: '12px' }}>
          <span className="og-highlight-icon">🎭</span>
          <div><strong>Red Herring Alert:</strong> Some scenarios contain deliberate decoys in
          the room. If you submit a red herring value, the scenario resets immediately
          regardless of your attempt count.</div>
        </div>
      </>
    ),
  },
  {
    step: 6,
    icon: '🏆',
    title: 'READY TO AUDIT — TIPS FOR SUCCESS',
    accentColor: '#34d399',
    body: (
      <>
        <div className="og-tip-grid">
          <div className="og-tip-card">
            <span className="og-tip-icon">🔍</span>
            <strong>Read EVERY object</strong>
            <p>Open all hotspots before submitting — the data is always in the room.</p>
          </div>
          <div className="og-tip-card">
            <span className="og-tip-icon">ⓘ</span>
            <strong>Use hint icons</strong>
            <p>Each input field has an ⓘ button that tells you exactly where to look.</p>
          </div>
          <div className="og-tip-card">
            <span className="og-tip-icon">🧮</span>
            <strong>Use the calculator</strong>
            <p>The slide-out scientific calculator is always available on the left edge.</p>
          </div>
          <div className="og-tip-card">
            <span className="og-tip-icon">📖</span>
            <strong>Check the Field Guide</strong>
            <p>Click &quot;START AUDIT &gt;&quot; on any phase card for a formula walkthrough before entering.</p>
          </div>
          <div className="og-tip-card">
            <span className="og-tip-icon">🎯</span>
            <strong>Practice freely</strong>
            <p>Every completed room can be re-audited. New scenarios generate each time.</p>
          </div>
          <div className="og-tip-card">
            <span className="og-tip-icon">❓</span>
            <strong>Revisit this guide</strong>
            <p>Click the <strong>[ ? GUIDE ]</strong> button on the dashboard anytime.</p>
          </div>
        </div>
      </>
    ),
  },
];

// ── Component ────────────────────────────────────────────────────────────────
export default function OnboardingGuide({ isOpen, onClose }: OnboardingGuideProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Reset to first slide whenever modal opens
  useEffect(() => {
    if (isOpen) setCurrentSlide(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const slide = SLIDES[currentSlide];
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === SLIDES.length - 1;

  const goTo = (index: number) => {
    if (animating || index === currentSlide) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentSlide(index);
      setAnimating(false);
    }, 180);
  };

  const handleClose = () => {
    localStorage.setItem('hasSeenTutorial', 'true');
    onClose();
  };

  return (
    <div className="og-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-label="Onboarding Guide">
      <div
        className="og-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ borderTop: `4px solid ${slide.accentColor}` }}
      >
        {/* ── Terminal title bar ── */}
        <div className="og-terminal-bar">
          <span className="og-dot og-dot--red" />
          <span className="og-dot og-dot--yellow" />
          <span className="og-dot og-dot--green" />
          <span className="og-terminal-title">AUDITOR_ONBOARDING_GUIDE.EXE</span>
          <button className="og-close-btn" onClick={handleClose} aria-label="Close guide">✕</button>
        </div>

        {/* ── Progress bar ── */}
        <div className="og-progress-track">
          <div
            className="og-progress-fill"
            style={{
              width: `${((currentSlide + 1) / SLIDES.length) * 100}%`,
              backgroundColor: slide.accentColor,
            }}
          />
        </div>

        {/* ── Step header ── */}
        <div className="og-slide-header">
          <span className="og-step-counter">STEP {slide.step} / {SLIDES.length}</span>
          <span className="og-slide-icon">{slide.icon}</span>
          <h2 className="og-slide-title" style={{ color: slide.accentColor }}>
            {slide.title}
          </h2>
        </div>

        {/* ── Slide body ── */}
        <div className={`og-slide-body ${animating ? 'og-slide-body--fade' : ''}`}>
          {slide.body}
        </div>

        {/* ── Dot navigation ── */}
        <div className="og-dots">
          {SLIDES.map((s, i) => (
            <button
              key={i}
              className={`og-dot-btn ${i === currentSlide ? 'og-dot-btn--active' : ''}`}
              style={i === currentSlide ? { backgroundColor: slide.accentColor } : {}}
              onClick={() => goTo(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* ── Footer navigation ── */}
        <div className="og-footer">
          <button
            className="og-nav-btn og-nav-btn--secondary"
            onClick={() => goTo(currentSlide - 1)}
            disabled={isFirst}
          >
            ← PREV
          </button>

          <span className="og-skip-link" onClick={handleClose}>
            SKIP GUIDE
          </span>

          {isLast ? (
            <button
              className="og-nav-btn og-nav-btn--primary"
              style={{ backgroundColor: slide.accentColor, color: '#000' }}
              onClick={handleClose}
            >
              START AUDITING ✓
            </button>
          ) : (
            <button
              className="og-nav-btn og-nav-btn--primary"
              style={{ backgroundColor: slide.accentColor, color: '#000' }}
              onClick={() => goTo(currentSlide + 1)}
            >
              NEXT →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
