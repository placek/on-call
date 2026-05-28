import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FIXES, TICKET_POOL, PROGRAMMERS, HOST_WORDS, HOST_TLDS, HOST_SPLITS } from './content';
import { C, FONTS_CSS } from './theme';
import { STACKS, STACK_KEYS, QUEUE_SIZE } from './game';
import {
  bonusFires,
  bonusLabel,
  bonusWouldFireIfPlacedNow,
  effectiveValue,
  scoreDeploy,
  skipPenaltyFor,
} from './scoring';
import { buildShiftDecks, rollTicket } from './deck';
import { useIsNarrow } from './hooks';
import { IntroScreen } from './Readme';
import { Tutorial, buildTutorialSteps } from './Tutorial';

// ─────────────────────────────────────────────────────────────────────────────
//  ON-CALL — a DevOps ticket triage game.
//  Pick 3 fixes, ship the stage, resolve the ticket. Don't get paged off.
// ─────────────────────────────────────────────────────────────────────────────

function _pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function genHost() {
  const style = Math.floor(Math.random() * 4);
  switch (style) {
    case 0: return `${_pick(HOST_WORDS)}-${_pick(HOST_WORDS)}.${_pick(HOST_WORDS)}`;
    case 1: return `${_pick(HOST_WORDS)}.${_pick(HOST_WORDS)}.${_pick(HOST_TLDS)}`;
    case 2: return _pick(HOST_SPLITS).split('|').join('.');
    default: return `${_pick(HOST_WORDS)}.${_pick(HOST_TLDS)}`;
  }
}

// Derive a JIRA-style project key from a hostname. Splits on `.` and `-`,
// takes the first letter of each token, uppercased, capped at 4 chars.
// Falls back to "TKT" when given nothing.
function projectKey(host) {
  if (!host) return 'TKT';
  const letters = host
    .split(/[.-]/)
    .filter(Boolean)
    .map(t => t[0])
    .join('')
    .toUpperCase();
  return letters.slice(0, 4) || 'TKT';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fix candidate — shown in the fix-candidates area, one per stack.
//  Tapping stages it into the next slot.
// ─────────────────────────────────────────────────────────────────────────────

function HandCard({ stack, card, remaining, blocked, deployFull, deployed, phase, onClick }) {
  const s = STACKS[stack];
  const isEmpty = !card;
  const bonusFiresNow = card && card.bonus && bonusWouldFireIfPlacedNow(card.bonus, deployed);
  const canPlace = phase === 'playing' && !!card && !deployFull;
  const dimmed = !card || deployFull;
  const [hovered, setHovered] = useState(false);

  if (isEmpty) {
    return (
      <div style={{
        padding: '4px 10px 4px 4px',
        opacity: 0.55,
        fontFamily: "'JetBrains Mono', monospace",
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          fontSize: '0.62rem',
          color: C.faint,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          minWidth: '48px',
        }}>
          ───────
        </div>
        <div style={{ fontSize: '0.62rem', color: s.color, fontWeight: 700, minWidth: '26px', opacity: 0.5 }}>
          {s.name.toLowerCase()}
        </div>
        <div style={{ fontSize: '0.7rem', color: C.faint, flex: 1, fontStyle: 'italic' }}>
          fatal: pool exhausted — no candidates remain
        </div>
      </div>
    );
  }

  const isLegendary = !!card.legendary;
  const showBox = hovered;
  const borderColor = isLegendary ? C.legendary : (bonusFiresNow ? C.warning : C.borderHi);
  // Legendary fixes ignore blocked-stack warnings — they auto-pass anyway.
  const showBlockedHints = blocked && !isLegendary;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={!canPlace}
      style={{
        position: 'relative',
        width: '100%',
        background: showBox ? C.panel : 'transparent',
        border: `1px solid ${showBox ? borderColor : 'transparent'}`,
        borderRadius: '5px',
        padding: '4px 10px 4px 4px',
        cursor: canPlace ? 'pointer' : 'not-allowed',
        transition: 'background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease',
        textAlign: 'left',
        opacity: dimmed ? 0.45 : 1,
        boxShadow: showBox && isLegendary
          ? '0 0 10px rgba(255, 209, 102, 0.22)'
          : showBox && bonusFiresNow
            ? '0 0 10px rgba(210, 153, 34, 0.18)'
            : 'none',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* left accent bar — stack color, or gold for legendary */}
      {showBox && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
          background: isLegendary ? C.legendary : s.color,
          opacity: showBlockedHints ? 0.5 : 1,
          transition: 'opacity 0.12s ease',
        }} />
      )}

      {/* blocked diagonal stripes — only when box showing AND not legendary */}
      {showBlockedHints && showBox && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(45deg, transparent 0 5px, rgba(248,81,73,0.1) 5px 6px)',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          fontSize: '0.62rem',
          color: isLegendary ? C.legendary : C.warning,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
          flexShrink: 0,
        }}>
          {card.sha}
        </div>
        {/* When blocked (and not legendary), prefix a red ✕ that's always visible */}
        {showBlockedHints && (
          <span style={{ color: C.danger, fontWeight: 700, fontSize: '0.7rem', marginRight: '-4px' }}>
            ✕
          </span>
        )}
        <div style={{
          fontSize: '0.62rem',
          color: isLegendary ? C.legendary : (blocked ? C.danger : s.color),
          fontWeight: 700,
          minWidth: '26px',
          letterSpacing: '0.03em',
          whiteSpace: 'nowrap',
        }}>
          {isLegendary ? '★' : (
            <>
              {s.name}
              <span style={{ color: C.faint, fontWeight: 400 }}>-{remaining}</span>
            </>
          )}
        </div>
        <div style={{
          fontSize: '0.78rem', fontWeight: 700,
          color: isLegendary ? C.legendary : C.text,
          minWidth: '24px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
        }}>
          {isLegendary ? (
            <span style={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>LGND</span>
          ) : (
            <>
              {card.value}
              <span style={{ color: C.faint, fontWeight: 400, fontSize: '0.6rem' }}>pt</span>
            </>
          )}
        </div>
        <div style={{
          fontSize: '0.75rem',
          color: isLegendary ? C.legendary : C.text,
          fontStyle: isLegendary ? 'italic' : 'normal',
          flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {card.description}
        </div>
      </div>

      {/* context + bonus row */}
      <div style={{
        marginTop: '3px',
        marginLeft: '72px',
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
        fontSize: '0.62rem',
      }}>
        <span style={{ color: C.faint, fontStyle: 'italic' }}>
          // {card.context}
        </span>
        {!isLegendary && card.bonus && (
          <span style={{
            marginLeft: 'auto',
            color: bonusFiresNow ? C.warning : C.muted,
            fontWeight: 700,
            letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
          }}>
            ★ {bonusLabel(card.bonus)} +{card.bonus.points}
            {bonusFiresNow && <span style={{ color: C.success, marginLeft: '4px' }}>✓ ready</span>}
          </span>
        )}
        {isLegendary && (
          <span style={{
            marginLeft: 'auto',
            color: C.legendary,
            fontWeight: 700,
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            fontSize: '0.58rem',
          }}>
            ★ auto-ship · 0 pt
          </span>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Stage — read-only display of cherry-picked fixes (final, no revert)
// ─────────────────────────────────────────────────────────────────────────────

function DeployPackage({ deployed, preview, blocked }) {
  const cardBonuses = preview.cardBonuses || [];
  if (deployed.length === 0) return null; // empty diff produces no output
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      marginBottom: '4px',
    }}>
      {deployed.map((card, i) => {
        const s = STACKS[card.stack];
        const cb = cardBonuses[i];
        const fired = cb && cb.fired;
        const isLegendary = !!card.legendary;
        // Legendary auto-pass overrides blocked-stack taint — don't flag it red.
        const isBlocked = !isLegendary && blocked && card.stack === blocked;
        const isFaulty = card.faulty;
        const eff = effectiveValue(card);

        // Cherry-picks are final — only faulty/blocked/legendary states earn a visible box,
        // since those are informational, not interactive.
        const showBox = isBlocked || isFaulty || isLegendary;
        const borderColor =
          isLegendary ? C.legendary :
          isBlocked   ? C.danger :
          isFaulty    ? C.danger :
          C.borderHi;
        const shadow = 'none';

        return (
          <div
            key={card.id}
            style={{
              position: 'relative',
              background: showBox ? C.panel : 'transparent',
              border: `1px solid ${showBox ? borderColor : 'transparent'}`,
              borderRadius: '4px',
              padding: '4px 10px 4px 4px',
              textAlign: 'left',
              fontFamily: "'JetBrains Mono', monospace",
              overflow: 'hidden',
              boxShadow: shadow,
            }}
            title={isFaulty ? 'bugged · committed, cannot be reverted' : ''}
          >
            {showBox && (
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                background: isLegendary ? C.legendary : (isFaulty || isBlocked) ? C.danger : s.color,
              }} />
            )}
            {isBlocked && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(45deg, transparent 0 5px, rgba(248,81,73,0.12) 5px 6px)',
                pointerEvents: 'none',
              }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
              <span style={{ color: C.faint, fontWeight: 700, minWidth: '14px' }}>{i + 1}.</span>
              <span style={{
                color: isLegendary ? C.legendary : C.warning,
                fontWeight: 700,
                fontSize: '0.62rem',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
              }}>
                {card.sha}
              </span>
              {isBlocked && (
                <span style={{ color: C.danger, fontWeight: 700, fontSize: '0.7rem', marginRight: '-4px' }}>
                  ✕
                </span>
              )}
              <span style={{
                color: isLegendary ? C.legendary : (isBlocked ? C.danger : s.color),
                fontWeight: 700, minWidth: '26px', fontSize: '0.62rem',
              }}>
                {isLegendary ? '★' : s.name}
              </span>
              <span style={{
                color: isLegendary ? C.legendary : (isFaulty ? C.danger : C.text),
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {isLegendary ? '0' : (isFaulty ? eff : card.value)}
                {fired && !isLegendary && (
                  <>
                    <span style={{ color: C.faint, fontWeight: 400 }}>+</span>
                    <span style={{ color: C.warning, fontWeight: 700 }}>{cb.points}</span>
                  </>
                )}
              </span>
              <span style={{
                flex: 1, minWidth: 0,
                color: isLegendary ? C.legendary : C.text,
                fontStyle: isLegendary ? 'italic' : 'normal',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {card.description}
                {isFaulty && (
                  <span style={{
                    color: C.danger,
                    marginLeft: '6px',
                    fontWeight: 700,
                  }}>
                    bugged
                  </span>
                )}
                {isLegendary && (
                  <span style={{
                    color: C.legendary,
                    marginLeft: '6px',
                    fontWeight: 700,
                    fontStyle: 'normal',
                  }}>
                    · {card.author}
                  </span>
                )}
              </span>
              {!isLegendary && card.bonus && (
                <span style={{
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  color: fired ? C.warning : C.faint,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {fired ? '★ ' : '☆ '}{bonusLabel(card.bonus)}
                </span>
              )}
              {isLegendary && (
                <span style={{
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  color: C.legendary,
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  LEGENDARY
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────────────────────

export default function OnCall() {
  // Per-stack draw pool — fixes waiting behind the one currently in candidates.
  // Built once at startShift() with fixed faulty/legendary quotas; sliced as
  // fixes are played. `usesRemaining` below is derived from this + candidates.
  const [pool, setPool]                   = useState({});
  // Fix candidates: one fix per stack (preview of what would be staged next from that stack)
  const [hand, setHand]                   = useState({});
  // Stage: ordered array of staged fixes, max 3
  const [deployed, setDeployed]           = useState([]);
  const [tickets, setTickets]             = useState([]);
  const [activeUid, setActiveUid]         = useState(null);
  // Terminal load animation: each time a ticket becomes active, the two
  // diagnostic commands type themselves into the terminal in sequence. loadStep
  // tracks how far the sequence has progressed (0..1 = command N is typing,
  // 2 = all done, panel is fully interactive). loadKey forces the typewriter
  // effects to restart even when the same command string is reused.
  const [loadStep, setLoadStep]           = useState(2);
  const [loadKey, setLoadKey]             = useState(0);
  const [credits, setCredits]             = useState(0);
  const [strikes, setStrikes]             = useState(3);
  const [resolved, setResolved]           = useState(0);
  // Anti-snowball: armed when the player drops to 1 strike on a rejection;
  // disarmed after softening the very next rolled ticket.
  const [mercyArmed, setMercyArmed]       = useState(false);
  // Phases: 'intro' | 'playing' | 'over'. Stages auto-ship on the 3rd
  // placement, so there's no separate 'result' phase — the just-finished
  // ticket lives in `closedTickets` and is surfaced via `viewingClosedUid`.
  const [phase, setPhase]                 = useState('intro');
  // Cherry-pick lines accumulated during the current ticket — each fix the
  // player chooses appends an entry, cleared when a new ticket loads.
  const [pickHistory, setPickHistory]     = useState([]);
  // Closed tickets archive — successful or rejected, with their final push result
  const [closedTickets, setClosedTickets] = useState([]);
  // When set, the terminal + main triage panel switch to read-only display
  // of that closed ticket (its push output and its final outcome).
  const [viewingClosedUid, setViewingClosedUid] = useState(null);
  // Current shift's fake service hostname (shown in the terminal header).
  const [host, setHost] = useState(() => genHost());
  // Hostname surfaced in the over-phase `$ ssh dev@...` prompt — frozen the
  // moment we enter 'over' so the prompt label matches the host we'll actually
  // use on restart.
  const [nextHost, setNextHost] = useState(null);

  // Theme — 'dark' (default) or 'light'. Persisted to localStorage.
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('oncall:theme') || 'dark';
    } catch {
      return 'dark';
    }
  });
  useEffect(() => {
    try { localStorage.setItem('oncall:theme', theme); } catch {}
    // Stamp data-theme on <html> so CSS variables resolve at the document
    // root — that way html, body, and every descendant inherit the palette.
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Past runs — appended when a shift ends. Persisted to localStorage.
  const [history, setHistory] = useState(() => {
    try {
      const raw = localStorage.getItem('oncall:history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try { localStorage.setItem('oncall:history', JSON.stringify(history)); } catch {}
  }, [history]);

  // Toggle for the history list rendered at the very bottom of the page.
  const [showHistory, setShowHistory] = useState(false);

  // Tutorial: in-memory only, so any page reload re-arms it. Dismissed for the
  // current page-load session once the user finishes or skips.
  const [tutorialDismissed, setTutorialDismissed] = useState(false);
  const inboxRef   = useRef(null);
  const ticketRef  = useRef(null);
  const doneRef    = useRef(null);
  const gitLogRef  = useRef(null);
  const gitDiffRef = useRef(null);

  const ticket = useMemo(
    () => tickets.find(t => t.uid === activeUid) || null,
    [tickets, activeUid]
  );
  // Re-trigger the typewriter sequence in the terminal whenever a different
  // ticket becomes active during play (start of shift or pickup from the
  // inbox). viewingClosedUid takes over the terminal with the closed-ticket
  // view, so we skip animating in that case.
  useEffect(() => {
    if (activeUid && !viewingClosedUid && phase === 'playing') {
      setLoadStep(0);
      setLoadKey(k => k + 1);
    }
  }, [activeUid, viewingClosedUid, phase]);
  // Cherry-pick lines belong to a specific ticket: drop them whenever the
  // active ticket changes (incl. transitions to null on auto-ship).
  useEffect(() => {
    setPickHistory([]);
  }, [activeUid]);

  const viewingClosed = useMemo(
    () => closedTickets.find(c => c.ticket.uid === viewingClosedUid) || null,
    [closedTickets, viewingClosedUid]
  );

  // Per-stack "draws still possible" count: the candidate currently shown plus
  // every fix still queued in the pool. Surfaces as the "-n" appendix on each
  // fix candidate's tag.
  const usesRemaining = useMemo(() => {
    const out = {};
    STACK_KEYS.forEach(s => {
      out[s] = (hand[s] ? 1 : 0) + (pool[s]?.length || 0);
    });
    return out;
  }, [hand, pool]);

  function startShift() {
    const decks = buildShiftDecks();
    const initialHand = {};
    const initialPool = {};
    STACK_KEYS.forEach(s => {
      initialHand[s] = decks[s][0] || null;
      initialPool[s] = decks[s].slice(1);
    });
    // Pin the host for this shift up front so the initial queue's ticket IDs
    // already use the new project key (state setters wouldn't have flushed yet).
    const shiftHost = nextHost || genHost();
    const key = projectKey(shiftHost);
    const initialQueue = [
      rollTicket(0, { projectKey: key }),
      rollTicket(0, { projectKey: key }),
      rollTicket(0, { projectKey: key }),
    ];
    setPool(initialPool);
    setHand(initialHand);
    setDeployed([]);
    setTickets(initialQueue);
    setActiveUid(initialQueue[0].uid);
    setCredits(0);
    setStrikes(3);
    setResolved(0);
    setMercyArmed(false);
    setPickHistory([]);
    setClosedTickets([]);
    setViewingClosedUid(null);
    setHost(shiftHost);
    setNextHost(null);
    setPhase('playing');
  }

  // Pick a ticket from the inbox to become the active task. Always clears
  // any closed-view because we're moving on to real work.
  function selectTicket(uid) {
    if (phase !== 'playing') return;
    const t = tickets.find(x => x.uid === uid);
    if (!t) return;
    setViewingClosedUid(null);
    setActiveUid(uid);
  }

  // Stage the candidate from stack S.
  // On the 3rd placement the stage ships automatically: the ticket gets
  // scored, archived to the DONE list, removed from the inbox, and a fresh
  // ticket is drawn. The player stays parked on the just-finished ticket
  // (viewingClosedUid) until they pick a new inbox ticket or click another
  // closed entry.
  function placeFromHand(stack) {
    if (phase !== 'playing') return;
    if (viewingClosedUid) return;
    if (!ticket) return;
    if (deployed.length >= 3) return;
    const card = hand[stack];
    if (!card) return;

    const newDeployed = [...deployed, card];
    // Pop the next pool fix into candidates; null if the pool for this stack is dry.
    const newPoolForStack = pool[stack] || [];
    const nextCard = newPoolForStack[0] || null;
    const newPool = { ...pool, [stack]: newPoolForStack.slice(1) };
    const newHand = { ...hand, [stack]: nextCard };
    setPool(newPool);
    setHand(newHand);
    setPickHistory(prev => [
      ...prev,
      {
        id: `${card.sha}-${prev.length}`,
        cmd: `git cherry-pick ${card.sha}`,
        note: `${STACKS[card.stack].name}: ${card.description}`,
      },
    ]);

    if (newDeployed.length < 3) {
      setDeployed(newDeployed);
      return;
    }

    // Auto-ship on the third placement.
    const deployedCards = newDeployed.map(c => ({ ...c }));
    const score = scoreDeploy(newDeployed, ticket);
    const success = !score.tainted && score.allPassed;
    const sha = Math.floor(Math.random() * 0xfffffff).toString(16).padStart(7, '0');

    const remainingInbox  = tickets.filter(t => t.uid !== activeUid);
    const skipRaw         = skipPenaltyFor(ticket, remainingInbox);
    // Scale skip penalty by the resolved ticket's reward multiplier — closing
    // a low-priority ticket for ×2 credits while a prio-1 sits in the inbox
    // now actually costs proportional velocity.
    const skipTotalScaled = skipRaw.total * ticket.reward;
    const skipScaled      = {
      total: skipTotalScaled,
      skipped: skipRaw.skipped.map(s => ({ ...s, penalty: s.penalty * ticket.reward })),
    };

    let result;
    if (success) {
      const earned = score.total * ticket.reward;
      result = { success: true, ...score, earned, cards: deployedCards, sha, skipPenalty: skipScaled.total, skipped: skipScaled.skipped };
    } else {
      let why;
      if (score.tainted) {
        why = `Touched blocked stack: ${STACKS[ticket.blocked].name}.`;
      } else {
        const failed = score.reqStatus.filter(r => !r.passed);
        why = failed
          .map(r => `${STACKS[r.stack].name} short: ${r.effective}/${r.threshold}`)
          .join(' · ');
      }
      result = { success: false, ...score, msg: why, cards: deployedCards, sha, skipPenalty: skipScaled.total, skipped: skipScaled.skipped };
    }

    const newClosed       = [...closedTickets, { ticket, result }];
    const newStrikes      = success ? strikes : strikes - 1;
    const newCredits      = (success ? credits + result.earned : credits) - skipScaled.total;
    const nextResolved    = resolved + (success ? 1 : 0);
    // Game ends on 3 rejections, or when the player can't field another
    // 3-fix stage out of the remaining fix pool.
    const remainingFixes  = STACK_KEYS.reduce(
      (sum, s) => sum + (newHand[s] ? 1 : 0) + (newPool[s]?.length || 0),
      0
    );
    const isOver          = newStrikes <= 0 || remainingFixes < 3;

    // Anti-snowball: failing down to the last life arms a mercy flag that
    // makes the very next rolled ticket softer (see rollTicket call below).
    if (!isOver && !success && newStrikes === 1) {
      setMercyArmed(true);
    }

    setDeployed([]);
    setCredits(newCredits);
    setStrikes(newStrikes);
    setResolved(nextResolved);
    setClosedTickets(newClosed);
    setActiveUid(null);
    setViewingClosedUid(ticket.uid);

    if (isOver) {
      setTickets(remainingInbox);
      setNextHost(genHost());
      setPhase('over');
      const reason = newStrikes <= 0 ? 'paged' : 'depleted';
      setHistory(prev => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          credits: newCredits,
          resolved: nextResolved,
          rejected: 3 - newStrikes,
          reason,
          at: new Date().toISOString(),
        },
      ]);
    } else {
      const nextTicket = rollTicket(nextResolved, { mercy: mercyArmed, projectKey: projectKey(host) });
      if (mercyArmed) setMercyArmed(false);
      setTickets([...remainingInbox, nextTicket]);
    }
  }

  const preview = useMemo(() => {
    if (!ticket) {
      return { perStack: {}, reqStatus: [], baseScore: 0, combos: [], comboBonus: 0, cardBonuses: [], total: 0, tainted: false, allPassed: false, partial: true };
    }
    if (deployed.length === 0) {
      const reqStatus = ticket.requirements.map(r => ({
        stack: r.stack, threshold: r.threshold, stackSum: 0, bonusApplied: 0, effective: 0, passed: false,
      }));
      return { perStack: {}, reqStatus, baseScore: 0, combos: [], comboBonus: 0, cardBonuses: [], total: 0, tainted: false, allPassed: false, partial: true };
    }
    if (deployed.length < 3) {
      // Partial: per-fix bonuses can fire (e.g. "first", "after X") even with <3 fixes
      const perStack = {};
      ticket.requirements.forEach(r => { perStack[r.stack] = 0; });
      const cardBonuses = deployed.map((c, idx) => ({
        fired: bonusFires(c.bonus, idx, deployed),
        bonus: c.bonus,
        points: c.bonus && bonusFires(c.bonus, idx, deployed) ? c.bonus.points : 0,
      }));
      deployed.forEach((c, idx) => {
        if (perStack[c.stack] !== undefined) {
          perStack[c.stack] += effectiveValue(c) + cardBonuses[idx].points;
        }
      });
      const tainted = !!ticket.blocked && deployed.some(c => c.stack === ticket.blocked);
      const reqStatus = ticket.requirements.map(r => {
        const stackSum = perStack[r.stack] || 0;
        return { stack: r.stack, threshold: r.threshold, stackSum, bonusApplied: 0, effective: stackSum, passed: stackSum >= r.threshold };
      });
      const baseScore = Object.values(perStack).reduce((a, b) => a + b, 0);
      const allPassed = reqStatus.every(r => r.passed);
      return { perStack, reqStatus, baseScore, combos: [], comboBonus: 0, cardBonuses, total: baseScore, tainted, allPassed, partial: true };
    }
    return { ...scoreDeploy(deployed, ticket), partial: false };
  }, [deployed, ticket]);

  const narrow = useIsNarrow();

  const tutorialSteps = useMemo(
    () => buildTutorialSteps({ ticket, refs: { inboxRef, ticketRef, doneRef, gitLogRef, gitDiffRef } }),
    [ticket]
  );

  const tutorialActive = phase === 'playing' && !tutorialDismissed && loadStep >= 2 && !!ticket;

  useEffect(() => {
    if (!tutorialActive) return undefined;
    const onKey = e => { if (e.key === 'Escape') setTutorialDismissed(true); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tutorialActive]);

  return (
    <div data-theme={theme} style={{
      background: C.bg,
      color: C.text,
      fontFamily: "'JetBrains Mono', monospace",
      padding: narrow ? '8px' : '12px',
      transition: 'background 0.2s ease, color 0.2s ease',
    }}>
      <style>{FONTS_CSS}</style>

      {phase === 'intro' && <IntroScreen onStart={startShift} />}

      {phase !== 'intro' && (
        <>
          {/* ─── Tracker panel ──── manager's view ──── */}
          <TrackerPanel>
            <TrackerHeader onShift={phase === 'playing'} />
            <TrackerStats credits={credits} strikes={strikes} resolved={resolved} />

            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              padding: '0 0 10px',
            }}>
              {/* LEFT: inbox queue — full width on narrow viewports */}
              <div ref={inboxRef} style={{
                flex: narrow ? '1 1 100%' : '1 1 240px',
                maxWidth: narrow ? '100%' : '300px',
                minWidth: 0,
              }}>
                <TrackerSection
                  label="INBOX"
                  count={tickets.length}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 10px 0 14px' }}>
                  {tickets.map(t => (
                    <QueueRow
                      key={t.uid}
                      ticket={t}
                      active={t.uid === activeUid}
                      disabled={phase === 'over'}
                      // After auto-ship the player is parked on the just-
                      // finished ticket (no active). The inbox rows are how
                      // they pick the next task — light them up to invite.
                      pickable={phase === 'playing' && !activeUid}
                      onClick={() => selectTicket(t.uid)}
                    />
                  ))}
                </div>
              </div>

              {/* MIDDLE: ticket detail — active OR closed (when viewing) */}
              <div ref={ticketRef} style={{ flex: '99 1 320px', minWidth: 0 }}>
                <TrackerSection
                  label={
                    viewingClosed
                      ? `DONE TICKET · ${viewingClosed.result.success ? 'RESOLVED' : 'REJECTED'}`
                      : 'ACTIVE TICKET'
                  }
                  tone={
                    viewingClosed
                      ? (viewingClosed.result.success ? 'success' : 'danger')
                      : 'default'
                  }
                />
                <div style={{ padding: '0 14px 0 10px' }}>
                  {viewingClosed ? (
                    <ClosedTicketCard ticket={viewingClosed.ticket} result={viewingClosed.result} />
                  ) : ticket ? (
                    <TicketCard ticket={ticket} preview={preview} />
                  ) : (
                    <div style={{
                      padding: '14px 4px',
                      fontSize: '0.72rem',
                      color: C.faint,
                      fontStyle: 'italic',
                    }}>
                      // no ticket selected — pick one from the inbox
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: closed tickets — full width on narrow viewports */}
              <div ref={doneRef} style={{
                flex: narrow ? '1 1 100%' : '1 1 220px',
                maxWidth: narrow ? '100%' : '280px',
                minWidth: 0,
              }}>
                <TrackerSection label="DONE" count={closedTickets.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 14px 0 10px' }}>
                  {closedTickets.length === 0 ? (
                    <div style={{
                      fontSize: '0.62rem',
                      color: C.faint,
                      fontStyle: 'italic',
                      padding: '4px 4px',
                    }}>
                      // no tickets closed yet
                    </div>
                  ) : (
                    closedTickets.map(c => (
                      <ClosedRow
                        key={c.ticket.uid}
                        ticket={c.ticket}
                        result={c.result}
                        viewing={viewingClosedUid === c.ticket.uid}
                        onClick={() => setViewingClosedUid(c.ticket.uid)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </TrackerPanel>

          {/* ─── Terminal panel ──── engineer's view ──── */}
          <TerminalPanel>
            <TerminalHeader host={host} />

            {viewingClosed ? (
              <ClosedView entry={viewingClosed} />
            ) : phase !== 'over' && (
              <>
                {/* The terminal "boots" two diagnostic commands when a ticket
                    loads: each line types itself in real time, then the
                    corresponding output snaps in before the next command
                    starts. loadStep drives the gating; loadKey forces a fresh
                    typewriter run on every ticket switch. */}
                <div ref={gitDiffRef}>
                  <TerminalPrompt
                    command="git diff --staged HEAD~3..HEAD"
                    comment={
                      !ticket ? 'no ticket selected · pick one from the inbox' :
                      deployed.length === 0 ? 'nothing staged' :
                      deployed.length < 3 ? `${deployed.length}/3 staged · the 3rd pick auto-ships` :
                      '3/3 staged'
                    }
                    typing={loadStep === 0}
                    typingKey={loadKey}
                    onTyped={() => setLoadStep(s => (s < 1 ? 1 : s))}
                  />
                  {loadStep >= 1 && (
                    <div style={{ padding: '0 10px' }}>
                      <DeployPackage
                        deployed={deployed}
                        preview={preview}
                        blocked={ticket?.blocked}
                        phase={phase}
                      />
                    </div>
                  )}
                </div>

                {loadStep >= 1 && (
                  <div ref={gitLogRef}>
                    <TerminalPrompt
                      command="git log -4 fix-candidates --oneline"
                      comment="tap to cherry-pick into stage"
                      typing={loadStep === 1}
                      typingKey={loadKey}
                      onTyped={() => setLoadStep(s => (s < 2 ? 2 : s))}
                    />
                    {loadStep >= 2 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '0 10px 4px' }}>
                        {STACK_KEYS.map(s => (
                          <HandCard
                            key={s}
                            stack={s}
                            card={hand[s]}
                            remaining={usesRemaining[s] ?? 0}
                            blocked={ticket && s === ticket.blocked}
                            deployFull={deployed.length >= 3}
                            deployed={deployed}
                            phase={phase}
                            onClick={() => placeFromHand(s)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {loadStep >= 2 && pickHistory.map((entry, i) => (
                  <TerminalPrompt
                    key={entry.id}
                    command={entry.cmd}
                    comment={entry.note}
                    typing={i === pickHistory.length - 1}
                    typingKey={entry.id}
                  />
                ))}
              </>
            )}

            {/* Shift summary + restart always anchor the over-phase view,
                even when a closed ticket is being inspected above. */}
            {phase === 'over' && (
              <>
                <div style={{ height: '6px' }} />
                <ShiftSummary
                  credits={credits}
                  resolved={resolved}
                  rejected={3 - strikes}
                  reason={strikes <= 0 ? 'paged' : 'depleted'}
                />
                <TerminalPrompt
                  command={`ssh dev@${nextHost || ''}`}
                  comment="connect to a fresh shift"
                  onClick={startShift}
                />
              </>
            )}
          </TerminalPanel>
        </>
      )}

      <ThemeSwitch theme={theme} onChange={setTheme} />
      <HistoryPanel history={history} open={showHistory} onToggle={() => setShowHistory(v => !v)} />

      {tutorialActive && (
        <Tutorial
          steps={tutorialSteps}
          onClose={() => setTutorialDismissed(true)}
        />
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '4px 0 14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '0.65rem',
        color: C.faint,
      }}>
        <a
          href="https://github.com/placek/on-call"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: C.faint,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = C.accent; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.faint; }}
        >
          <span style={{ fontSize: '0.7rem' }}>↗</span>
          github.com/placek/on-call
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  History panel — anchored at the very bottom. A pill button toggles a list
//  of past shifts (highest velocity first). Click an entry to inspect, or
//  hit the trash to wipe the whole log from localStorage.
// ─────────────────────────────────────────────────────────────────────────────
function HistoryPanel({ history, open, onToggle }) {
  const narrow = useIsNarrow();
  const sorted = useMemo(
    () => [...history].sort((a, b) => b.credits - a.credits),
    [history]
  );
  // Mood lookup by run id — derived from the chronological order so each
  // sprint is compared against the one immediately before it.
  const moodById = useMemo(() => {
    const chrono = [...history].sort((a, b) => new Date(a.at) - new Date(b.at));
    const m = {};
    chrono.forEach((r, i) => {
      m[r.id] = moodForSprint(r, i > 0 ? chrono[i - 1] : null);
    });
    return m;
  }, [history]);
  return (
    <div style={{
      maxWidth: '720px',
      margin: '6px auto 14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={onToggle}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            background: open ? C.panel2 : C.trackerBg,
            color: open ? C.text : C.muted,
            border: `1px solid ${C.trackerBorder}`,
            borderRadius: '999px',
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
            cursor: 'pointer',
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
        >
          <span style={{ fontSize: '0.65rem', color: C.faint }}>
            {open ? '▾' : '▸'}
          </span>
          the sprints summary
          <span style={{
            fontSize: '0.6rem',
            fontWeight: 500,
            color: C.faint,
          }}>
            ({history.length})
          </span>
        </button>
      </div>

      {open && (
        <div style={{
          marginTop: '10px',
          background: C.trackerBg,
          border: `1px solid ${C.trackerBorder}`,
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <SprintsChart history={history} />

          {/* table header — desktop only; on narrow each row is self-labeled */}
          {!narrow && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 80px 70px 70px 110px',
              gap: '8px',
              padding: '8px 12px',
              borderBottom: `1px solid ${C.trackerBorder}`,
              fontSize: '0.55rem',
              letterSpacing: '0.08em',
              fontWeight: 600,
              color: C.faint,
            }}>
              <span>#</span>
              <span>velocity</span>
              <span style={{ textAlign: 'right' }}>resolved</span>
              <span style={{ textAlign: 'right' }}>rejected</span>
              <span style={{ textAlign: 'right' }}>ended</span>
              <span style={{ textAlign: 'right' }}>date</span>
            </div>
          )}

          {sorted.length === 0 ? (
            <div style={{
              padding: '18px 12px',
              fontSize: '0.72rem',
              color: C.faint,
              fontStyle: 'italic',
              textAlign: 'center',
            }}>
              no previous runs yet — finish a shift to see it here
            </div>
          ) : (
            sorted.map((r, i) => {
              const isTop = i === 0;
              const mood = moodById[r.id] || 'neutral';
              const mc = moodColor(mood);
              const mg = moodGlyph(mood);
              if (narrow) {
                // Mobile: rank + velocity on a primary line, meta on a secondary muted line.
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: '8px 12px',
                      borderBottom: i === sorted.length - 1 ? 'none' : `1px solid ${C.trackerBorder}`,
                      background: isTop ? C.panel2 : 'transparent',
                      position: 'relative',
                    }}
                  >
                    {/* mood color band on the left edge */}
                    <div style={{
                      position: 'absolute',
                      left: 0, top: 0, bottom: 0,
                      width: '3px',
                      background: mc,
                      opacity: 0.85,
                    }} />
                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '10px',
                      fontSize: '0.78rem',
                    }}>
                      <span style={{
                        color: isTop ? C.success : C.faint,
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: isTop ? 700 : 500,
                        minWidth: '18px',
                      }}>
                        {isTop ? '★' : i + 1}
                      </span>
                      <span style={{
                        color: isTop ? C.success : C.text,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {r.credits}
                      </span>
                      <span style={{
                        color: mc,
                        fontWeight: 700,
                        fontSize: '0.7rem',
                      }} title={moodLabel(mood)}>
                        {mg}
                      </span>
                      <span style={{
                        marginLeft: 'auto',
                        fontSize: '0.6rem',
                        color: r.reason === 'paged' ? C.danger : C.muted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontWeight: 600,
                      }}>
                        {r.reason}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      marginTop: '2px',
                      fontSize: '0.6rem',
                      color: C.faint,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      <span>{r.resolved} resolved</span>
                      <span style={{ color: r.rejected >= 3 ? C.danger : C.faint }}>{r.rejected} rejected</span>
                      <span style={{ marginLeft: 'auto' }}>{formatRunDate(r.at)}</span>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr 80px 70px 70px 110px',
                    gap: '8px',
                    padding: '8px 12px',
                    fontSize: '0.72rem',
                    borderBottom: i === sorted.length - 1 ? 'none' : `1px solid ${C.trackerBorder}`,
                    background: isTop ? C.panel2 : 'transparent',
                    color: C.text,
                    position: 'relative',
                  }}
                >
                  {/* mood color band on the left edge */}
                  <div style={{
                    position: 'absolute',
                    left: 0, top: 0, bottom: 0,
                    width: '3px',
                    background: mc,
                    opacity: 0.85,
                  }} />
                  <span style={{
                    color: isTop ? C.success : C.faint,
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: isTop ? 700 : 500,
                  }}>
                    {isTop ? '★' : i + 1}
                  </span>
                  <span style={{
                    color: isTop ? C.success : C.text,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: '6px',
                  }}>
                    {r.credits}
                    <span style={{ color: mc, fontWeight: 700, fontSize: '0.7rem' }} title={moodLabel(mood)}>
                      {mg}
                    </span>
                  </span>
                  <span style={{
                    textAlign: 'right',
                    color: C.muted,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {r.resolved}
                  </span>
                  <span style={{
                    textAlign: 'right',
                    color: r.rejected >= 3 ? C.danger : C.muted,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {r.rejected}
                  </span>
                  <span style={{
                    textAlign: 'right',
                    color: r.reason === 'paged' ? C.danger : C.muted,
                    fontSize: '0.65rem',
                  }}>
                    {r.reason}
                  </span>
                  <span style={{
                    textAlign: 'right',
                    color: C.faint,
                    fontSize: '0.65rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatRunDate(r.at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function formatRunDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PO expectations
//   ≥ 90% of previous velocity → happy
//   60–90%                     → concerned
//   < 60%                      → disappointed
//   first sprint (no baseline) → neutral
//
//  Streaks of non-happy moods escalate to a "PIP territory" banner;
//  streaks of happy moods escalate to "PO ecstatic".
// ─────────────────────────────────────────────────────────────────────────────
function moodForSprint(curr, prev) {
  if (!prev) return 'neutral';
  if (prev.credits <= 0) return curr.credits >= prev.credits ? 'happy' : 'concerned';
  const ratio = curr.credits / prev.credits;
  if (ratio >= 0.9) return 'happy';
  if (ratio >= 0.6) return 'concerned';
  return 'disappointed';
}

function moodColor(mood) {
  if (mood === 'happy') return C.success;
  if (mood === 'concerned') return C.warning;
  if (mood === 'disappointed') return C.danger;
  return C.faint;
}

function moodGlyph(mood) {
  if (mood === 'happy') return '✓';
  if (mood === 'concerned') return '~';
  if (mood === 'disappointed') return '↓';
  return '·';
}

function moodLabel(mood) {
  if (mood === 'happy') return 'PO happy';
  if (mood === 'concerned') return 'PO concerned';
  if (mood === 'disappointed') return 'PO disappointed';
  return 'baseline sprint';
}

// Aggregate the trailing streak into a single status chip. Cumulative
// non-happy sprints escalate; cumulative happy sprints celebrate.
function poStatus(moods) {
  if (moods.length === 0) return { label: '—', color: C.faint };
  const last = moods[moods.length - 1];
  let dip = 0;
  for (let i = moods.length - 1; i >= 0; i--) {
    if (moods[i] === 'happy' || moods[i] === 'neutral') break;
    dip++;
  }
  let happy = 0;
  for (let i = moods.length - 1; i >= 0; i--) {
    if (moods[i] !== 'happy') break;
    happy++;
  }
  if (dip >= 3) return { label: `PIP territory · ${dip} down`, color: C.danger };
  if (happy >= 3) return { label: `PO ecstatic · ${happy} streak`, color: C.success };
  return { label: moodLabel(last), color: moodColor(last) };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SprintsChart — at-a-glance burndown-style view of past shifts. Each bar
//  is one shift, chronological L→R. Encodes three aspects per sprint:
//    height       → velocity (credits earned)
//    color        → end reason  (green=depleted, red=paged)
//    annotation   → resolved (·N) and rejected (·X) counts below the bar
//  A dashed line shows the running personal best so the trend is obvious,
//  and a ★ marks the bar that holds it.
// ─────────────────────────────────────────────────────────────────────────────
function SprintsChart({ history }) {
  const chronological = useMemo(
    () => [...history].sort((a, b) => new Date(a.at) - new Date(b.at)),
    [history]
  );

  if (chronological.length === 0) {
    return (
      <div style={{
        padding: '24px 12px',
        textAlign: 'center',
        color: C.faint,
        fontStyle: 'italic',
        fontSize: '0.72rem',
        borderBottom: `1px solid ${C.trackerBorder}`,
      }}>
        no sprints yet — finish a shift to start the burndown
      </div>
    );
  }

  const maxCredits = Math.max(1, ...chronological.map(r => Math.max(0, r.credits)));
  const bestIdx = chronological.reduce(
    (bi, r, i, a) => (r.credits > a[bi].credits ? i : bi),
    0
  );
  const totals = chronological.reduce(
    (acc, r) => {
      acc.resolved += r.resolved;
      acc.rejected += r.rejected;
      if (r.reason === 'paged') acc.paged++;
      else acc.depleted++;
      return acc;
    },
    { resolved: 0, rejected: 0, paged: 0, depleted: 0 }
  );
  const avgCredits = Math.round(
    chronological.reduce((s, r) => s + r.credits, 0) / chronological.length
  );

  // PO mood per sprint (compared to the immediately previous sprint).
  const moods = chronological.map(
    (r, i) => moodForSprint(r, i > 0 ? chronological[i - 1] : null)
  );
  const po = poStatus(moods);

  // SVG coordinate system — scales to its container via viewBox.
  const W = 600;
  const H = 210;
  const padL = 32, padR = 12, padT = 36, padB = 44;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = chronological.length;
  const barGap = Math.min(6, innerW / (n * 4));
  const barW = (innerW - barGap * Math.max(0, n - 1)) / n;
  const bestY = padT + innerH - (chronological[bestIdx].credits / maxCredits) * innerH;

  return (
    <div style={{ borderBottom: `1px solid ${C.trackerBorder}` }}>
      {/* Top stats strip — quick read of the whole history */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '10px 14px 6px',
        fontSize: '0.65rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <StatChip label="best" value={chronological[bestIdx].credits} color={C.legendary} />
        <StatChip label="avg"  value={avgCredits}                     color={C.accent} />
        <StatChip label="resolved" value={totals.resolved}             color={C.success} />
        <StatChip label="paged"    value={totals.paged}                color={totals.paged > 0 ? C.danger : C.muted} />
        <StatChip label="po" value={po.label} color={po.color} />
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '180px', display: 'block' }}
      >
        {/* y-axis baseline */}
        <line
          x1={padL} y1={padT + innerH}
          x2={W - padR} y2={padT + innerH}
          stroke={C.trackerBorder} strokeWidth="1"
        />

        {/* personal-best reference line */}
        <line
          x1={padL} y1={bestY}
          x2={W - padR} y2={bestY}
          stroke={C.legendary}
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.55"
        />
        <text
          x={padL - 4} y={bestY - 4}
          fontSize="9"
          fill={C.legendary}
          textAnchor="end"
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        >
          best {chronological[bestIdx].credits}
        </text>

        {/* y-axis max label */}
        <text
          x={padL - 6} y={padT + 8}
          fontSize="9"
          fill={C.faint}
          textAnchor="end"
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        >
          {maxCredits}
        </text>
        <text
          x={padL - 6} y={padT + innerH}
          fontSize="9"
          fill={C.faint}
          textAnchor="end"
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        >
          0
        </text>

        {/* bars */}
        {chronological.map((r, i) => {
          const x = padL + i * (barW + barGap);
          const safe = Math.max(0, r.credits);
          const h = (safe / maxCredits) * innerH;
          const y = padT + innerH - h;
          const color = r.reason === 'paged' ? C.danger : C.success;
          const isBest = i === bestIdx;
          const cx = x + barW / 2;
          const mood = moods[i];
          const mc = moodColor(mood);
          const mg = moodGlyph(mood);
          return (
            <g key={r.id}>
              <rect
                x={x} y={y} width={barW} height={h}
                fill={color}
                opacity={isBest ? 1 : 0.78}
              >
                <title>{`#${i + 1} · ${r.credits} velocity · ${r.resolved} resolved · ${r.rejected} rejected · ${r.reason} · ${moodLabel(mood)} · ${formatRunDate(r.at)}`}</title>
              </rect>
              {isBest && (
                <text
                  x={cx} y={y - 26}
                  fontSize="12"
                  fill={C.legendary}
                  textAnchor="middle"
                  fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                >★</text>
              )}
              {/* PO mood glyph above each bar */}
              <text
                x={cx} y={y - 14}
                fontSize="10"
                fontWeight="700"
                fill={mc}
                textAnchor="middle"
                fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              >
                {mg}
              </text>
              {/* velocity number above each bar */}
              <text
                x={cx} y={y - 3}
                fontSize="9"
                fill={C.muted}
                textAnchor="middle"
                fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              >
                {r.credits}
              </text>
              {/* resolved · rejected breakdown below bar */}
              <text
                x={cx} y={padT + innerH + 12}
                fontSize="8.5"
                fill={C.faint}
                textAnchor="middle"
                fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              >
                ·{r.resolved}
              </text>
              <text
                x={cx} y={padT + innerH + 24}
                fontSize="8.5"
                fill={r.rejected >= 3 ? C.danger : C.faint}
                textAnchor="middle"
                fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              >
                ✗{r.rejected}
              </text>
            </g>
          );
        })}

        {/* axis labels */}
        <text
          x={padL} y={H - 4}
          fontSize="8"
          fill={C.faint}
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        >
          oldest →
        </text>
        <text
          x={W - padR} y={H - 4}
          fontSize="8"
          fill={C.faint}
          textAnchor="end"
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        >
          ← newest
        </text>
      </svg>

      {/* compact legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '0 14px 10px',
        fontSize: '0.6rem',
        color: C.faint,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <LegendDot color={C.success}   label="ended depleted" />
        <LegendDot color={C.danger}    label="paged off" />
        <LegendDot color={C.legendary} label="personal best" />
        <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
          PO: <span style={{ color: C.success }}>✓ happy</span> ·{' '}
          <span style={{ color: C.warning }}>~ concerned</span> ·{' '}
          <span style={{ color: C.danger }}>↓ disappointed</span>
        </span>
      </div>
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: '4px',
    }}>
      <span style={{
        color: C.faint,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: 600,
      }}>
        {label}
      </span>
      <span style={{
        color,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        fontSize: '0.78rem',
      }}>
        {value}
      </span>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{
        width: '8px',
        height: '8px',
        borderRadius: '2px',
        background: color,
        display: 'inline-block',
      }} />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Theme switch — anchored at the bottom of the page. Two pill segments
//  (Dark / Light) with the active one filled in. Changes propagate via the
//  data-theme attribute on the root and the CSS variables defined in
//  FONTS_CSS, so every component re-reads its colors automatically.
// ─────────────────────────────────────────────────────────────────────────────
function ThemeSwitch({ theme, onChange }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      marginTop: '14px',
      paddingBottom: '6px',
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px',
        background: C.trackerBg,
        border: `1px solid ${C.trackerBorder}`,
        borderRadius: '999px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <ThemeOption label="Dark"  icon="●" active={theme === 'dark'}  onClick={() => onChange('dark')}  />
        <ThemeOption label="Light" icon="○" active={theme === 'light'} onClick={() => onChange('light')} />
      </div>
    </div>
  );
}

function ThemeOption({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        background: active ? C.panel2 : 'transparent',
        color: active ? C.text : C.muted,
        border: `1px solid ${active ? C.borderHi : 'transparent'}`,
        borderRadius: '999px',
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
      }}
    >
      <span style={{ fontSize: '0.65rem' }}>{icon}</span>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ label, tone }) {
  const color =
    tone === 'danger'  ? C.danger  :
    tone === 'warning' ? C.warning :
    C.faint;
  return (
    <div style={{
      fontSize: '0.7rem',
      color,
      margin: '14px 0 6px',
      letterSpacing: '0.02em',
      fontWeight: tone === 'danger' ? 700 : 400,
    }}>
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tracker panel chrome — looks like a SaaS app (Linear/Jira)
// ─────────────────────────────────────────────────────────────────────────────

function TrackerPanel({ children }) {
  return (
    <div style={{
      background: C.trackerBg,
      border: `1px solid ${C.trackerBorder}`,
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '10px',
    }}>
      {children}
    </div>
  );
}

// Window chrome for the triage panel — mirrors the terminal so the two
// panels read as a pair of desktop windows. Left: traffic-light dots.
// Centered: the window/app title. Right: the on-shift status badge.
function TrackerHeader({ onShift }) {
  const narrow = useIsNarrow();
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: narrow ? '7px 10px' : '8px 12px',
      background: C.trackerHead,
      borderBottom: `1px solid ${C.trackerBorder}`,
      gap: narrow ? '8px' : '10px',
    }}>
      {/* traffic lights — same shape/colors as the terminal window */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <Dot color="#ff5f57" />
        <Dot color="#febc2e" />
        <Dot color="#28c840" />
      </div>

      {/* centered window title — app name + workspace breadcrumb */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '0.7rem',
        color: C.muted,
        letterSpacing: '0.04em',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}>
        {/* tiny app icon */}
        <span style={{
          width: '14px',
          height: '14px',
          borderRadius: '3px',
          background: C.accent,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 900,
          fontSize: '0.55rem',
          flexShrink: 0,
        }}>T</span>
        <span style={{ fontWeight: 600, color: C.text }}>Triage</span>
        {!narrow && (
          <>
            <span style={{ color: C.faint }}>—</span>
            <span style={{ color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ticket-tracker · main
            </span>
          </>
        )}
      </div>

      {/* status pill — replaces the terminal's empty right slot.
          Goes dim between games (phase === 'over') and lights up while playing. */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '10px',
        background: onShift ? 'rgba(63,185,80,0.08)' : 'rgba(139,148,158,0.06)',
        border: `1px solid ${onShift ? 'rgba(63,185,80,0.25)' : C.trackerBorder}`,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        flexShrink: 0,
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}>
        <span style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: onShift ? C.success : C.faint,
          boxShadow: onShift ? `0 0 6px ${C.success}` : 'none',
          transition: 'background 0.2s ease, box-shadow 0.2s ease',
        }} />
        <span style={{
          fontSize: '0.6rem',
          color: onShift ? C.muted : C.faint,
          letterSpacing: '0.05em',
          fontWeight: 600,
        }}>
          {onShift ? 'ON SHIFT' : 'OFF SHIFT'}
        </span>
      </div>
    </div>
  );
}

// Mini section header for the tracker (clean, no `//` prefix)
function TrackerSection({ label, count, tone }) {
  const color =
    tone === 'danger'  ? C.danger :
    tone === 'warning' ? C.warning :
    tone === 'success' ? C.success :
    C.muted;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px',
      padding: '10px 14px 4px',
      fontSize: '0.62rem',
      letterSpacing: '0.1em',
      fontWeight: 700,
      color,
    }}>
      <span>{label}</span>
      {count != null && (
        <span style={{
          fontSize: '0.55rem',
          color: C.faint,
          fontWeight: 400,
        }}>
          ({count})
        </span>
      )}
    </div>
  );
}

// Stats row at top of the tracker
function TrackerStats({ credits, strikes, resolved }) {
  const narrow = useIsNarrow();
  const rejected = 3 - strikes;
  const rejectedColor =
    rejected === 0 ? C.muted :
    rejected === 1 ? C.warning :
    C.danger;
  return (
    <div style={{
      display: 'flex',
      padding: narrow ? '8px 10px' : '8px 14px',
      gap: narrow ? '14px' : '20px',
      borderBottom: `1px solid ${C.trackerBorder}`,
    }}>
      <Stat label={narrow ? 'VELOCITY' : 'SPRINT VELOCITY'} value={credits}  color={C.success} />
      <Stat label="REJECTED"        value={rejected} color={rejectedColor} />
      <Stat label="RESOLVED"        value={resolved} />
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: '0.55rem', color: C.faint, letterSpacing: '0.08em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.95rem',
        fontWeight: 700,
        color: color || C.text,
        marginTop: '1px',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Terminal panel chrome — looks like a Mac/iTerm window
// ─────────────────────────────────────────────────────────────────────────────

function TerminalPanel({ children }) {
  return (
    <div style={{
      background: C.termBg,
      border: `1px solid ${C.termBorder}`,
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

function TerminalHeader({ host }) {
  const narrow = useIsNarrow();
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: narrow ? '7px 10px' : '8px 12px',
      background: C.termHead,
      borderBottom: `1px solid ${C.termBorder}`,
      gap: '8px',
    }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <Dot color="#ff5f57" />
        <Dot color="#febc2e" />
        <Dot color="#28c840" />
      </div>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '0.7rem',
        color: C.muted,
        letterSpacing: '0.04em',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}>
        {/* tiny app icon — mirrors the triage window */}
        <span style={{
          width: '14px',
          height: '14px',
          borderRadius: '3px',
          background: C.termBg,
          border: `1px solid ${C.termBorder}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.termPrompt,
          fontWeight: 900,
          fontSize: '0.55rem',
          fontFamily: "'JetBrains Mono', monospace",
          flexShrink: 0,
        }}>{'>_'}</span>
        <span style={{ fontWeight: 600, color: C.text }}>Terminal</span>
        {!narrow && (
          <>
            <span style={{ color: C.faint }}>—</span>
            <span style={{
              color: C.muted,
              fontFamily: "'JetBrains Mono', monospace",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              dev@{host || 'localhost'}: /srv/app/current · zsh
            </span>
          </>
        )}
      </div>
      {!narrow && <div style={{ width: '36px', flexShrink: 0 }} />}
    </div>
  );
}

function Dot({ color }) {
  return (
    <span style={{
      display: 'inline-block',
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      background: color,
    }} />
  );
}

// Terminal-style line prompt: $ command
// When an onClick is provided, the prompt becomes clickable and shows a hover box.
// When `typing` is true, the command appears char-by-char (~28ms/char) with a
// blinking cursor; onTyped fires when the last character lands. The comment and
// click affordances are suppressed until typing completes so the line really
// behaves like a fresh shell command.
function TerminalPrompt({ command, comment, tone, onClick, disabled, typing, typingKey, onTyped }) {
  const color =
    tone === 'danger'  ? C.danger  :
    tone === 'warning' ? C.warning :
    C.termPrompt;
  const [hovered, setHovered] = useState(false);
  const [typedLen, setTypedLen] = useState(typing ? 0 : command.length);

  useEffect(() => {
    if (!typing) {
      setTypedLen(command.length);
      return undefined;
    }
    setTypedLen(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTypedLen(i);
      if (i >= command.length) {
        clearInterval(id);
        if (onTyped) onTyped();
      }
    }, 28);
    return () => clearInterval(id);
    // typingKey lets the caller force a restart when the same command needs to
    // re-type on a new ticket load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing, typingKey, command]);

  const isTyping = typing && typedLen < command.length;
  const shownCommand = isTyping ? command.slice(0, typedLen) : command;
  const clickable = !!onClick && !disabled && !isTyping;
  const showBox = clickable && hovered;

  const base = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    textAlign: 'left',
    padding: '6px 14px',
    fontSize: '0.7rem',
    fontFamily: "'JetBrains Mono', monospace",
    // Buttons default to white-space:pre in some UAs; force normal so the
    // long-comment overflow-wrap inside actually triggers.
    whiteSpace: 'normal',
    background: showBox ? C.panel : 'transparent',
    border: `1px solid ${showBox ? C.borderHi : 'transparent'}`,
    borderRadius: '4px',
    transition: 'background 0.12s ease, border-color 0.12s ease',
    cursor: clickable ? 'pointer' : disabled ? 'not-allowed' : 'default',
    opacity: disabled && onClick ? 0.5 : 1,
  };

  // $ and the command share one wrappable text flow (inline spans inside a
  // block) so a long command wraps under itself but never pushes the $
  // glyph onto its own line. The comment lives in a separate block below,
  // right-aligned via text-align (we no longer rely on flex for layout).
  const inner = (
    <>
      <div style={{
        color: C.termText,
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
      }}>
        <span style={{ color, fontWeight: 700, marginRight: '6px' }}>$</span>
        <span style={{ fontWeight: 600 }}>{shownCommand}</span>
        {isTyping && (
          <span style={{
            display: 'inline-block',
            width: '0.5em',
            marginLeft: '1px',
            color: C.termText,
            animation: 'pulse 0.9s ease-in-out infinite',
            fontWeight: 700,
          }}>
            ▏
          </span>
        )}
      </div>
      {comment && !isTyping && (
        <div style={{
          color: C.faint,
          fontStyle: 'italic',
          textAlign: 'right',
          marginTop: '2px',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
        }}>
          # {comment}
        </div>
      )}
    </>
  );

  if (onClick !== undefined) {
    return (
      <button
        onClick={clickable ? onClick : undefined}
        onMouseEnter={() => clickable && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={!clickable}
        style={base}
      >
        {inner}
      </button>
    );
  }
  return <div style={{ ...base, padding: '10px 14px 4px' }}>{inner}</div>;
}

// ── Compact one-line ticket row, shown in the inbox queue ──────────────
// `pickable` flags rows the player can click in result phase to advance the
// queue — drawn with a subtle accent tint to invite the click.
function QueueRow({ ticket, active, disabled, pickable, onClick }) {
  const sevColor =
    ticket.severity === 'prio-1' ? C.danger  :
    ticket.severity === 'prio-2' ? C.warning :
    C.muted;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        textAlign: 'left',
        position: 'relative',
        background: active ? C.panel2 : pickable ? 'rgba(88,166,255,0.04)' : C.bg,
        border: `1px solid ${active ? C.accent : pickable ? C.accent : C.trackerBorder}`,
        borderRadius: '5px',
        padding: '7px 10px 7px 12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        boxShadow: active
          ? `0 0 0 1px ${C.accent}33`
          : pickable ? `0 0 0 1px ${C.accent}22` : 'none',
        fontFamily: "'JetBrains Mono', monospace",
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.12s ease',
        overflow: 'hidden',
      }}
    >
      {/* left accent strip — severity color */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: '3px',
        background: sevColor,
      }} />

      {/* severity */}
      <span style={{
        fontSize: '0.6rem',
        fontWeight: 700,
        color: sevColor,
        minWidth: '18px',
        letterSpacing: '0.03em',
      }}>
        {ticket.severity}
      </span>

      {/* title */}
      <span style={{
        flex: 1,
        minWidth: 0,
        fontSize: '0.72rem',
        color: active ? C.text : C.muted,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: active ? 600 : 400,
      }}>
        {ticket.title}
      </span>

      {active && (
        <span style={{ color: C.accent, fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>●</span>
      )}
    </button>
  );
}

// ── One-line row for a closed (resolved / rejected) ticket. Click to view ─
// the read-only push output in the terminal.
function ClosedRow({ ticket, result, viewing, onClick }) {
  const isOk = result?.success;
  const statusColor = isOk ? C.success : C.danger;
  const sevColor =
    ticket.severity === 'prio-1' ? C.danger  :
    ticket.severity === 'prio-2' ? C.warning :
    C.muted;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        position: 'relative',
        background: viewing ? C.panel2 : C.bg,
        border: `1px solid ${viewing ? C.accent : C.trackerBorder}`,
        borderRadius: '5px',
        padding: '6px 10px 6px 12px',
        cursor: 'pointer',
        opacity: isOk ? 1 : 0.78,
        boxShadow: viewing ? `0 0 0 1px ${C.accent}33` : 'none',
        fontFamily: "'JetBrains Mono', monospace",
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.12s ease',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: '3px',
        background: statusColor,
      }} />
      <span style={{
        fontSize: '0.6rem',
        fontWeight: 700,
        color: statusColor,
        minWidth: '10px',
      }}>
        {isOk ? '✓' : '✗'}
      </span>
      <span style={{
        fontSize: '0.58rem',
        fontWeight: 700,
        color: sevColor,
        letterSpacing: '0.03em',
        minWidth: '32px',
      }}>
        {ticket.severity}
      </span>
      <span style={{
        flex: 1,
        minWidth: 0,
        fontSize: '0.7rem',
        color: viewing ? C.text : C.muted,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: viewing ? 600 : 400,
      }}>
        {ticket.title}
      </span>
      {result?.sha && (
        <span style={{
          fontSize: '0.58rem',
          color: C.warning,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
          flexShrink: 0,
        }}>
          {result.sha}
        </span>
      )}
    </button>
  );
}

// ── Read-only terminal view of a closed ticket: just the git commit
// section (the push output of that stage).
function ClosedView({ entry }) {
  const { ticket, result } = entry;
  return (
    <>
      <TerminalPrompt
        command={`git show ${result.sha}`}
        comment={`${ticket.ticketId} · ${result.success ? 'resolved' : 'rejected'}`}
        tone={result.success ? undefined : 'danger'}
      />
      <PushOutput result={result} ticket={ticket} />
    </>
  );
}

// ── Closed ticket detail panel, rendered in the main triage panel when a
// done ticket is being viewed. Mirrors TicketCard but shows the final
// outcome (resolved / rejected) instead of an in-progress preview.
function ClosedTicketCard({ ticket, result }) {
  const ok = result.success;
  const sevColor =
    ticket.severity === 'prio-1' ? C.danger  :
    ticket.severity === 'prio-2' ? C.warning :
    C.border;
  const statusColor = ok ? C.success : C.danger;
  const blk = ticket.blocked ? STACKS[ticket.blocked] : null;
  const isMulti = ticket.requirements.length > 1;
  const reqStatus = result.reqStatus || [];

  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${statusColor}`,
      borderRadius: '6px',
      padding: '12px',
      marginTop: '4px',
    }}>
      {/* status banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <span style={{
          fontSize: '0.62rem',
          fontWeight: 700,
          color: statusColor,
          letterSpacing: '0.1em',
          padding: '3px 8px',
          border: `1px solid ${statusColor}`,
          borderRadius: '3px',
        }}>
          {ok ? '✓ RESOLVED' : '✗ REJECTED'}
        </span>
        <span style={{
          fontSize: '0.6rem',
          color: C.warning,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
        }}>
          {result.sha}
        </span>
        <span style={{
          fontSize: '0.6rem',
          color: C.faint,
          marginLeft: 'auto',
          fontStyle: 'italic',
        }}>
          read-only
        </span>
      </div>

      {/* ticket header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', color: C.faint }}>{ticket.ticketId}</span>
        <SevBadge severity={ticket.severity} />
        {ticket.requirements.map(r => (
          <StackBadge key={r.stack} stackKey={r.stack} />
        ))}
        {blk && (
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: C.danger,
            padding: '2px 6px',
            border: `1px solid ${C.danger}`,
            borderRadius: '3px',
            letterSpacing: '0.05em',
          }}>✕ {blk.name}</span>
        )}
        {ticket.mercy && (
          <span style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            color: C.success,
            padding: '2px 6px',
            border: `1px solid ${C.success}`,
            borderRadius: '3px',
            letterSpacing: '0.08em',
            marginLeft: 'auto',
          }}>MERCY</span>
        )}
      </div>

      {/* title */}
      <div style={{
        fontSize: '0.9rem',
        fontWeight: 600,
        color: C.text,
        marginBottom: '6px',
        lineHeight: 1.3,
        textDecoration: ok ? 'none' : 'line-through',
        textDecorationColor: ok ? undefined : C.faint,
      }}>
        {ticket.title}
      </div>

      {/* requester quote */}
      <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: '8px', lineHeight: 1.4 }}>
        <span style={{ color: C.faint }}>— {ticket.from}:</span>{' '}
        <span style={{ fontStyle: 'italic' }}>"{ticket.note}"</span>
      </div>

      {/* requirements outcome */}
      <div style={{
        marginBottom: '6px',
        paddingTop: '6px',
        borderTop: `1px solid ${C.border}`,
        fontSize: '0.72rem',
      }}>
        <div style={{ color: C.faint, marginBottom: '4px' }}>
          {isMulti ? 'requirements:' : 'requirement:'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {reqStatus.map(r => {
            const s = STACKS[r.stack];
            return (
              <div key={r.stack} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.72rem',
              }}>
                <span style={{ color: r.passed ? C.success : C.danger, fontWeight: 700, width: '10px' }}>
                  {r.passed ? '✓' : '✗'}
                </span>
                <span style={{ color: s.color, fontWeight: 700, minWidth: '30px' }}>
                  {s.name}
                </span>
                <span style={{ color: C.muted, flex: 1 }}>
                  ≥ {r.threshold} pts
                </span>
                <span style={{ color: r.passed ? C.success : C.danger, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {r.bonusApplied > 0 ? (
                    <>
                      {r.stackSum}
                      <span style={{ color: C.faint, fontWeight: 400 }}>+</span>
                      <span style={{ color: C.success }}>{r.bonusApplied}</span>
                      <span style={{ color: C.faint }}>=</span>
                      {r.effective}
                    </>
                  ) : (
                    r.effective
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {result.tainted && blk && (
          <div style={{ color: C.danger, fontSize: '0.7rem', marginTop: '4px' }}>
            ✕ touched blocked stack <b>{blk.name}</b>
          </div>
        )}
      </div>

      {/* outcome footer */}
      <div style={{ fontSize: '0.72rem', marginTop: '6px' }}>
        <span style={{ color: C.faint }}>outcome: </span>
        {ok ? (
          <span style={{ color: C.success, fontWeight: 700 }}>
            +{result.earned} velocity · {ticket.ticketId} closed
          </span>
        ) : (
          <span style={{ color: C.danger, fontWeight: 700 }}>
            {result.msg}
          </span>
        )}
        {result.legendary && (
          <span style={{ color: C.legendary, fontWeight: 700, marginLeft: '6px' }}>
            · legendary by {result.legendaryAuthors.join(' + ')}
          </span>
        )}
        {result.skipPenalty > 0 && (
          <span style={{ color: C.danger, fontWeight: 700, marginLeft: '6px' }}>
            · −{result.skipPenalty} skip penalty
          </span>
        )}
      </div>

      {/* combo chips */}
      {result.combos && result.combos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          {result.combos.map(c => (
            <span key={c.key} style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              color: C.success,
              padding: '2px 6px',
              background: 'rgba(63,185,80,0.1)',
              border: `1px solid ${C.success}`,
              borderRadius: '3px',
              letterSpacing: '0.05em',
            }}>{c.name} +{c.bonus}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SevBadge({ severity }) {
  const color = severity === 'prio-1' ? C.danger : severity === 'prio-2' ? C.warning : C.muted;
  return (
    <span style={{
      fontSize: '0.65rem',
      fontWeight: 700,
      color,
      padding: '2px 6px',
      border: `1px solid ${color}`,
      borderRadius: '3px',
      letterSpacing: '0.05em',
    }}>{severity}</span>
  );
}

function StackBadge({ stackKey }) {
  const s = STACKS[stackKey];
  return (
    <span style={{
      fontSize: '0.65rem',
      fontWeight: 700,
      color: s.color,
      padding: '2px 6px',
      border: `1px solid ${s.color}`,
      borderRadius: '3px',
      letterSpacing: '0.05em',
    }}>{s.name}</span>
  );
}

function TicketCard({ ticket, preview }) {
  const blk = ticket.blocked ? STACKS[ticket.blocked] : null;
  const isMulti = ticket.requirements.length > 1;

  // severity tint
  const sevColor =
    ticket.severity === 'prio-1' ? C.danger  :
    ticket.severity === 'prio-2' ? C.warning :
    C.border;

  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${sevColor}`,
      borderRadius: '6px',
      padding: '12px',
      marginTop: '4px',
    }}>
      {/* ticket header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', color: C.faint }}>{ticket.ticketId}</span>
        <SevBadge severity={ticket.severity} />
        {ticket.requirements.map(r => (
          <StackBadge key={r.stack} stackKey={r.stack} />
        ))}
        {blk && (
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: C.danger,
            padding: '2px 6px',
            border: `1px solid ${C.danger}`,
            borderRadius: '3px',
            letterSpacing: '0.05em',
          }}>✕ {blk.name}</span>
        )}
        {ticket.mercy && (
          <span style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            color: C.success,
            padding: '2px 6px',
            border: `1px solid ${C.success}`,
            borderRadius: '3px',
            letterSpacing: '0.08em',
            marginLeft: 'auto',
          }}>MERCY</span>
        )}
      </div>

      {/* title */}
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text, marginBottom: '6px', lineHeight: 1.3 }}>
        {ticket.title}
      </div>

      {/* requester quote */}
      <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: '8px', lineHeight: 1.4 }}>
        <span style={{ color: C.faint }}>— {ticket.from}:</span>{' '}
        <span style={{ fontStyle: 'italic' }}>"{ticket.note}"</span>
      </div>

      {/* requirements list */}
      <div style={{
        marginBottom: '6px',
        paddingTop: '6px',
        borderTop: `1px solid ${C.border}`,
        fontSize: '0.72rem',
      }}>
        <div style={{ color: C.faint, marginBottom: '4px' }}>
          {isMulti ? 'requires all of:' : 'requires:'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {preview.reqStatus.map(r => {
            const s = STACKS[r.stack];
            const ok = r.passed;
            const color = preview.tainted ? C.faint : ok ? C.success : C.warning;
            return (
              <div key={r.stack} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.72rem',
              }}>
                <span style={{ color: ok ? C.success : C.faint, fontWeight: 700, width: '10px' }}>
                  {ok ? '✓' : '·'}
                </span>
                <span style={{ color: s.color, fontWeight: 700, minWidth: '30px' }}>
                  {s.name}
                </span>
                <span style={{ color: C.muted, flex: 1 }}>
                  ≥ {r.threshold} pts
                </span>
                <span style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {r.bonusApplied > 0 ? (
                    <>
                      {r.stackSum}
                      <span style={{ color: C.faint, fontWeight: 400 }}>+</span>
                      <span style={{ color: C.success }}>{r.bonusApplied}</span>
                      <span style={{ color: C.faint }}>=</span>
                      {r.effective}
                    </>
                  ) : (
                    r.effective
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {blk && (
          <div style={{ color: C.danger, fontSize: '0.7rem', marginTop: '4px' }}>
            ✕ no <b>{blk.name}</b> fixes allowed
          </div>
        )}
      </div>

      {/* combo chips */}
      {preview.combos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          {preview.combos.map(c => (
            <span key={c.key} style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              color: C.success,
              padding: '2px 6px',
              background: 'rgba(63,185,80,0.1)',
              border: `1px solid ${C.success}`,
              borderRadius: '3px',
              letterSpacing: '0.05em',
            }}>{c.name} +{c.bonus}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// Generic indent for terminal output lines (under a `$` prompt)
function TermLine({ children, color, dim, indent = 2 }) {
  return (
    <div style={{
      fontSize: '0.7rem',
      fontFamily: "'JetBrains Mono', monospace",
      paddingLeft: `${14 + indent}px`,
      paddingRight: '14px',
      color: color || (dim ? C.faint : C.termText),
      lineHeight: 1.55,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Push output — terminal-text continuation after `$ git push origin main`
// ─────────────────────────────────────────────────────────────────────────────

function PushOutput({ result, ticket }) {
  const ok = result.success;
  const cards = result.cards || [];
  const requiredStacks = new Set(ticket.requirements.map(r => r.stack));

  return (
    <div style={{ padding: '0 0 6px', fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Push transcript (fake real-git output) */}
      <TermLine dim>Counting objects: {cards.length}, done.</TermLine>
      <TermLine dim>Writing objects: 100% ({cards.length}/{cards.length}), done.</TermLine>
      <TermLine dim>To prod-main:</TermLine>
      <TermLine color={ok ? C.success : C.danger}>
        {ok
          ? `   * [new commit] ${result.sha} -> main`
          : `   ! [rejected]   ${result.sha} -> main (stage failed)`}
      </TermLine>

      {/* Spacer */}
      <div style={{ height: '6px' }} />

      <TermLine color={C.warning}>
        commit {result.sha}{' '}
        <span style={{ color: C.faint }}>(HEAD → main)</span>
      </TermLine>
      <TermLine dim>ticket: {ticket.ticketId}</TermLine>

      <div style={{ height: '6px' }} />

      {/* Diff lines for each staged fix */}
      {cards.map((c, i) => {
        const s = STACKS[c.stack];
        const isLegendary = !!c.legendary;
        const counted = requiredStacks.has(c.stack);
        // Legendary fixes bypass blocked-stack taint entirely.
        const blocked = !isLegendary && ticket.blocked && c.stack === ticket.blocked;
        const cb = result.cardBonuses && result.cardBonuses[i];
        const fired = cb && cb.fired;
        const isFaulty = c.faulty;
        const eff = effectiveValue(c);
        let marker;
        if (isLegendary)   marker = '★';
        else if (blocked)  marker = '!';
        else if (isFaulty) marker = '⚠';
        else if (counted)  marker = '+';
        else               marker = ' ';
        const markerColor =
          isLegendary ? C.legendary :
          blocked     ? C.danger :
          isFaulty    ? C.danger :
          ok && counted ? C.success :
          C.faint;
        const valueDisplay = isLegendary
          ? '(0)'
          : counted
            ? (isFaulty ? `${eff}` : `+${c.value}`)
            : (isFaulty ? `(${eff})` : `(${c.value})`);
        return (
          <div key={i} style={{
            fontSize: '0.7rem',
            fontFamily: "'JetBrains Mono', monospace",
            paddingLeft: '14px',
            paddingRight: '14px',
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px',
            lineHeight: 1.55,
          }}>
            <span style={{ color: markerColor, fontWeight: 700, width: '10px' }}>{marker}</span>
            <span style={{
              color: isLegendary ? C.legendary : C.warning,
              fontWeight: 700,
              fontSize: '0.65rem',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.02em',
            }}>
              {c.sha}
            </span>
            <span style={{
              color: isLegendary ? C.legendary : s.color,
              fontWeight: 700,
              minWidth: '30px',
            }}>
              [{isLegendary ? 'LGND' : s.name}]
            </span>
            <span style={{
              color: isLegendary ? C.legendary : C.text,
              fontStyle: isLegendary ? 'italic' : 'normal',
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {c.description}
              {isFaulty && (
                <span style={{ color: C.danger, marginLeft: '6px', fontWeight: 700 }}>
                  bugged
                </span>
              )}
              {isLegendary && (
                <span style={{
                  color: C.legendary,
                  marginLeft: '6px',
                  fontWeight: 700,
                  fontStyle: 'normal',
                }}>
                  · {c.author}
                </span>
              )}
              {fired && !isLegendary && (
                <span style={{ color: C.warning, marginLeft: '6px', fontSize: '0.6rem', fontWeight: 700 }}>
                  ★ {bonusLabel(c.bonus)}
                </span>
              )}
            </span>
            <span style={{
              color: isLegendary ? C.legendary : (isFaulty ? C.danger : (counted ? C.text : C.faint)),
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {valueDisplay}
              {fired && counted && !isLegendary && (
                <span style={{ color: C.warning }}>+{cb.points}</span>
              )}
            </span>
          </div>
        );
      })}

      {/* Legendary auto-pass banner */}
      {result.legendary && (
        <>
          <div style={{ height: '6px' }} />
          <TermLine color={C.legendary}>
            legendary fix · auto-pass by {result.legendaryAuthors.join(' + ')}
          </TermLine>
        </>
      )}

      {/* Combos */}
      {result.combos && result.combos.length > 0 && (
        <>
          <div style={{ height: '6px' }} />
          <TermLine dim>combos fired:</TermLine>
          {result.combos.map(c => (
            <TermLine key={c.key} color={C.success}>
              ✓ {c.name} +{c.bonus}
            </TermLine>
          ))}
        </>
      )}

      {/* Per-requirement results — each line breaks down every component that
          fed the stack's effective score: per-fix value (red if faulty, gold
          if legendary), sequence bonus where it fired, and the combo bonus. */}
      {!result.tainted && result.reqStatus && (
        <>
          <div style={{ height: '6px' }} />
          <TermLine dim>requirement check:</TermLine>
          {result.reqStatus.map(r => {
            const s = STACKS[r.stack];
            const onStack = (result.cards || [])
              .map((c, i) => ({ c, cb: (result.cardBonuses && result.cardBonuses[i]) || null }))
              .filter(({ c }) => c.stack === r.stack);
            return (
              <div key={r.stack} style={{
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                paddingLeft: '16px',
                paddingRight: '14px',
                display: 'flex',
                alignItems: 'baseline',
                gap: '6px',
                lineHeight: 1.55,
                flexWrap: 'wrap',
              }}>
                <span style={{ width: '10px', color: r.passed ? C.success : C.danger, fontWeight: 700, flexShrink: 0 }}>
                  {r.passed ? '✓' : '✗'}
                </span>
                <span style={{ color: s.color, fontWeight: 700, minWidth: '30px', flexShrink: 0 }}>
                  {s.name.toLowerCase()}
                </span>
                <span style={{ color: C.muted, minWidth: 0, wordBreak: 'break-word' }}>
                  {onStack.length === 0 ? (
                    <span style={{ color: C.faint, fontStyle: 'italic' }}>no fixes invested</span>
                  ) : (
                    onStack.map(({ c, cb }, i) => {
                      const v = effectiveValue(c);
                      const bonusPts = cb && cb.fired ? cb.points : 0;
                      const valColor = c.faulty ? C.danger : c.legendary ? C.legendary : C.text;
                      return (
                        <React.Fragment key={i}>
                          {i > 0 && <span style={{ color: C.faint }}> + </span>}
                          {bonusPts > 0 ? (
                            <>
                              <span style={{ color: C.faint }}>(</span>
                              <span style={{ color: valColor, fontWeight: 600 }}>{v}</span>
                              <span style={{ color: C.faint }}> + </span>
                              <span style={{ color: C.warning, fontWeight: 600 }}>{bonusPts}★</span>
                              <span style={{ color: C.faint }}>)</span>
                            </>
                          ) : (
                            <span style={{ color: valColor, fontWeight: 600 }}>{v}</span>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                  {r.bonusApplied > 0 && (
                    <>
                      <span style={{ color: C.faint }}> + </span>
                      <span style={{ color: C.success, fontWeight: 600 }}>combo {r.bonusApplied}</span>
                    </>
                  )}
                  <span style={{ color: C.faint }}> = </span>
                  <span style={{ color: r.passed ? C.success : C.warning, fontWeight: 700 }}>{r.effective}</span>
                  <span style={{ color: C.faint }}> / {r.threshold}</span>
                </span>
              </div>
            );
          })}
        </>
      )}

      {/* Skip penalty — applied when a more-urgent ticket was left in the inbox */}
      {result.skipPenalty > 0 && (
        <>
          <div style={{ height: '6px' }} />
          <TermLine dim>skipped (more urgent):</TermLine>
          {result.skipped.map(s => (
            <div key={s.ticketId} style={{
              fontSize: '0.7rem',
              fontFamily: "'JetBrains Mono', monospace",
              paddingLeft: '16px',
              paddingRight: '14px',
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
              lineHeight: 1.55,
            }}>
              <span style={{ width: '10px', color: C.danger, fontWeight: 700 }}>!</span>
              <span style={{ color: C.danger, fontWeight: 700, minWidth: '38px' }}>{s.severity}</span>
              <span style={{ color: C.faint, flex: 1 }}>{s.ticketId} still open</span>
              <span style={{ color: C.danger, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>−{s.penalty}</span>
            </div>
          ))}
        </>
      )}

      {/* Footer summary */}
      <div style={{ height: '8px' }} />
      {ok ? (
        <TermLine color={C.success}>
          → +{result.earned} velocity · {ticket.ticketId} closed
          {result.skipPenalty > 0 && (
            <span style={{ color: C.danger }}> · −{result.skipPenalty} skip penalty</span>
          )}
        </TermLine>
      ) : (
        <TermLine color={C.danger}>
          × {result.msg}
          {result.skipPenalty > 0 && <span> · −{result.skipPenalty} skip penalty</span>}
        </TermLine>
      )}
    </div>
  );
}

// Shift summary (game over) — terminal output after the final push
function ShiftSummary({ credits, resolved, rejected, reason }) {
  const paged = reason === 'paged';
  return (
    <div style={{ padding: '0 0 6px', fontFamily: "'JetBrains Mono', monospace" }}>
      <TermLine color={paged ? C.danger : C.accent}>
        {paged
          ? '× paged off-call — three failed stages'
          : '◆ shift complete — fix pool depleted'}
      </TermLine>
      <TermLine dim>
        {paged
          ? '  the prod fire is someone else\'s problem now.'
          : '  every fix in the locker has been cherry-picked.'}
      </TermLine>

      <div style={{ height: '8px' }} />

      <TermLine dim>┌─ shift summary ───────────────</TermLine>
      <TermLine>
        │ sprint velocity: <span style={{ color: C.success, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{credits}</span>
      </TermLine>
      <TermLine>
        │ resolved:        <span style={{ color: C.success, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{resolved}</span>
      </TermLine>
      <TermLine>
        │ rejected:        <span style={{
          color: rejected >= 3 ? C.danger : rejected > 0 ? C.warning : C.muted,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}>{rejected}</span>
      </TermLine>
      <TermLine dim>└──────────────────────────────</TermLine>

      <div style={{ height: '6px' }} />

      <TermLine dim>
        connection closed by {paged ? 'pagerduty' : 'eod scheduler'}.
      </TermLine>
    </div>
  );
}
