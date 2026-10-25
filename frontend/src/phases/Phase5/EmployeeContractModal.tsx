import React from 'react';
import '../../components/Shared/Popups.css';

interface EmployeeContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  basicSalary: number;
}

/**
 * Retro-styled modal for Phase 5 Employee Contract Profile (SSS).
 */
export default function EmployeeContractModal({ isOpen, onClose, basicSalary }: EmployeeContractModalProps) {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>X</button>
        <div className="popup-content">
          <div className="popup-header">
            <h4>📁 Employee Profile & Contract (SSS Audit)</h4>
            <p>Classified HR Document // Form 109-E</p>
          </div>

          <div className="data-box authentic-data" style={{ padding: '15px', lineHeight: '1.5' }}>
            <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>Employee Name:</span> <strong>Juan Dela Cruz</strong>
            </div>
            <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>Monthly Basic Salary (Gross Pay):</span> <strong className="highlight-green">₱{basicSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
            <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Mid-Year Bonus Advance:</span> <strong>₱8,000.00</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
