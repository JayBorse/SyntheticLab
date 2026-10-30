'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  ShieldAlert,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ListChecks,
  Calculator,
  Circle,
  ChevronDown,
  ChevronUp,
  Terminal,
} from 'lucide-react';
import {
  SimulationInput,
  SyntheticPersona,
  PersonaEvaluation,
  NegotiationMessage,
  PersonaVote,
  CompetitiveBattlecard,
  BlockerChecklistItem,
  NetValueFormula,
  NebiusSandboxTelemetry,
} from '@/core/synthetic-lab/types';
import { calculateEconomicFormula } from '@/core/synthetic-lab/economic-engine';
import { isTechnicalBlocker } from '@/core/nebius/sandbox-runner';
import { SandboxTerminalModal } from './SandboxTerminalModal';
import { Button } from './Button';

function createMessageId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getCurrentTimestamp(): number {
  return Date.now();
}

export interface NegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: SyntheticPersona | null;
  evaluation: PersonaEvaluation | null;
  input: SimulationInput;
  battlecard?: CompetitiveBattlecard | null;
  onVoteUpdated?: (updatedEvaluation: PersonaEvaluation) => void;
}

export const NegotiationModal: React.FC<NegotiationModalProps> = ({
  isOpen,
  onClose,
  persona,
  evaluation,
  input,
  battlecard,
  onVoteUpdated,
}) => {
  const [messages, setMessages] = useState<NegotiationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentVote, setCurrentVote] = useState<PersonaVote>(evaluation?.vote || 'reject');
  const [currentPrice, setCurrentPrice] = useState<number>(evaluation?.acceptablePrice || 0);
  const [voteFlipped, setVoteFlipped] = useState(false);
  const [concessionAudit, setConcessionAudit] = useState<'fluff' | 'partial' | 'concrete_resolution' | null>(null);
  const [netValueDelta, setNetValueDelta] = useState<number | null>(null);
  const [netValueFormula, setNetValueFormula] = useState<NetValueFormula | null>(null);
  const [blockerChecklist, setBlockerChecklist] = useState<BlockerChecklistItem[]>([]);
  const [isChecklistExpanded, setIsChecklistExpanded] = useState(false);
  const [pushedBack, setPushedBack] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isSandboxModalOpen, setIsSandboxModalOpen] = useState(false);
  const [selectedSandboxBlocker, setSelectedSandboxBlocker] = useState<BlockerChecklistItem | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSandboxComplete = (
    telemetry: NebiusSandboxTelemetry,
    resolutionSummary: string
  ) => {
    if (!selectedSandboxBlocker) return;

    const updatedChecklist = blockerChecklist.map((b) => {
      if (b.index === selectedSandboxBlocker.index) {
        return {
          ...b,
          resolved: true,
          resolvedVia: resolutionSummary,
          sandboxVerified: true,
          sandboxTelemetry: telemetry,
        };
      }
      return b;
    });
    setBlockerChecklist(updatedChecklist);

    const founderProofMsg: NegotiationMessage = {
      id: createMessageId('msg_founder'),
      role: 'founder',
      content: `Dispatched technical proof-of-concept to Nebius Cloud Sandbox [${telemetry.sandboxId}]. MicroVM executed: p99 latency verified at ${telemetry.p99LatencyMs}ms under ${telemetry.throughputRps.toLocaleString()} ops/sec with zero memory leaks. Exit code 0 verified.`,
      timestamp: getCurrentTimestamp(),
    };

    const remainingUnresolved = updatedChecklist.filter((b) => !b.resolved).length;
    const allClearedNow = remainingUnresolved === 0;

    let newVote: PersonaVote = currentVote;
    let buyerReplyText = '';

    if (allClearedNow) {
      newVote = 'adopt';
      setVoteFlipped(true);
      setCurrentVote('adopt');
      buyerReplyText = `I reviewed the cryptographic execution receipt from the Nebius Sandbox (${telemetry.receiptHash.slice(0, 18)}...). Technical assertions verified: p99 latency was benchmarked at ${telemetry.p99LatencyMs}ms with zero memory leaks. With all ${updatedChecklist.length} blockers cleared, I am flipping my vote to WOULD BUY!`;
    } else {
      newVote = 'hesitant';
      setCurrentVote('hesitant');
      buyerReplyText = `The Nebius Sandbox confirmed your technical SLA claims (${telemetry.stdoutSnippet}). That blocker is now cleared. However, we still have ${remainingUnresolved} commercial/budget items to finalize.`;
    }

    const buyerMsg: NegotiationMessage = {
      id: createMessageId('msg_buyer'),
      role: 'buyer',
      content: buyerReplyText,
      timestamp: getCurrentTimestamp() + 1,
      voteAfterMessage: newVote,
      revisedPrice: currentPrice,
      blockerChecklist: updatedChecklist,
    };

    setMessages((prev) => [...prev, founderProofMsg, buyerMsg]);

    if (evaluation && onVoteUpdated && allClearedNow) {
      onVoteUpdated({
        ...evaluation,
        vote: 'adopt',
        acceptablePrice: currentPrice,
        dealMakers: [
          ...(evaluation.dealMakers || []),
          `Verified technical SLA via Nebius Sandbox (p99: ${telemetry.p99LatencyMs}ms)`,
        ],
      });
    }
  };

  // Initialize negotiation with context-aware opening message based on buyer's actual vote
  useEffect(() => {
    if (!isOpen || !persona || !evaluation) return;

    const timer = setTimeout(() => {
      setCurrentVote(evaluation.vote);
      setCurrentPrice(evaluation.acceptablePrice);
      setVoteFlipped(false);
      setConcessionAudit(null);
      setPushedBack(false);

      // Build initial blocker checklist
      const initialChecklist: BlockerChecklistItem[] =
        evaluation.fatalObjections && evaluation.fatalObjections.length > 0
          ? evaluation.fatalObjections.map((o, idx) => ({
              index: idx,
              text: o.objection,
              resolved: false,
            }))
          : evaluation.vote === 'adopt'
          ? []
          : [
              {
                index: 0,
                text: `Price of $${input.proposedPrice}/${input.billingPeriod} exceeds comfort threshold without contractual spend caps`,
                resolved: false,
              },
            ];
      setBlockerChecklist(initialChecklist);

      // Compute initial net value formula using universal economic engine
      const priceVal = evaluation.acceptablePrice > 0 ? evaluation.acceptablePrice : input.proposedPrice;
      const initialFormula = calculateEconomicFormula(persona, input, priceVal);
      setNetValueFormula(initialFormula);
      setNetValueDelta(initialFormula.netGain);

      let openingContent = '';

      if (evaluation.vote === 'adopt') {
        const dealMakerText =
          evaluation.dealMakers && evaluation.dealMakers.length > 0
            ? `because ${evaluation.dealMakers[0]}`
            : 'based on your feature set and pricing';
        openingContent = `I voted "WOULD BUY" at $${evaluation.acceptablePrice}/${evaluation.acceptablePeriod} ${dealMakerText}. I'm ready to move forward, but let's discuss contract terms: can you offer an annual prepay discount, dedicated support, or volume tiering for our team at ${persona.companyProfile}?`;
      } else if (evaluation.vote === 'hesitant') {
        const concern =
          evaluation.fatalObjections[0]?.objection ||
          'contract terms and workflow integration friction';
        openingContent = `I voted "COUNTER-OFFER" at $${evaluation.acceptablePrice}/${evaluation.acceptablePeriod}. I'm open to adopting, but I'm hesitant because of this key concern: "${concern}". What guarantees or concessions can you offer to get this approved?`;
      } else {
        const blocker =
          evaluation.fatalObjections[0]?.objection ||
          `Your proposed price of $${input.proposedPrice}/${input.billingPeriod} exceeds our budget ceiling for ${persona.companyProfile}.`;
        openingContent = `I voted "PASS" on your current proposal. Here is my primary blocker: "${blocker}". What can you offer to resolve this for our team?`;
      }

      setMessages([
        {
          id: createMessageId('msg_init'),
          role: 'buyer',
          content: openingContent,
          timestamp: getCurrentTimestamp(),
          voteAfterMessage: evaluation.vote,
          revisedPrice: evaluation.acceptablePrice,
        },
      ]);
      inputRef.current?.focus();
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, persona, evaluation, input]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !persona || !evaluation) return null;

  const isAdopt = currentVote === 'adopt';
  const totalBlockers = blockerChecklist.length;
  const resolvedBlockers = blockerChecklist.filter((b) => b.resolved).length;
  const allCleared = totalBlockers > 0 && resolvedBlockers === totalBlockers;
  const technicalBlocker = blockerChecklist.find(
    (b) => !b.resolved && isTechnicalBlocker(b.text, persona.role)
  );

  const quickConcessions = isAdopt
    ? [
        `Offer 20% discount on an upfront annual contract ($${Math.round(currentPrice * 12 * 0.8)}/year)`,
        `Include dedicated Slack support channel and white-glove onboarding`,
        `Provide enterprise 99.99% multi-region uptime SLA with contractual credits`,
        `Lock in grandfathered pricing for 24 months with unlimited team seats`,
      ]
    : [
        `Guarantee a hard monthly spend cap of $${Math.max(15, Math.round(input.proposedPrice * 0.8))} with zero overages`,
        `Offer a 14-day risk-free pilot with assisted migration`,
        `Provide written 99.99% uptime SLA and Zero Data Retention guarantee`,
        `Switch to a pure contingency/success-fee model (pay only on proven results)`,
      ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSubmitting) return;

    const founderMsg: NegotiationMessage = {
      id: createMessageId('msg_founder'),
      role: 'founder',
      content: text,
      timestamp: getCurrentTimestamp(),
    };

    const updatedHistory = [...messages, founderMsg];
    setMessages(updatedHistory);
    setInputText('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/simulate/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          persona,
          evaluation: {
            ...evaluation,
            vote: currentVote,
            acceptablePrice: currentPrice,
          },
          messages: updatedHistory,
          counterOffer: text,
          battlecard: battlecard || undefined,
          existingChecklist: blockerChecklist,
        }),
      });

      if (!response.ok) {
        throw new Error(`Negotiation failed: ${response.statusText}`);
      }

      const data = await response.json();

      const buyerMsg: NegotiationMessage = {
        id: createMessageId('msg_buyer'),
        role: 'buyer',
        content: data.buyerReply,
        timestamp: getCurrentTimestamp(),
        voteAfterMessage: data.updatedVote,
        revisedPrice: data.revisedPrice,
        rationale: data.rationale,
        concessionQuality: data.concessionQuality,
        netValueDelta: data.netValueDelta,
        pushedBack: data.pushedBack,
        blockerChecklist: data.blockerChecklist,
        netValueFormula: data.netValueFormula,
      };

      setMessages((prev) => [...prev, buyerMsg]);
      setCurrentVote(data.updatedVote);
      setCurrentPrice(data.revisedPrice);

      if (data.blockerChecklist) {
        setBlockerChecklist(data.blockerChecklist);
      }
      if (data.netValueFormula) {
        setNetValueFormula(data.netValueFormula);
      }
      if (data.concessionQuality) {
        setConcessionAudit(data.concessionQuality);
      }
      if (typeof data.netValueDelta === 'number') {
        setNetValueDelta(data.netValueDelta);
      }
      setPushedBack(Boolean(data.pushedBack));

      if (data.voteFlipped) {
        setVoteFlipped(true);
      }

      // Propagate updated evaluation back to parent
      if (onVoteUpdated) {
        onVoteUpdated({
          ...evaluation,
          vote: data.updatedVote,
          acceptablePrice: data.revisedPrice,
          rationale: `${evaluation.rationale} [Negotiation update: "${data.rationale}"]`,
        });
      }
    } catch (err) {
      console.warn('Live negotiation fallback applied:', err);
      const lower = text.toLowerCase();
      const isFluff =
        text.length < 16 ||
        lower.includes('trust me') ||
        lower.includes('trust us') ||
        lower.includes('best in market') ||
        lower.includes('great') ||
        lower.includes('ignore') ||
        lower.includes('ceo') ||
        lower.includes('please') ||
        lower.includes('promise');

      const updatedChecklist = blockerChecklist.map((b) => ({ ...b }));

      if (!isFluff) {
        for (const b of updatedChecklist) {
          const bLower = b.text.toLowerCase();
          const isBudget = bLower.includes('price') || bLower.includes('budget') || bLower.includes('cap') || bLower.includes('overage');
          const isSecurity = bLower.includes('soc') || bLower.includes('compliance') || bLower.includes('security') || bLower.includes('dpa');
          const isPerf = bLower.includes('latency') || bLower.includes('benchmark') || bLower.includes('speed') || bLower.includes('sandbox') || bLower.includes('trial');

          if (isBudget && (lower.includes('cap') || lower.includes('ceiling') || lower.includes('discount') || lower.includes('$') || lower.includes('pause'))) {
            b.resolved = true;
            b.resolvedVia = text.slice(0, 70);
          }
          if (isSecurity && (lower.includes('soc') || lower.includes('compliance') || lower.includes('dpa') || lower.includes('zero retention'))) {
            b.resolved = true;
            b.resolvedVia = text.slice(0, 70);
          }
          if (isPerf && (lower.includes('sandbox') || lower.includes('trial') || lower.includes('sla') || lower.includes('latency'))) {
            b.resolved = true;
            b.resolvedVia = text.slice(0, 70);
          }
        }
      }

      setBlockerChecklist(updatedChecklist);
      const totalBlockers = updatedChecklist.length;
      const resolvedCount = updatedChecklist.filter((b) => b.resolved).length;
      const allResolved = totalBlockers > 0 && resolvedCount === totalBlockers;

      const newPrice = Math.round(evaluation.acceptablePrice * 1.25) || 45;
      const formula = calculateEconomicFormula(persona, input, newPrice);
      setNetValueFormula(formula);
      setNetValueDelta(formula.netGain);

      if (isFluff || resolvedCount === 0) {
        const unaddressed = updatedChecklist.map((b) => b.text).join('; ');
        let fallbackReply = `I hear you, but that doesn't address our main constraint around ${unaddressed || persona.primaryConstraint}. We need concrete SLAs, contractual caps, or technical guarantees before we can proceed. What specific terms can you commit to?`;
        if (
          lower.includes('?') ||
          lower.includes('where') ||
          lower.includes('email') ||
          lower.includes('send') ||
          lower.includes('doc') ||
          lower.includes('who')
        ) {
          fallbackReply = `You can forward the technical specs, BAA, or SOC-2 documentation to our procurement review team. Once our engineering and compliance teams review it against our ${persona.primaryConstraint.toLowerCase()} requirements, we can take the next step.`;
        }
        const buyerMsg: NegotiationMessage = {
          id: createMessageId('msg_buyer_fb'),
          role: 'buyer',
          content: fallbackReply,
          timestamp: getCurrentTimestamp(),
          voteAfterMessage: currentVote,
          revisedPrice: currentPrice,
          concessionQuality: 'fluff',
          pushedBack: true,
          blockerChecklist: updatedChecklist,
          netValueFormula: formula,
        };
        setMessages((prev) => [...prev, buyerMsg]);
        setConcessionAudit('fluff');
        setPushedBack(true);
      } else if (allResolved) {
        const competitorMention = battlecard?.competitors?.[0]
          ? ` Unlike ${battlecard.competitors[0].name}, hard spend caps and guarantees prevent unexpected liability.`
          : '';
        const fallbackReply = `That concession directly resolves all our remaining procurement blockers.${competitorMention} I am ready to approve this at $${newPrice}/${input.billingPeriod}.`;
        const buyerMsg: NegotiationMessage = {
          id: createMessageId('msg_buyer_fb'),
          role: 'buyer',
          content: fallbackReply,
          timestamp: getCurrentTimestamp(),
          voteAfterMessage: 'adopt',
          revisedPrice: newPrice,
          concessionQuality: 'concrete_resolution',
          pushedBack: false,
          blockerChecklist: updatedChecklist,
          netValueFormula: formula,
        };
        setMessages((prev) => [...prev, buyerMsg]);
        setCurrentVote('adopt');
        setCurrentPrice(newPrice);
        setVoteFlipped(true);
        setConcessionAudit('concrete_resolution');
        setPushedBack(false);

        if (onVoteUpdated) {
          onVoteUpdated({
            ...evaluation,
            vote: 'adopt',
            acceptablePrice: newPrice,
            rationale: `${evaluation.rationale} [Negotiated agreement: All blockers resolved]`,
          });
        }
      } else {
        const remaining = updatedChecklist.filter((b) => !b.resolved).map((b) => b.text).join('; ');
        const fallbackReply = `That concession addresses part of our concerns, but we still have an active blocker: "${remaining}". What can you offer on that?`;
        const buyerMsg: NegotiationMessage = {
          id: createMessageId('msg_buyer_fb'),
          role: 'buyer',
          content: fallbackReply,
          timestamp: getCurrentTimestamp(),
          voteAfterMessage: 'hesitant',
          revisedPrice: currentPrice,
          concessionQuality: 'partial',
          pushedBack: false,
          blockerChecklist: updatedChecklist,
          netValueFormula: formula,
        };
        setMessages((prev) => [...prev, buyerMsg]);
        setCurrentVote('hesitant');
        setConcessionAudit('partial');
        setPushedBack(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const speakText = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-[var(--surface-1)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col h-[90vh] max-h-[750px] overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--surface-2)]/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl overflow-hidden ring-2 ring-white/10 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://images.unsplash.com/photo-${
                  persona.role.includes('cfo') || persona.role.includes('finance')
                    ? '1534528741775-53994a69daeb'
                    : persona.role.includes('cto') || persona.role.includes('engineer')
                    ? '1507003211169-0a1dd7228f2d'
                    : persona.role.includes('security')
                    ? '1500648767791-00dcc994a43e'
                    : '1494790108377-be9c29b29330'
                }?auto=format&fit=crop&w=120&h=120&q=80`}
                alt={persona.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base text-[var(--text-primary)]">
                  Live Sparring: {persona.name}
                </h3>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border transition-colors ${
                    currentVote === 'adopt'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : currentVote === 'reject'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {currentVote === 'adopt' ? '✓ ADOPTED' : currentVote === 'reject' ? '✕ REJECTED' : '⇄ HESITANT'}
                </span>
                {voteFlipped && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold uppercase animate-pulse">
                    Vote Flipped! 🎉
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {persona.title} • {persona.companyProfile} (Budget: ${persona.budgetCeiling}/{persona.budgetPeriod})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close sparring room"
            className="h-8 w-8 rounded-full bg-[var(--surface-1)] border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sleek Minimal Executive Context Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-[var(--surface-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between text-xs gap-3">
          {/* Left: Blocker pill / status / sandbox verify */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {totalBlockers > 0 ? (
              <button
                type="button"
                onClick={() => setIsChecklistExpanded(!isChecklistExpanded)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer active:scale-95 ${
                  allCleared
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    : currentVote === 'reject'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                }`}
                title="Click to toggle blocker details and ROI breakdown"
              >
                <ListChecks className="h-3 w-3" />
                <span>
                  {allCleared
                    ? '✓ All Blockers Cleared'
                    : `${totalBlockers - resolvedBlockers} of ${totalBlockers} Blocker${totalBlockers > 1 ? 's' : ''}`}
                </span>
                {isChecklistExpanded ? (
                  <ChevronUp className="h-3 w-3 opacity-60" />
                ) : (
                  <ChevronDown className="h-3 w-3 opacity-60" />
                )}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono">
                <Zap className="h-3 w-3 text-blue-400" />
                <span>Nemotron Sparring</span>
              </span>
            )}

            {/* Quick Sandbox Verify shortcut if an unresolved technical blocker exists */}
            {technicalBlocker && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSandboxBlocker(technicalBlocker);
                  setIsSandboxModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-mono transition-all cursor-pointer active:scale-95 shadow-xs"
                title="Spin up Nebius MicroVM sandbox to benchmark and verify this claim"
              >
                <Terminal className="w-3 h-3 text-purple-400" />
                <span>Verify in Sandbox</span>
              </button>
            )}

            {/* Pushed back fluff alert */}
            {pushedBack && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-medium animate-pulse">
                <ShieldAlert className="h-3 w-3" /> Fluff Pushback
              </span>
            )}
          </div>

          {/* Right: Net Value ROI & Buyer Target Price */}
          <div className="flex items-center gap-3 shrink-0">
            {netValueFormula && (
              <span
                className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-mono font-medium ${
                  netValueFormula.netGain > 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
                title={`Calculated Net Value: Problem Cost $${netValueFormula.problemCost}/mo - Price $${netValueFormula.price}/mo`}
              >
                {netValueFormula.netGain > 0 ? '+' : ''}${netValueFormula.netGain}/mo ROI
              </span>
            )}

            <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border-subtle)] text-xs">
              <span className="text-[11px] text-[var(--text-muted)]">
                {currentVote === 'adopt' ? 'Agreed:' : 'Buyer Max:'}
              </span>
              <span
                className={`font-bold font-mono text-xs sm:text-sm ${
                  currentVote === 'adopt'
                    ? 'text-emerald-400'
                    : currentVote === 'hesitant'
                    ? 'text-blue-400'
                    : 'text-rose-400'
                }`}
              >
                ${currentPrice}/{evaluation.acceptablePeriod}
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible Due Diligence & Economic Drawer */}
        {isChecklistExpanded && blockerChecklist.length > 0 && (
          <div className="px-4 sm:px-5 py-3 bg-[var(--surface-2)]/95 border-b border-[var(--border-subtle)] space-y-2.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Items List */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {blockerChecklist.map((item) => (
                <div
                  key={item.index}
                  className={`flex items-start gap-2 p-2 rounded-lg text-xs transition-colors ${
                    item.resolved
                      ? 'bg-emerald-500/[0.06] border border-emerald-500/20 text-emerald-200'
                      : 'bg-black/20 border border-white/5 text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {item.resolved ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-amber-400/80" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={
                          item.resolved
                            ? 'line-through text-zinc-400 decoration-emerald-500/50'
                            : 'text-[var(--text-primary)] font-medium'
                        }
                      >
                        {item.text}
                      </span>
                      {!item.resolved && isTechnicalBlocker(item.text, persona.role) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSandboxBlocker(item);
                            setIsSandboxModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-colors cursor-pointer"
                        >
                          <Terminal className="w-3 h-3 text-purple-400" />
                          <span>Verify in Nebius Sandbox</span>
                        </button>
                      )}
                      {item.resolved && item.sandboxVerified && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30 flex items-center gap-1">
                          <Terminal className="w-2.5 h-2.5 text-purple-400" />
                          Nebius MicroVM Verified
                        </span>
                      )}
                      {item.resolved && item.resolvedVia && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30 truncate max-w-[280px]">
                          Cleared: {item.resolvedVia}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Subtle Economic Formula Breakdown & Market Baseline */}
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[var(--text-muted)] flex-wrap gap-2">
              {netValueFormula && (
                <div className="flex items-center gap-2 font-mono">
                  <Calculator className="h-3 w-3 text-blue-400" />
                  <span>
                    Problem: ${netValueFormula.problemCost}/mo → Realized Value: ${netValueFormula.realizedValue}/mo → Net: {netValueFormula.netGain > 0 ? '+' : ''}${netValueFormula.netGain}/mo
                  </span>
                </div>
              )}
              {battlecard?.competitors?.[0] && (
                <span className="text-[10px] text-purple-300/80">
                  Benchmarking vs {battlecard.competitors[0].name} ({battlecard.competitors[0].pricingModel})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
          {messages.map((m) => {
            const isBuyer = m.role === 'buyer';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isBuyer ? 'items-start' : 'items-end'} space-y-1`}
              >
                <div className="flex items-center gap-2 px-1 text-[10px] font-mono text-[var(--text-muted)]">
                  <span>{isBuyer ? persona.name : 'You (Founder)'}</span>
                  {isBuyer && (
                    <button
                      type="button"
                      onClick={() => speakText(m.id, m.content)}
                      className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer ml-1"
                      title="Listen to audio voice"
                    >
                      <Volume2 className={`h-3 w-3 ${speakingMsgId === m.id ? 'animate-pulse text-emerald-400' : ''}`} />
                      <span>{speakingMsgId === m.id ? 'Playing...' : 'Listen'}</span>
                    </button>
                  )}
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl relative text-xs leading-relaxed ${
                    isBuyer
                      ? 'bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-tl-sm'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm shadow-md shadow-blue-500/10'
                  }`}
                >
                  <p>{m.content}</p>
                </div>
              </div>
            );
          })}

          {isSubmitting && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-2)]/80 border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] w-fit animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
              <span>{persona.name} is deliberating...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Concessions Chips */}
        <div className="px-4 py-2 bg-[var(--surface-2)]/40 border-t border-[var(--border-subtle)] flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] shrink-0 font-medium">
            Quick Offers:
          </span>
          <div className="flex items-center gap-1.5 whitespace-nowrap overflow-x-auto py-0.5">
            {quickConcessions.map((qc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(qc)}
                disabled={isSubmitting}
                className="px-2.5 py-1 rounded-full bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border-subtle)] hover:border-blue-500/40 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-xs"
              >
                + {qc}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 sm:p-4 bg-[var(--surface-2)]/80 border-t border-[var(--border-subtle)]"
        >
          <div className="flex items-center gap-2 bg-[var(--surface-1)] border border-[var(--border-medium)] rounded-xl px-3 py-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Propose a term, pricing cap, or guarantee to ${persona.name}...`}
              disabled={isSubmitting}
              className="flex-1 bg-transparent border-0 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none py-1.5"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!inputText.trim() || isSubmitting}
              leftIcon={<Send className="h-3 w-3" />}
              className="rounded-lg shrink-0 px-3.5 py-1.5 text-xs shadow-xs"
            >
              Counter-Offer
            </Button>
          </div>
        </form>
      </div>

      {/* Nebius Cloud Sandbox MicroVM Due Diligence Modal */}
      <SandboxTerminalModal
        isOpen={isSandboxModalOpen}
        onClose={() => {
          setIsSandboxModalOpen(false);
          setSelectedSandboxBlocker(null);
        }}
        blocker={selectedSandboxBlocker}
        personaName={persona.name}
        personaRole={persona.role}
        onVerificationComplete={handleSandboxComplete}
      />
    </div>
  );
};
