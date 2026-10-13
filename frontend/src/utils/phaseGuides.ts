export interface PhaseGuide {
  phaseId: number;
  title: string;
  roomName: string;
  phaseDifficulty?: string;
  guideDifficulty?: string;
  variablesToFind: {
    name: string;
    location: string;
    description: string;
  }[];
  formula: string;
  walkthrough: {
    title: string;
    given: string;
    steps: string[];
    result: string;
    tip: string;
  };
}

export const PHASE_GUIDES: Record<number, PhaseGuide> = {
  1: {
    phaseId: 1,
    title: 'Phase 1: Basic Gross Pay',
    roomName: 'The Morning Lobby',
    variablesToFind: [
      {
        name: 'Daily Basic Rate (Daily Wage)',
        location: 'HR Contract Folder on the Office Desk',
        description: 'The agreed base daily compensation rate before non-wage allowances or overtime.'
      },
      {
        name: 'Days Worked (Shifts Present)',
        location: 'Official Wall Calendar on the June Grid',
        description: 'Count only the weekday shifts marked with "P" (Present). Decoy days (absent/weekend) do not count.'
      }
    ],
    formula: 'Basic Gross Pay = Daily Basic Rate × Days Worked',
    walkthrough: {
      title: 'Step-by-Step Calculation Walkthrough',
      given: 'Daily Basic Rate = ₱500.00 | Days Worked = 10 shifts',
      steps: [
        'Step 1: Identify the daily rate: ₱500.00',
        'Step 2: Identify total days worked: 10 days',
        'Step 3: Multiply Daily Rate by Days Worked: ₱500.00 × 10 = ₱5,000.00'
      ],
      result: 'Computed Basic Pay = ₱5,000.00',
      tip: 'Do not add allowance noise (like Uniform or Rice Subsidy)—standard labor audits only compute authentic basic wages.'
    }
  },
  2: {
    phaseId: 2,
    title: 'Phase 2: Tardiness Deductions',
    roomName: 'Factory Floor & Biometrics Checkpoint',
    variablesToFind: [
      {
        name: 'Hourly Pay Rate (Regular Wage)',
        location: 'Employee Contract in the Filing Cabinet',
        description: 'Derived from Daily Rate ÷ 8 standard shift hours.'
      },
      {
        name: 'Tardiness (Late Minutes)',
        location: 'Biometrics Terminal Clock-in Ledger',
        description: 'Sum of late minutes clocked in past 8:00 AM (ignore early arrivals!).'
      }
    ],
    formula: 'Tardiness Deduction = (Hourly Pay Rate ÷ 60) × Tardiness Minutes',
    walkthrough: {
      title: 'Tardiness Deduction Calculation Walkthrough',
      given: 'Hourly Rate = ₱60.00 | Late Minutes = 10 minutes',
      steps: [
        'Step 1: Compute the per-minute wage: ₱60.00 ÷ 60 minutes = ₱1.00 per minute',
        'Step 2: Multiply minute rate by late minutes: ₱1.00 × 10 minutes = ₱10.00'
      ],
      result: 'Total Tardiness Deduction = ₱10.00',
      tip: 'Under DOLE standards, early clock-in minutes cannot offset, deduct, or cancel out late arrival minutes.'
    }
  },
  3: {
    phaseId: 3,
    title: 'Phase 3: Overtime Premiums',
    roomName: 'Production Line & Supervisor Desk',
    variablesToFind: [
      {
        name: 'Hourly Pay Rate',
        location: 'Production Shift Records',
        description: 'Base hourly wage rate for the employee.'
      },
      {
        name: 'Recorded Overtime Hours',
        location: 'Production Time Card Punch Clock',
        description: 'Total raw overtime shift hours logged on the production floor.'
      },
      {
        name: 'Unpaid Lunch Break (1.0 Hr)',
        location: 'DOLE Factory Notice Board Policy',
        description: 'Mandatory 1-hour meal breaks are non-compensable and must be deducted from raw OT.'
      },
      {
        name: 'DOLE Overtime Multiplier',
        location: 'Labor Code Article 87 Poster',
        description: 'Standard regular day overtime receives a 125% (1.25x) wage multiplier.'
      }
    ],
    formula: 'Overtime Pay = Hourly Rate × (Recorded OT Hours − 1.0 hr Unpaid Lunch) × 1.25',
    walkthrough: {
      title: 'Overtime Pay Calculation Walkthrough',
      given: 'Hourly Rate = ₱100.00 | Recorded OT = 3.0 Hours | Unpaid Lunch = 1.0 Hour',
      steps: [
        'Step 1 (Filter Lunch): 3.0 hrs − 1.0 hr lunch = 2.0 True OT Hours',
        'Step 2 (Base Wage): ₱100.00 × 2.0 hrs = ₱200.00 base overtime wages',
        'Step 3 (Apply 1.25x DOLE Premium): ₱200.00 × 1.25 = ₱250.00'
      ],
      result: 'Final Overtime Premium Pay = ₱250.00',
      tip: 'Always subtract the 1-hour unpaid lunch break first before multiplying by the 1.25 DOLE premium factor.'
    }
  },
  4: {
    phaseId: 4,
    title: 'Phase 4: Regular Holiday Pay',
    roomName: 'Factory Breakroom & Corkboard',
    variablesToFind: [
      {
        name: 'Daily Basic Rate',
        location: 'Timesheet Terminal Records',
        description: 'The employee contracted daily compensation rate.'
      },
      {
        name: 'Holiday Classification',
        location: 'Corkboard DOLE Holiday Memo (RA 9849)',
        description: 'Determine if the shift fell on an official Regular Holiday (200% / 2.0x double pay) vs Special Day (130% / 1.3x).'
      }
    ],
    formula: 'Regular Holiday Pay = Daily Basic Rate × 2.00 (Double Pay)',
    walkthrough: {
      title: 'Regular Holiday Pay Calculation Walkthrough',
      given: 'Daily Rate = ₱500.00 | Worked full shift on Independence Day (Regular Holiday)',
      steps: [
        'Step 1: Confirm holiday type is a Regular Holiday (multiplier = 2.0x / 200%)',
        'Step 2: Multiply daily wage by 2.0: ₱500.00 × 2.00 = ₱1,000.00'
      ],
      result: 'Final Regular Holiday Pay = ₱1,000.00',
      tip: 'Working on an official Regular Holiday entitles the worker to 200% (double pay) under RA 9849.'
    }
  },
  5: {
    phaseId: 5,
    title: 'Phase 5: SSS Deductions',
    roomName: 'PC Lab / Bureaucracy Department',
    variablesToFind: [
      {
        name: 'SSS Employee Share (EE)',
        location: 'SSS Contribution Matrix Corkboard',
        description: 'Lookup the employee bracket share (ignore employer ER share decoy!).'
      },
      {
        name: 'Personal Salary Loan',
        location: 'PC Monitor Loan Ledger',
        description: 'Monthly salary loan amortization (ignore spouse loan decoy!).'
      },
      {
        name: 'Pag-IBIG Statutory Deduction',
        location: 'HDMF Circular Notice',
        description: 'Standard statutory employee deduction share (₱200.00).'
      }
    ],
    formula: 'Total SSS & Statutory Deductions = SSS EE Share + Personal Salary Loan + Pag-IBIG (₱200)',
    walkthrough: {
      title: 'Statutory Deductions Calculation Walkthrough',
      given: 'SSS EE Share = ₱500.00 | Personal Loan = ₱300.00 | Pag-IBIG = ₱200.00',
      steps: [
        'Step 1: Extract Employee EE Share: ₱500.00 (ignore employer ER share)',
        'Step 2: Extract Personal Salary Loan: ₱300.00 (ignore spouse loan)',
        'Step 3: Include Pag-IBIG statutory share: ₱200.00',
        'Step 4: Sum all statutory deductions: ₱500.00 + ₱300.00 + ₱200.00 = ₱1,000.00'
      ],
      result: 'Total Deductions = ₱1,000.00',
      tip: 'Do not deduct employer (ER) contributions or spouse loans from the employee pay slip.'
    }
  },
  6: {
    phaseId: 6,
    title: 'Phase 6: PhilHealth Premiums & Tax',
    roomName: 'PC Lab & Statutory Database',
    variablesToFind: [
      {
        name: 'Monthly Basic Salary',
        location: 'HR Salary Database PC Terminal',
        description: 'Base monthly wage before deductions.'
      },
      {
        name: 'PhilHealth Employee Rate',
        location: 'PhilHealth Premium Memo Board',
        description: 'Statutory 2.5% (0.025) employee contribution share.'
      },
      {
        name: 'Taxable Income & Withholding Tax',
        location: 'BIR TRAIN Law Tax Bracket Table',
        description: 'Taxable Income = Basic Salary − (SSS + Pag-IBIG + PhilHealth).'
      }
    ],
    formula: 'PhilHealth EE = Basic Salary × 0.025 | Tax = 0% if Taxable Income ≤ ₱20,833.00',
    walkthrough: {
      title: 'PhilHealth & Withholding Tax Walkthrough',
      given: 'Basic Salary = ₱20,000.00 | SSS EE = ₱900.00 | Pag-IBIG = ₱200.00',
      steps: [
        'Step 1 (PhilHealth EE): ₱20,000.00 × 0.025 = ₱500.00',
        'Step 2 (Total Statutory): ₱900.00 + ₱200.00 + ₱500.00 = ₱1,600.00',
        'Step 3 (Taxable Income): ₱20,000.00 − ₱1,600.00 = ₱18,400.00',
        'Step 4 (BIR Tax): ₱18,400.00 is ≤ ₱20,833.00, so Withholding Tax is ₱0.00 (Exempt)'
      ],
      result: 'PhilHealth EE = ₱500.00 | Total Statutory = ₱1,600.00 | Tax = ₱0.00',
      tip: 'Under the TRAIN Law, monthly taxable income up to ₱20,833 is 100% tax-exempt.'
    }
  },
  7: {
    phaseId: 7,
    title: 'Phase 7: Net Payroll Boardroom',
    roomName: 'The Executive Boardroom',
    variablesToFind: [
      {
        name: 'Master Compensation Profile',
        location: 'Executive Audit Folder on Conference Table',
        description: 'Contains Basic Pay, Overtime, Holiday Pay, Tardiness, and all Statutory Deductions.'
      }
    ],
    formula: 'Gross = Basic + OT + Holiday | Deductions = Late + SSS + Pag-IBIG + PhilHealth + Tax | Net Pay = Gross − Deductions',
    walkthrough: {
      title: 'Net Payroll Synthesis Walkthrough',
      given: 'Basic = ₱10,000.00 | OT = ₱1,000.00 | Holiday = ₱0.00 | Late = ₱100.00 | Statutory = ₱1,500.00 | Tax = ₱0.00',
      steps: [
        'Step 1 (Gross Earnings): ₱10,000.00 + ₱1,000.00 + ₱0.00 = ₱11,000.00',
        'Step 2 (Total Deductions): ₱100.00 + ₱1,500.00 + ₱0.00 = ₱1,600.00',
        'Step 3 (Net Take-Home Pay): ₱11,000.00 − ₱1,600.00 = ₱9,400.00'
      ],
      result: 'Final Net Pay = ₱9,400.00',
      tip: 'The Boardroom synthesizes all previous phases. Calculate Gross first, then Deductions, and subtract Deductions from Gross.'
    }
  }
};
