import React, { useState, useCallback, useEffect, useRef } from 'react';
import './Calculator.css';

// ==========================================
// BASIC ARITHMETIC EXPRESSION EVALUATOR
// ==========================================

const tokenize = (str: string) => {
  const rawTokens: any[] = [];
  let i = 0;
  while (i < str.length) {
    const char = str[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let numStr = '';
      while (i < str.length && /[0-9.]/.test(str[i])) {
        numStr += str[i];
        i++;
      }
      rawTokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }
    if ('+-*/%()'.includes(char)) {
      rawTokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }
    i++;
  }
  return rawTokens;
};

class BasicParser {
  tokens: any[];
  index: number;

  constructor(tokens: any[]) {
    this.tokens = tokens;
    this.index = 0;
  }

  peek() {
    return this.tokens[this.index] || null;
  }

  consume() {
    return this.tokens[this.index++];
  }

  parse() {
    if (this.tokens.length === 0) return 0;
    const val = this.expression();
    return val;
  }

  expression(): number {
    let val = this.term();
    while (true) {
      const next = this.peek();
      if (next && next.type === 'OPERATOR' && (next.value === '+' || next.value === '-')) {
        this.consume();
        const rhs = this.term();
        if (next.value === '+') val += rhs;
        else val -= rhs;
      } else {
        break;
      }
    }
    return val;
  }

  term(): number {
    let val = this.unary();
    while (true) {
      const next = this.peek();
      if (next && next.type === 'OPERATOR' && (next.value === '*' || next.value === '/' || next.value === '%')) {
        this.consume();
        const rhs = this.unary();
        if (next.value === '*') {
          val *= rhs;
        } else if (next.value === '/') {
          if (rhs === 0) throw new Error('Division by zero');
          val /= rhs;
        } else if (next.value === '%') {
          val = val % rhs;
        }
      } else {
        break;
      }
    }
    return val;
  }

  unary(): number {
    const next = this.peek();
    if (next && next.type === 'OPERATOR' && next.value === '+') {
      this.consume();
      return this.unary();
    }
    if (next && next.type === 'OPERATOR' && next.value === '-') {
      this.consume();
      return -this.unary();
    }
    return this.primary();
  }

  primary(): number {
    const token = this.peek();
    if (!token) throw new Error('Incomplete expression');

    if (token.type === 'NUMBER') {
      this.consume();
      return token.value;
    }

    if (token.type === 'OPERATOR' && token.value === '(') {
      this.consume();
      const val = this.expression();
      const close = this.peek();
      if (close && close.type === 'OPERATOR' && close.value === ')') {
        this.consume();
      }
      return val;
    }

    throw new Error('Invalid syntax');
  }
}

export const evaluateExpression = (expr: string): number => {
  // Normalize visually styled operators to standard arithmetic chars
  let cleaned = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .trim();

  // Handle percentages, e.g. 50% -> (50 / 100)
  cleaned = cleaned.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

  const tokens = tokenize(cleaned);
  const parser = new BasicParser(tokens);
  const result = parser.parse();

  if (isNaN(result) || !isFinite(result)) {
    throw new Error('Math error');
  }

  // Round floating point quirks cleanly
  return Math.round(result * 1e9) / 1e9;
};

// ==========================================
// CALCULATOR COMPONENT
// ==========================================

interface CalculatorProps {
  isVisible: boolean;
  onToggle: () => void;
}

export default function Calculator({ isVisible, onToggle }: CalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Floating Draggable Launcher Tab state (allows moving closed button out of room hotspots on mobile)
  const [isDragging, setIsDragging] = useState(false);
  const [dockSide, setDockSide] = useState<'left' | 'right'>('left');
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dockTop, setDockTop] = useState<number | null>(null);

  const pointerStartRef = useRef<{
    startX: number;
    startY: number;
    btnStartX: number;
    btnStartY: number;
    hasMoved: boolean;
    pointerId: number;
  } | null>(null);

  const wasDraggingRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Repositioning drag handlers for closed launcher button (touch + mouse)
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only allow dragging when calculator is closed
    if (isVisible) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const btn = btnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    pointerStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      btnStartX: rect.left,
      btnStartY: rect.top,
      hasMoved: false,
      pointerId: e.pointerId
    };

    try {
      btn.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerStartRef.current || pointerStartRef.current.pointerId !== e.pointerId) return;

    const { startX, startY, btnStartX, btnStartY, hasMoved } = pointerStartRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Movement threshold (6px) before initiating drag
    if (!hasMoved && Math.hypot(dx, dy) < 6) {
      return;
    }

    pointerStartRef.current.hasMoved = true;
    if (!isDragging) setIsDragging(true);

    const btn = btnRef.current;
    const btnWidth = btn ? btn.offsetWidth : 40;
    const btnHeight = btn ? btn.offsetHeight : 90;

    const newX = Math.max(0, Math.min(window.innerWidth - btnWidth, btnStartX + dx));
    const newY = Math.max(50, Math.min(window.innerHeight - btnHeight - 20, btnStartY + dy));

    setDragPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerStartRef.current || pointerStartRef.current.pointerId !== e.pointerId) return;

    const { hasMoved } = pointerStartRef.current;
    const btn = btnRef.current;
    try {
      btn?.releasePointerCapture(e.pointerId);
    } catch (_) {}

    pointerStartRef.current = null;
    setIsDragging(false);

    if (hasMoved && dragPos) {
      wasDraggingRef.current = true;
      const btnWidth = btn ? btn.offsetWidth : 40;
      const btnHeight = btn ? btn.offsetHeight : 90;
      const isCloserToRight = dragPos.x >= (window.innerWidth - btnWidth) / 2;

      setDockSide(isCloserToRight ? 'right' : 'left');
      setDockTop(Math.max(50, Math.min(window.innerHeight - btnHeight - 20, dragPos.y)));
      setDragPos(null);
    } else {
      setDragPos(null);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerStartRef.current || pointerStartRef.current.pointerId !== e.pointerId) return;
    try {
      btnRef.current?.releasePointerCapture(e.pointerId);
    } catch (_) {}
    pointerStartRef.current = null;
    setIsDragging(false);
    setDragPos(null);
  };

  const handleClick = () => {
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    onToggle();
  };

  // Keep button within screen bounds on screen resize / rotation
  useEffect(() => {
    const handleResize = () => {
      setDockTop(prev => {
        if (prev === null) return null;
        const btnHeight = btnRef.current ? btnRef.current.offsetHeight : 90;
        const maxTop = window.innerHeight - btnHeight - 20;
        return Math.max(50, Math.min(maxTop, prev));
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const copyToClipboard = (text: string) => {
    if (text === 'Error' || !text) return;
    navigator.clipboard.writeText(text);
  };

  const handleKeyPress = useCallback((value: string) => {
    setError('');

    // Clear All (C)
    if (value === 'C') {
      setDisplay('0');
      setExpression('');
      setIsEvaluated(false);
      return;
    }

    // Clear Entry (CE)
    if (value === 'CE') {
      setDisplay('0');
      setIsEvaluated(false);
      return;
    }

    // Backspace (⌫)
    if (value === '⌫') {
      if (isEvaluated || display === 'Error') {
        setDisplay('0');
        setExpression('');
        setIsEvaluated(false);
        return;
      }
      setDisplay(prev => {
        if (prev.length <= 1) return '0';
        // If ends with whitespace from operator, trim cleanly
        if (prev.endsWith(' ')) {
          return prev.trimEnd().slice(0, -1).trimEnd();
        }
        return prev.slice(0, -1);
      });
      return;
    }

    // Calculate Equals (=)
    if (value === '=') {
      if (display === 'Error') return;
      try {
        const fullExpr = display;
        const result = evaluateExpression(fullExpr);
        const resultStr = String(result);

        setExpression(fullExpr + ' =');
        setDisplay(resultStr);
        setIsEvaluated(true);

        setHistory(prev => [fullExpr + ' = ' + resultStr, ...prev.slice(0, 9)]);
      } catch (err: any) {
        setError(err.message || 'Math error');
        setDisplay('Error');
        setIsEvaluated(true);
      }
      return;
    }

    // Decimal Point (.)
    if (value === '.') {
      if (display === 'Error' || isEvaluated) {
        setDisplay('0.');
        setExpression('');
        setIsEvaluated(false);
        return;
      }
      // Check if current number chunk already has a decimal
      const parts = display.split(/[ +−×÷%]/);
      const currentPart = parts[parts.length - 1];
      if (currentPart.includes('.')) {
        return;
      }
      setDisplay(prev => prev + '.');
      return;
    }

    // Arithmetic Operators (+, −, ×, ÷)
    if (['+', '−', '×', '÷'].includes(value)) {
      if (display === 'Error') {
        setDisplay('0 ' + value + ' ');
        setExpression('');
        setIsEvaluated(false);
        return;
      }
      if (isEvaluated) {
        setDisplay(display + ' ' + value + ' ');
        setExpression('');
        setIsEvaluated(false);
        return;
      }

      setDisplay(prev => {
        // If already ends with an operator, replace it
        if (/\s*[+−×÷]\s*$/.test(prev)) {
          return prev.replace(/\s*[+−×÷]\s*$/, ' ' + value + ' ');
        }
        return prev + ' ' + value + ' ';
      });
      return;
    }

    // Percentage (%)
    if (value === '%') {
      if (display === 'Error' || isEvaluated) {
        setDisplay('0%');
        setExpression('');
        setIsEvaluated(false);
        return;
      }
      if (display.endsWith('%') || /\s*[+−×÷]\s*$/.test(display)) {
        return;
      }
      setDisplay(prev => (prev === '0' ? '0%' : prev + '%'));
      return;
    }

    // Numbers (0-9)
    if (/[0-9]/.test(value)) {
      if (display === 'Error' || isEvaluated) {
        setDisplay(value);
        setExpression('');
        setIsEvaluated(false);
      } else {
        setDisplay(prev => (prev === '0' ? value : prev + value));
      }
    }
  }, [display, isEvaluated]);

  // Keyboard Event Listener
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT' || 
        activeEl.isContentEditable
      )) {
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key;

      if (/[0-9.]/.test(key)) {
        e.preventDefault();
        handleKeyPress(key);
      } else if (key === '+') {
        e.preventDefault();
        handleKeyPress('+');
      } else if (key === '-') {
        e.preventDefault();
        handleKeyPress('−');
      } else if (key === '*') {
        e.preventDefault();
        handleKeyPress('×');
      } else if (key === '/') {
        e.preventDefault();
        handleKeyPress('÷');
      } else if (key === '%') {
        e.preventDefault();
        handleKeyPress('%');
      } else if (key === 'Enter') {
        e.preventDefault();
        handleKeyPress('=');
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleKeyPress('⌫');
      } else if (key === 'Escape' || key === 'Delete') {
        e.preventDefault();
        handleKeyPress('C');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, handleKeyPress]);

  // Clean 4-column Basic Calculator button pad
  const BUTTONS = [
    { label: 'C',   action: () => handleKeyPress('C'),   style: 'btn-clear' },
    { label: 'CE',  action: () => handleKeyPress('CE'),  style: 'btn-clear' },
    { label: '⌫',   action: () => handleKeyPress('⌫'),   style: 'btn-clear' },
    { label: '÷',   action: () => handleKeyPress('÷'),   style: 'btn-op' },

    { label: '7',   action: () => handleKeyPress('7'),   style: 'btn-num' },
    { label: '8',   action: () => handleKeyPress('8'),   style: 'btn-num' },
    { label: '9',   action: () => handleKeyPress('9'),   style: 'btn-num' },
    { label: '×',   action: () => handleKeyPress('×'),   style: 'btn-op' },

    { label: '4',   action: () => handleKeyPress('4'),   style: 'btn-num' },
    { label: '5',   action: () => handleKeyPress('5'),   style: 'btn-num' },
    { label: '6',   action: () => handleKeyPress('6'),   style: 'btn-num' },
    { label: '−',   action: () => handleKeyPress('−'),   style: 'btn-op' },

    { label: '1',   action: () => handleKeyPress('1'),   style: 'btn-num' },
    { label: '2',   action: () => handleKeyPress('2'),   style: 'btn-num' },
    { label: '3',   action: () => handleKeyPress('3'),   style: 'btn-num' },
    { label: '+',   action: () => handleKeyPress('+'),   style: 'btn-op' },

    { label: '%',   action: () => handleKeyPress('%'),   style: 'btn-sci' },
    { label: '0',   action: () => handleKeyPress('0'),   style: 'btn-num' },
    { label: '.',   action: () => handleKeyPress('.'),   style: 'btn-num' },
    { label: '=',   action: () => handleKeyPress('='),   style: 'btn-equals' }
  ];

  return (
    <>
      {/* Sliding Calculator Panel */}
      <div className={`calc-panel ${isVisible ? 'calc-panel-visible' : ''}`}>
        {/* Header */}
        <div className="calc-header">
          <span className="calc-title">🧮 CALCULATOR</span>
          <button className="calc-close-btn" onClick={onToggle}>✕</button>
        </div>

        {/* Display */}
        <div className="calc-display-wrapper">
          <div className="calc-expression">{expression || '\u00A0'}</div>
          <div
            className="calc-display"
            onClick={() => copyToClipboard(display)}
            title={display !== 'Error' ? 'Click to copy' : ''}
          >
            {display}
          </div>
          {error ? (
            <div className="calc-error-banner">⚠️ {error}</div>
          ) : (
            <div className="calc-copy-hint">📋 click display to copy</div>
          )}
        </div>

        {/* 4-Column Basic Calculator Button Grid */}
        <div className="calc-grid">
          {BUTTONS.map((btn, i) => (
            <button
              key={i}
              className={`calc-btn ${btn.style}`}
              onClick={btn.action}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* History Log */}
        {history.length > 0 && (
          <div className="calc-history">
            <div className="calc-history-header">
              <span>📜 CALCULATION HISTORY</span>
              <button onClick={() => setHistory([])} className="calc-clear-history">CLEAR</button>
            </div>
            <div className="calc-history-list">
              {history.map((entry, i) => (
                <div
                  key={i}
                  className="calc-history-entry"
                  onClick={() => {
                    const result = entry.split('= ')[1];
                    if (result && result !== 'Error') {
                      setDisplay(result);
                      setIsEvaluated(true);
                    }
                  }}
                  title="Click to use this result"
                >
                  {entry}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QUICK FORMULAS Reference Section — strictly preserved */}
        <div className="calc-payroll-hint">
          <span style={{ color: '#60a5fa', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>💡 QUICK FORMULAS:</span>
          <code style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block', lineHeight: '1.6' }}>
            Gross = Daily Rate × Days Present<br/>
            OT Pay = HR × (OT hrs − 1.0) × 1.25<br/>
            Holiday = Daily Rate × 2.0<br/>
            PhilHealth = Basic Salary × 0.025
          </code>
        </div>
      </div>

      {/* Floating Draggable Toggle Button (repositionable when closed on mobile/desktop) */}
      <button
        ref={btnRef}
        className={`calc-toggle-btn ${isVisible ? 'calc-toggle-active' : ''} ${
          !isVisible && dockSide === 'right' ? 'calc-toggle-dock-right' : ''
        } ${isDragging ? 'calc-toggle-dragging' : ''}`}
        style={
          isDragging && dragPos
            ? {
                position: 'fixed',
                left: `${dragPos.x}px`,
                top: `${dragPos.y}px`,
                right: 'auto',
                transform: 'none',
                transition: 'none',
                zIndex: 9999
              }
            : !isVisible && dockTop !== null
            ? {
                top: `${dockTop}px`,
                transform: 'none',
                ...(dockSide === 'right' ? { left: 'auto', right: 0 } : { left: 0, right: 'auto' })
              }
            : {}
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
        title={isVisible ? 'Hide Calculator' : 'Open Calculator (Drag up/down to reposition)'}
        aria-label="Toggle Calculator"
      >
        <span className="calc-toggle-icon">🧮</span>
        <span className="calc-toggle-label">{isVisible ? 'HIDE CALC' : 'CALCULATOR'}</span>
      </button>
    </>
  );
}
