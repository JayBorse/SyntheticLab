'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  FileText,
  Table,
  FileCode,
  Check,
  Copy,
  ChevronDown,
} from 'lucide-react';
import { Button } from './Button';
import {
  SimulationExportData,
  downloadSimulationReport,
  generateMarkdownReport,
} from '@/core/synthetic-lab/report-exporter';

export interface ExportMenuProps {
  data: SimulationExportData;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  data,
  variant = 'secondary',
  size = 'sm',
  label = 'Download Reports',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadedFormat, setDownloadedFormat] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleDownload = (format: 'markdown' | 'csv' | 'json') => {
    downloadSimulationReport(data, format);
    setDownloadedFormat(format);
    setTimeout(() => {
      setDownloadedFormat(null);
      setIsOpen(false);
    }, 1200);
  };

  const handleCopyClipboard = async () => {
    const md = generateMarkdownReport(data);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(!isOpen)}
        leftIcon={<Download className="h-3.5 w-3.5" />}
        rightIcon={<ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
        className="font-mono text-xs select-none"
      >
        {label}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-72 sm:w-80 rounded-[var(--radius-lg)] bg-[var(--surface-1)] border border-[var(--border-medium)] shadow-xl z-50 p-2 space-y-1 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <span className="font-semibold text-xs text-[var(--text-primary)] block">
              Download Findings & Reports
            </span>
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
              Empirical data from {data.verdict.totalPersonas} simulated buyer personas
            </span>
          </div>

          {/* Option 1: Executive Markdown Report */}
          <button
            type="button"
            onClick={() => handleDownload('markdown')}
            className="w-full flex items-start gap-2.5 p-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors text-left cursor-pointer group"
          >
            <div className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-2)] group-hover:bg-[var(--accent-muted)] text-[var(--text-secondary)] group-hover:text-[var(--accent)] shrink-0 transition-colors">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[var(--text-primary)]">
                  Executive Teardown Report (.md)
                </span>
                {downloadedFormat === 'markdown' && (
                  <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
                Formatted markdown brief with verdict, objection frequency, and verbatim quotes.
              </p>
            </div>
          </button>

          {/* Option 2: Persona Matrix CSV */}
          <button
            type="button"
            onClick={() => handleDownload('csv')}
            className="w-full flex items-start gap-2.5 p-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors text-left cursor-pointer group"
          >
            <div className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-2)] group-hover:bg-[var(--accent-muted)] text-[var(--text-secondary)] group-hover:text-[var(--accent)] shrink-0 transition-colors">
              <Table className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[var(--text-primary)]">
                  Persona Evaluation Matrix (.csv)
                </span>
                {downloadedFormat === 'csv' && (
                  <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
                Spreadsheet ready for Excel/Sheets: budgets, roles, votes, WTP, and constraints.
              </p>
            </div>
          </button>

          {/* Option 3: Full Structured JSON */}
          <button
            type="button"
            onClick={() => handleDownload('json')}
            className="w-full flex items-start gap-2.5 p-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors text-left cursor-pointer group"
          >
            <div className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-2)] group-hover:bg-[var(--accent-muted)] text-[var(--text-secondary)] group-hover:text-[var(--accent)] shrink-0 transition-colors">
              <FileCode className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[var(--text-primary)]">
                  Complete Raw Dataset (.json)
                </span>
                {downloadedFormat === 'json' && (
                  <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
                Full structured payload: Cohort A, market evidence, optimizer fixes, and Cohort B.
              </p>
            </div>
          </button>

          {/* Divider & Copy to Clipboard */}
          <div className="pt-1 border-t border-[var(--border-subtle)] mt-1">
            <button
              type="button"
              onClick={handleCopyClipboard}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span className="text-[var(--accent)] font-semibold">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy Teardown to Clipboard</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Dedicated persistent Export Card component for embedding directly in results sections
 */
export const ExportCard: React.FC<{ data: SimulationExportData; className?: string }> = ({
  data,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadedFormat, setDownloadedFormat] = useState<string | null>(null);

  const handleDownload = (format: 'markdown' | 'csv' | 'json') => {
    downloadSimulationReport(data, format);
    setDownloadedFormat(format);
    setTimeout(() => setDownloadedFormat(null), 2000);
  };

  const handleCopyClipboard = async () => {
    const md = generateMarkdownReport(data);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`p-6 sm:p-8 rounded-2xl bg-[var(--surface-1)]/80 backdrop-blur-2xl border border-[var(--border-subtle)] space-y-6 shadow-xl ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div>
          <h3 className="font-semibold text-lg text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
            <Download className="h-5 w-5 text-blue-400" />
            Export Teardown & Findings
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Download comprehensive simulation reports for product roadmap planning, pitch deck calibration, or pricing reviews.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyClipboard}
          className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1.5 cursor-pointer shrink-0 py-2 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-all active:scale-95"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied to Clipboard</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Teardown Brief</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
        {/* Button 1: Markdown Report */}
        <button
          type="button"
          onClick={() => handleDownload('markdown')}
          className="flex flex-col items-start p-5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] hover:border-white/20 hover:bg-[var(--surface-hover)] transition-all text-left cursor-pointer group hover:-translate-y-0.5 shadow-sm hover:shadow-md"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              Executive Report
            </span>
            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] bg-[var(--surface-3)] px-2 py-0.5 rounded-full">
              .MD
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Full teardown with tables, quotes, objection frequencies, and strategic optimization roadmap.
          </p>
          <span className="mt-3 text-xs font-medium text-blue-400 group-hover:underline flex items-center gap-1">
            {downloadedFormat === 'markdown' ? '✓ Downloaded' : 'Download Brief →'}
          </span>
        </button>

        {/* Button 2: Persona Matrix CSV */}
        <button
          type="button"
          onClick={() => handleDownload('csv')}
          className="flex flex-col items-start p-5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] hover:border-white/20 hover:bg-[var(--surface-hover)] transition-all text-left cursor-pointer group hover:-translate-y-0.5 shadow-sm hover:shadow-md"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
              <Table className="h-4 w-4 text-emerald-400" />
              Persona Matrix
            </span>
            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] bg-[var(--surface-3)] px-2 py-0.5 rounded-full">
              .CSV
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Spreadsheet table of all 10 personas, roles, budgets, votes, and individual WTP values.
          </p>
          <span className="mt-3 text-xs font-medium text-emerald-400 group-hover:underline flex items-center gap-1">
            {downloadedFormat === 'csv' ? '✓ Downloaded' : 'Export Spreadsheet →'}
          </span>
        </button>

        {/* Button 3: Full JSON Payload */}
        <button
          type="button"
          onClick={() => handleDownload('json')}
          className="flex flex-col items-start p-5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] hover:border-white/20 hover:bg-[var(--surface-hover)] transition-all text-left cursor-pointer group hover:-translate-y-0.5 shadow-sm hover:shadow-md"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
              <FileCode className="h-4 w-4 text-amber-400" />
              Full Raw Dataset
            </span>
            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] bg-[var(--surface-3)] px-2 py-0.5 rounded-full">
              .JSON
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Complete structured JSON dump of all 7 pipeline stages, live web citations, and telemetry.
          </p>
          <span className="mt-3 text-xs font-medium text-amber-400 group-hover:underline flex items-center gap-1">
            {downloadedFormat === 'json' ? '✓ Downloaded' : 'Download JSON →'}
          </span>
        </button>
      </div>
    </div>
  );
};
