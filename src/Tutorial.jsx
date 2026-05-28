import React, { useState, useEffect } from 'react';
import { C } from './theme';
import { STACKS, QUEUE_SIZE } from './game';

// ─────────────────────────────────────────────────────────────────────────────
//  Tutorial steps — content for the first-time walkthrough. Steps reference
//  live refs from the OnCall component and read live ticket data so the
//  explanation matches what's on screen right now.
// ─────────────────────────────────────────────────────────────────────────────

export function buildTutorialSteps({ ticket, refs }) {
  const { inboxRef, ticketRef, doneRef, gitLogRef, gitDiffRef } = refs;
  const t = ticket;
  const reqDesc = t
    ? t.requirements
        .map(r => `${STACKS[r.stack].name} ≥ ${r.threshold}`)
        .join(' AND ')
    : '';
  const primaryReq = t ? t.requirements[0] : null;
  const primaryStack = primaryReq ? STACKS[primaryReq.stack] : null;
  const blockedName = t && t.blocked ? STACKS[t.blocked].name : null;
  const multStr = t ? `×${t.reward}` : '';

  return [
    {
      title: 'Welcome',
      ref: null,
      body: (
        <>
          <p style={{ margin: '0 0 8px' }}>
            You're on call. Tickets land in your inbox, you cherry-pick from
            your fix candidates, and the third pick auto-ships the stage.
          </p>
          <p style={{ margin: 0, color: C.faint, fontStyle: 'italic' }}>
            This walkthrough takes about a minute. Press <b>esc</b> or hit
            skip at any time. Reload the page to see it again.
          </p>
        </>
      ),
    },
    {
      title: 'Inbox',
      ref: inboxRef,
      body: (
        <>
          <p style={{ margin: '0 0 8px' }}>
            Up to <b>{QUEUE_SIZE}</b> open tickets sit here. Each carries a
            <b> priority</b> (<span style={{ color: C.danger }}>prio-1</span> = urgent,
            <span style={{ color: C.warning }}> prio-2</span>, prio-3) and one or
            two <b>stack thresholds</b> you have to clear.
          </p>
          <p style={{ margin: 0, color: C.faint }}>
            You can resolve tickets in any order, but skipping a higher
            priority one to grab an easier win costs velocity.
          </p>
        </>
      ),
    },
    {
      title: 'Active ticket',
      ref: ticketRef,
      body: t ? (
        <>
          <p style={{ margin: '0 0 8px' }}>
            Your first ticket <b>{t.ticketId}</b> ({t.severity}) needs{' '}
            <b style={{ color: primaryStack ? primaryStack.color : C.text }}>
              {reqDesc}
            </b>{' '}
            in stage score.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            Each fix you cherry-pick contributes its <b>value</b> (1–13) to
            its own stack. Hit the threshold on every requirement and the
            stage succeeds — paying <b style={{ color: C.success }}>{multStr}</b> velocity.
          </p>
          {blockedName ? (
            <p style={{ margin: 0, color: C.danger }}>
              ✕ Don't play any <b>{blockedName}</b> fixes — that stack is
              blocked. Touching it taints the whole stage.
            </p>
          ) : (
            <p style={{ margin: 0, color: C.faint, fontStyle: 'italic' }}>
              No blocked stack on this one — play whatever scores best.
            </p>
          )}
        </>
      ) : (
        <p style={{ margin: 0 }}>
          The ticket you're currently solving shows its requirements, blocked
          stack, and a live preview of where your stage stands.
        </p>
      ),
    },
    {
      title: 'Done',
      ref: doneRef,
      body: (
        <p style={{ margin: 0 }}>
          Resolved (<span style={{ color: C.success }}>✓</span>) or rejected
          (<span style={{ color: C.danger }}>✕</span>) tickets land here. Click
          any to inspect its diff and the final push output. Empty for now —
          you haven't shipped anything yet.
        </p>
      ),
    },
    {
      title: '$ git diff --staged',
      ref: gitDiffRef,
      body: (
        <p style={{ margin: 0 }}>
          Your stage, in order. The <b style={{ color: C.success }}>3rd pick auto-ships</b> —
          it scores against every requirement, ships the stage, and either
          resolves the ticket or burns a strike. Cherry-picks are <b>final</b>:
          no revert once a fix lands here.
        </p>
      ),
    },
    {
      title: '$ git log -4 fix-candidates',
      ref: gitLogRef,
      body: (
        <>
          <p style={{ margin: '0 0 8px' }}>
            Your <b>fix candidates</b>: one per stack. Each shows its
            short SHA, stack tag with <b>-n</b> appendix (fixes still drawable
            from that stack), value, and a one-line summary. The shift ends
            when fewer than 3 fixes remain anywhere in your pool — watch
            those counts.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <b style={{ color: C.warning }}>★ sequence bonus</b> means
            extra points if the placement condition fires (first, after DB,
            etc.). Watch for fixes whose description starts with{' '}
            <code style={{ color: C.danger }}>patch:</code> — that's the soft
            tell for a <b style={{ color: C.danger }}>bugged</b> fix that
            scores negative.
          </p>
          <p style={{ margin: 0, color: C.faint }}>
            Tap a fix to cherry-pick it into the stage.
          </p>
        </>
      ),
    },
    {
      title: 'Your move',
      ref: ticketRef,
      body: t ? (
        <>
          <p style={{ margin: '0 0 8px' }}>
            To clear <b>{t.ticketId}</b>, your three cherry-picks need to add up to{' '}
            <b style={{ color: primaryStack ? primaryStack.color : C.text }}>
              {reqDesc}
            </b>.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            Pick the highest-value{' '}
            {t.requirements.map((r, i) => (
              <React.Fragment key={r.stack}>
                {i > 0 && ' and '}
                <b style={{ color: STACKS[r.stack].color }}>{STACKS[r.stack].name}</b>
              </React.Fragment>
            ))}{' '}
            fixes from your candidates, skip anything prefixed{' '}
            <code style={{ color: C.danger }}>patch:</code>
            {blockedName ? <> and never any <b style={{ color: C.danger }}>{blockedName}</b></> : null}, and
            try to land a sequence bonus on the way.
          </p>
          <p style={{ margin: 0, color: C.faint, fontStyle: 'italic' }}>
            Good luck. Don't get paged.
          </p>
        </>
      ) : (
        <p style={{ margin: 0 }}>Pick a ticket from the inbox to begin.</p>
      ),
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tutorial — first-time guided walkthrough. State is in-memory only, so any
//  reload (force or otherwise) re-arms it. Steps reference live refs from
//  OnCall and read live ticket data so the explanation matches what's on
//  screen right now.
// ─────────────────────────────────────────────────────────────────────────────

export function Tutorial({ steps, onClose }) {
  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx];
  const [rect, setRect] = useState(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth  : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const recalc = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      const el = step && step.ref && step.ref.current;
      if (!el) { setRect(null); return; }
      setRect(el.getBoundingClientRect());
    };
    const el = step && step.ref && step.ref.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    recalc();
    const id = setInterval(recalc, 250);
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [stepIdx, step, steps.length]);

  if (!step) return null;

  const PAD = 8;
  const TT_W = Math.min(360, viewport.w - 24);
  const isModal = !step.ref || !rect;

  let ttTop = 0, ttLeft = 0, ttHeight = 220;
  if (!isModal) {
    const spaceBelow = viewport.h - rect.bottom;
    const spaceAbove = rect.top;
    const below = spaceBelow >= 200 || spaceBelow >= spaceAbove;
    ttTop = below
      ? Math.min(rect.bottom + PAD + 8, viewport.h - ttHeight - 12)
      : Math.max(12, rect.top - PAD - 8 - ttHeight);
    const cx = rect.left + rect.width / 2;
    ttLeft = Math.max(12, Math.min(cx - TT_W / 2, viewport.w - TT_W - 12));
  }

  const total = steps.length;
  const isLast = stepIdx === total - 1;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* spotlight cutout — transparent box ringed by a massive shadow */}
      {!isModal && rect && (
        <div style={{
          position: 'fixed',
          top: Math.max(0, rect.top - PAD),
          left: Math.max(0, rect.left - PAD),
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          borderRadius: '8px',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
          border: `2px solid ${C.accent}`,
          pointerEvents: 'none',
          zIndex: 9998,
          transition: 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
        }} />
      )}

      {/* full-page click absorber when modal (no target) */}
      {isModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 9998,
        }} />
      )}

      {/* tooltip panel */}
      <div style={{
        position: 'fixed',
        top: isModal ? '50%' : ttTop,
        left: isModal ? '50%' : ttLeft,
        transform: isModal ? 'translate(-50%, -50%)' : 'none',
        width: TT_W,
        maxHeight: viewport.h - 24,
        overflowY: 'auto',
        background: C.panel,
        border: `1px solid ${C.accent}`,
        borderRadius: '8px',
        padding: '14px 16px',
        zIndex: 9999,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
        color: C.text,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.55rem',
            color: C.faint,
            fontWeight: 700,
            letterSpacing: '0.1em',
          }}>
            TUTORIAL · {stepIdx + 1}/{total}
          </span>
          <span style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: C.accent,
          }}>
            {step.title}
          </span>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: C.faint,
              fontSize: '0.7rem',
              cursor: 'pointer',
              padding: '2px 6px',
            }}
            title="skip tutorial"
          >
            ✕
          </button>
        </div>
        <div style={{
          fontSize: '0.78rem',
          lineHeight: 1.5,
          color: C.muted,
        }}>
          {step.body}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '14px',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: C.muted,
              fontSize: '0.7rem',
              padding: '6px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            skip
          </button>
          <div style={{ flex: 1 }} />
          {stepIdx > 0 && (
            <button
              onClick={() => setStepIdx(i => Math.max(0, i - 1))}
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                color: C.text,
                fontSize: '0.72rem',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ‹ back
            </button>
          )}
          <button
            onClick={() => isLast ? onClose() : setStepIdx(i => i + 1)}
            style={{
              background: C.accent,
              border: `1px solid ${C.accent}`,
              color: '#fff',
              fontSize: '0.72rem',
              padding: '6px 14px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {isLast ? 'got it' : 'next ›'}
          </button>
        </div>
      </div>
    </div>
  );
}
