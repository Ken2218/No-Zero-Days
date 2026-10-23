import React, { useState } from 'react';
import pclabImage from '../../assets/phase5-6-pclab.png';
import '../../components/Shared/room-base.css';
import '../../components/Shared/Room.css';
import './Phase5.css';
import EmployeeContractModal from './EmployeeContractModal';
import PagIbigMemoModal from './PagIbigMemoModal';

interface Phase5RoomProps {
  setActivePopup: (popupName: string | null) => void;
  scenario: any;
}

/**
 * TSX Component managing hotspots for Phase 5 (SSS Deductions).
 */
export default function Phase5Room({ setActivePopup, scenario }: Phase5RoomProps) {
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [isPagIbigOpen, setIsPagIbigOpen] = useState(false);

  const handleOpenContract = () => {
    if (setActivePopup) setActivePopup('P5_CONTRACT');
    else setIsContractOpen(true);
  };

  const handleOpenPagIbig = () => {
    if (setActivePopup) setActivePopup('PAGIBIG_MEMO');
    else setIsPagIbigOpen(true);
  };

  return (
    <div className="room-container pclab-floor phase5-room" style={{ position: 'relative' }}>
      <img 
        src={pclabImage} 
        alt="PC Lab / Bureaucracy Department" 
        className="background-image"
      />
      {/* Hotspot 1: Notice Board Corkboard Memos */}
      <button 
        className="hotspot corkboard-hotspot" 
        title="📌 SSS Contribution Table" 
        onClick={() => setActivePopup('SSS_TABLE')}
      >
        <span className="hotspot-badge">📌 SSS TABLE</span>
      </button>

      {/* Hotspot 2: PC Monitor (Loan Statement / HR Database) */}
      <button 
        className="hotspot monitor-hotspot" 
        title="🖥️ Employee Loan Statement" 
        onClick={() => setActivePopup('LOAN_STATEMENT')}
      >
        <span className="hotspot-badge">🖥️ LOAN STATEMENT</span>
      </button>

      {/* Hotspot 3: Exit Door */}
      <button 
        className="hotspot door-hotspot" 
        title="🚪 PC Lab Exit Door" 
        onClick={() => setActivePopup('DOOR')}
      >
        <span className="hotspot-badge">🚪 EXIT DOOR</span>
      </button>

      {/* Hotspot 4: Company Payroll Manual */}
      <button 
        className="hotspot handbook-hotspot" 
        title="📘 Company Payroll Manual" 
        onClick={() => setActivePopup('HANDBOOK')}
      >
        <span className="hotspot-badge">📘 MANUAL</span>
      </button>

      {/* Hotspot 5: Employee Contract Folder */}
      <button 
        className="hotspot contract-hotspot" 
        title="📁 Employee Contract Profile" 
        onClick={handleOpenContract}
      >
        <span className="hotspot-badge">📁 CONTRACT</span>
      </button>

      {/* Hotspot 6: HDMF Pag-IBIG Memo Circular */}
      <button 
        className="hotspot pagibig-hotspot" 
        title="📋 HDMF Pag-IBIG Circular" 
        onClick={handleOpenPagIbig}
      >
        <span className="hotspot-badge">📋 PAG-IBIG</span>
      </button>

      {/* Fallback Modals if setActivePopup is not available */}
      <EmployeeContractModal 
        isOpen={isContractOpen} 
        onClose={() => setIsContractOpen(false)} 
        basicSalary={scenario?.basicSalary ?? 0}
      />

      <PagIbigMemoModal 
        isOpen={isPagIbigOpen} 
        onClose={() => setIsPagIbigOpen(false)} 
      />
    </div>
  );
}
