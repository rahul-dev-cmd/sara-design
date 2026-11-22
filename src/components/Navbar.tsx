import React from 'react';

interface NavbarProps {
  onLaunchSimulation: () => void;
}

/**
 * Strict 3-zone Top Bar Contract:
 * [Brand wordmark] — [5 single-line nav links] — [1 primary CTA]
 */
export const Navbar: React.FC<NavbarProps> = ({ onLaunchSimulation }) => {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#0b0f14]/94">
      <div className="mx-auto flex h-14 max-w-[1380px] items-center justify-between gap-8 px-5 sm:px-8">
        <a
          href="#hero"
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          SARA
        </a>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#9aa7b8]"
        >
          <a href="#journey" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Problem
          </a>
          <a href="#explorer" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            3D Explorer
          </a>
          <a href="#electronics" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Electronics
          </a>
          <a href="#specs-bom" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Specs &amp; BOM
          </a>
          <a href="#safety-roadmap" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Safety &amp; Plan
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onLaunchSimulation}
            className="rounded-md bg-[#ff7a1a] px-4 py-2 text-xs font-semibold text-[#0b0f14] hover:bg-[#ff8e3c] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Concept Simulation
          </button>
        </div>
      </div>
    </header>
  );
};
