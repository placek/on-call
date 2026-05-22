import React, { useState, useEffect, useMemo } from 'react';
import { FIXES, TICKET_POOL, PROGRAMMERS, HOST_WORDS, HOST_TLDS, HOST_SPLITS } from './content';

// ─────────────────────────────────────────────────────────────────────────────
//  ON-CALL — a DevOps ticket triage game.
//  Pick 3 fixes, ship a deploy, resolve the ticket. Don't get paged off.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  Theme — two palettes exposed as CSS variables. C maps each token to a
//  var(--…) reference, so every component re-reads its colors as soon as
//  data-theme on the root changes. No component code knows about themes.
// ─────────────────────────────────────────────────────────────────────────────

const FONTS_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.55; }
  }

  html, body {
    background: var(--bg);
    color: var(--text);
    transition: background 0.2s ease, color 0.2s ease;
  }

  [data-theme="dark"] {
    --bg: #0d1117;
    --panel: #161b22;
    --panel2: #1c2128;
    --border: #30363d;
    --borderHi: #484f58;
    --text: #e6edf3;
    --muted: #8b949e;
    --faint: #6e7681;
    --success: #3fb950;
    --danger: #f85149;
    --warning: #d29922;
    --accent: #58a6ff;
    --trackerBg: #1a1f26;
    --trackerHead: #232a33;
    --trackerBorder: #2d3441;
    --termBg: #0a0d11;
    --termHead: #161b22;
    --termBorder: #21262d;
    --termText: #d1d7e0;
    --termPrompt: #3fb950;
    --legendary: #ffd166;
  }

  [data-theme="light"] {
    --bg: #e6eaf0;
    --panel: #f0f3f7;
    --panel2: #ffffff;
    --border: #d0d7de;
    --borderHi: #afb8c1;
    --text: #1f2328;
    --muted: #59636e;
    --faint: #818b98;
    --success: #1a7f37;
    --danger: #cf222e;
    --warning: #9a6700;
    --accent: #0969da;
    --trackerBg: #ffffff;
    --trackerHead: #f6f8fa;
    --trackerBorder: #d8dee4;
    --termBg: #f6f8fa;
    --termHead: #eaeef2;
    --termBorder: #d0d7de;
    --termText: #1f2328;
    --termPrompt: #1a7f37;
    --legendary: #b8860b;
  }
`;

const C = {
  bg:       'var(--bg)',
  panel:    'var(--panel)',
  panel2:   'var(--panel2)',
  border:   'var(--border)',
  borderHi: 'var(--borderHi)',
  text:     'var(--text)',
  muted:    'var(--muted)',
  faint:    'var(--faint)',
  success:  'var(--success)',
  danger:   'var(--danger)',
  warning:  'var(--warning)',
  accent:   'var(--accent)',

  trackerBg:     'var(--trackerBg)',
  trackerHead:   'var(--trackerHead)',
  trackerBorder: 'var(--trackerBorder)',

  termBg:        'var(--termBg)',
  termHead:      'var(--termHead)',
  termBorder:    'var(--termBorder)',
  termText:      'var(--termText)',
  termPrompt:    'var(--termPrompt)',
  legendary:     'var(--legendary)',
};

const STACKS = {
  api: { name: 'API', label: 'Backend',  color: '#58a6ff' },
  db:  { name: 'DB',  label: 'Database', color: '#bc8cff' },
  ui:  { name: 'UI',  label: 'Frontend', color: '#f778ba' },
  ops: { name: 'OPS', label: 'Infra',    color: '#f0883e' },
};

const STACK_KEYS = Object.keys(STACKS);

// ─────────────────────────────────────────────────────────────────────────────
//  Per-stack pool size — how many placements you get from each stack per shift
// ─────────────────────────────────────────────────────────────────────────────

const STACK_POOL_SIZE = 10;

function _pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Tracks whether the viewport is narrow enough that we should switch to
// compact mobile variants of the UI. Single shared breakpoint at 640px.
function useIsNarrow(breakpoint = 640) {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return narrow;
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

// ─────────────────────────────────────────────────────────────────────────────
//  Sequence bonuses — optional rules attached to fix cards.
//  When a card's bonus condition is met by its position in the deploy package,
//  the bonus points add to that card's stack contribution toward the ticket.
// ─────────────────────────────────────────────────────────────────────────────

function bonusFires(bonus, idx, deployed) {
  if (!bonus) return false;
  switch (bonus.kind) {
    case 'first':  return idx === 0;
    case 'last':   return idx === deployed.length - 1 && deployed.length === 3;
    case 'after':  return idx > 0 && deployed[idx - 1].stack === bonus.dep;
    case 'before': return idx < deployed.length - 1 && deployed[idx + 1].stack === bonus.dep;
    case 'with':   return deployed.some((c, i) => i !== idx && c.stack === bonus.dep);
    default:       return false;
  }
}

function bonusLabel(bonus) {
  if (!bonus) return '';
  switch (bonus.kind) {
    case 'first':  return 'first placed';
    case 'last':   return 'last placed';
    case 'after':  return `after ${STACKS[bonus.dep].name}`;
    case 'before': return `before ${STACKS[bonus.dep].name}`;
    case 'with':   return `with ${STACKS[bonus.dep].name}`;
    default:       return '';
  }
}

// "Would this bonus fire if I placed this card right now?"
// Used to highlight hand cards whose bonus is ripe for the picking.
function bonusWouldFireIfPlacedNow(bonus, deployed) {
  if (!bonus) return false;
  const futureIdx = deployed.length;
  switch (bonus.kind) {
    case 'first':  return futureIdx === 0;
    case 'last':   return futureIdx === 2; // will complete the deploy
    case 'after':  return futureIdx > 0 && deployed[futureIdx - 1].stack === bonus.dep;
    case 'before': return false; // can't know yet; depends on what's placed AFTER
    case 'with':   return deployed.some(c => c.stack === bonus.dep);
    default:       return false;
  }
}

function rollBonus(stack) {
  // ~50% of cards have no bonus
  if (Math.random() < 0.5) return null;
  const points = 2;
  const others = STACK_KEYS.filter(s => s !== stack);
  const pick = others[Math.floor(Math.random() * others.length)];
  const r = Math.random();
  if (r < 0.20) return { kind: 'first', points };
  if (r < 0.40) return { kind: 'last',  points };
  if (r < 0.60) return { kind: 'after',  dep: pick, points };
  if (r < 0.80) return { kind: 'before', dep: pick, points };
  return                   { kind: 'with',   dep: pick, points: 1 }; // looser → smaller bonus
}

// Generate a fake 7-char git SHA (lowercase hex)
function genSha() {
  let s = '';
  for (let i = 0; i < 7; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

let _cardUid = 0;
// Fixed per-shift quotas — guarantees the same risk/reward shape every game.
// Total pool slots = STACK_KEYS.length × STACK_POOL_SIZE = 4 × 10 = 40.
//   FAULTY_PER_SHIFT = 6  → 15% of draws are bugged (was random 18%)
//   LEGENDARY_PER_SHIFT = 2 → guaranteed two rescue cards per shift
// Slot positions are randomized inside buildShiftDecks() so each game still
// feels different, but the *budget* is constant.
const FAULTY_PER_SHIFT = 6;
const LEGENDARY_PER_SHIFT = 2;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Build the full 40-card shift deck, bucketed by stack. Allocates the
// faulty/legendary quotas across slots first, then materializes each slot
// into a card (value, description variant, sequence bonus, author rolled
// per-card).
function buildShiftDecks() {
  const slots = [];
  STACK_KEYS.forEach(s => {
    for (let i = 0; i < STACK_POOL_SIZE; i++) {
      slots.push({ stack: s, faulty: false, legendary: false });
    }
  });

  // Shuffle once, mark first N slots legendary, next M faulty, then re-shuffle
  // so legendaries can land anywhere within their stack's pool.
  shuffle(slots);
  for (let i = 0; i < LEGENDARY_PER_SHIFT && i < slots.length; i++) {
    slots[i].legendary = true;
  }
  let placed = 0;
  for (let i = LEGENDARY_PER_SHIFT; placed < FAULTY_PER_SHIFT && i < slots.length; i++) {
    slots[i].faulty = true;
    placed++;
  }
  shuffle(slots);

  const decks = {};
  STACK_KEYS.forEach(s => { decks[s] = []; });
  slots.forEach(slot => {
    decks[slot.stack].push(materializeCard(slot.stack, slot.faulty, slot.legendary));
  });
  return decks;
}

function materializeCard(stack, faulty, legendary) {
  if (legendary) {
    const author = _pick(PROGRAMMERS);
    return {
      id: ++_cardUid,
      sha: genSha(),
      stack,
      value: 0,
      description: author.signature,
      context: `legendary · by ${author.name}`,
      bonus: null,
      faulty: false,
      legendary: true,
      author: author.name,
    };
  }

  const value = 1 + Math.floor(Math.random() * 13);
  const fix = _pick(FIXES[stack][value - 1]);
  // Soft tell: faulty cards are prefixed with `patch:` instead of the natural
  // description — subtle enough to require attention, learnable over a few games.
  const description = faulty ? `patch: ${fix.description.toLowerCase()}` : fix.description;
  return {
    id: ++_cardUid,
    sha: genSha(),
    stack,
    value,
    description,
    context: fix.context,
    bonus: rollBonus(stack),
    faulty,
  };
}

// Effective scoring value of a card.
// Faulty fixes contribute -floor(value/2) instead of +value.
// Legendary fixes contribute 0 — their power is the auto-pass, not points.
// Bonuses (when their condition fires) still add positively — they're independent of faultiness.
function effectiveValue(card) {
  if (card.legendary) return 0;
  return card.faulty ? -Math.floor(card.value / 2) : card.value;
}

let _ticketUid = 0;
// `mercy` (anti-snowball): when the player is on their last strike, the
// next-rolled ticket is softened — tier drops by 1 (min 1) and no blocked stack.
function rollTicket(resolved, opts = {}) {
  let tier;
  const r = Math.random();
  if (resolved < 3)       tier = 1;
  else if (resolved < 7)  tier = r < 0.55 ? 2 : 1;
  else if (resolved < 12) tier = r < 0.55 ? 2 : (r < 0.85 ? 3 : 1);
  else                    tier = r < 0.6 ? 3 : 2;
  if (opts.mercy) tier = Math.max(1, tier - 1);

  const pool = TICKET_POOL.filter(t => t.tier === tier);
  const base = pool[Math.floor(Math.random() * pool.length)];

  // ── Requirements: tier-based chance of multi-stack
  //    Tier 1 → always single (easy intro)
  //    Tier 2 → 30% dual
  //    Tier 3 → 65% dual (incidents touch multiple layers)
  const multiChance = tier === 1 ? 0 : tier === 2 ? 0.30 : 0.65;
  const isMulti = Math.random() < multiChance;

  const requirements = [];
  // Threshold creep is capped at +2 — keeps late-shift tickets challenging
  // without making them statistically unwinnable.
  const CREEP_CAP = 2;
  if (isMulti) {
    // Two-stack requirement with lower per-stack thresholds
    const stack1 = STACK_KEYS[Math.floor(Math.random() * STACK_KEYS.length)];
    const others = STACK_KEYS.filter(s => s !== stack1);
    const stack2 = others[Math.floor(Math.random() * others.length)];
    const baseT = tier === 2 ? 4 : 5;
    const creep = Math.min(Math.floor(resolved / 6), CREEP_CAP);
    requirements.push({ stack: stack1, threshold: baseT + creep });
    requirements.push({ stack: stack2, threshold: baseT + creep });
  } else {
    const stack = STACK_KEYS[Math.floor(Math.random() * STACK_KEYS.length)];
    const baseT = tier === 1 ? 7 : tier === 2 ? 11 : 15;
    const creep = Math.min(Math.floor(resolved / 5), CREEP_CAP);
    requirements.push({ stack, threshold: baseT + creep });
  }

  // Block from the non-required stacks (only possible if there's at least one left)
  const usedStacks = new Set(requirements.map(r => r.stack));
  let blocked = null;
  // Multi-stack tickets are already harder, so reduce blocking chance for them
  const blockChance = isMulti
    ? (tier === 2 ? 0.25 : 0.55)
    : (tier === 1 ? 0 : tier === 2 ? 0.45 : 0.8);
  // Mercy ticket: skip the blocked-stack roll entirely.
  if (!opts.mercy && Math.random() < blockChance) {
    const candidates = STACK_KEYS.filter(s => !usedStacks.has(s));
    if (candidates.length > 0) {
      blocked = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  const severity = tier === 1 ? 'prio-3' : tier === 2 ? 'prio-2' : 'prio-1';
  const ticketId = 'TKT-' + (1000 + Math.floor(Math.random() * 9000));

  return {
    ...base,
    uid: ++_ticketUid,
    requirements,
    blocked,
    reward: tier * 2,
    severity,
    ticketId,
    mercy: !!opts.mercy,
  };
}

// ── Queue helpers ────────────────────────────────────────────────────────────
const QUEUE_SIZE = 3;

// Priority is no longer enforced — any ticket in the inbox can be picked.
// Resolving a lower-priority (higher-numbered) ticket while a more urgent
// one waits incurs a credit penalty (see placeFromHand).
function severityNum(t) {
  return parseInt(t.severity.split('-')[1], 10);
}
function skipPenaltyFor(activeTicket, remaining) {
  const n = severityNum(activeTicket);
  let total = 0;
  const skipped = [];
  remaining.forEach(t => {
    const m = severityNum(t);
    if (m < n) {
      const pen = (3 - m) * 3 + (n - m);
      total += pen;
      skipped.push({ ticketId: t.ticketId, severity: t.severity, penalty: pen });
    }
  });
  return { total, skipped };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Combos — sequence bonuses added to the required-stack score on a deploy
// ─────────────────────────────────────────────────────────────────────────────

const COMBO_DEFS = [
  {
    key: 'stack',
    name: 'STACK_MATCH',
    bonus: 8,
    desc: 'All three fixes on a required stack',
    test: (cards, ticket) =>
      cards.every(c => c.stack === cards[0].stack) &&
      ticket.requirements.some(r => r.stack === cards[0].stack),
  },
  {
    key: 'version',
    name: 'VERSION_MATCH',
    bonus: 10,
    desc: 'Three fixes of the same effort value',
    test: cards => cards[0].value === cards[1].value && cards[1].value === cards[2].value,
  },
  {
    key: 'chain',
    name: 'PATCH_CHAIN',
    bonus: 5,
    desc: 'Three consecutive effort values',
    test: cards => {
      const v = cards.map(c => c.value).sort((a, b) => a - b);
      return v[1] === v[0] + 1 && v[2] === v[1] + 1;
    },
  },
  {
    key: 'cover',
    name: 'MULTI_COVER',
    bonus: 4,
    desc: 'A card invested in every required stack',
    test: (cards, ticket) => {
      if (ticket.requirements.length < 2) return false;
      const stacksUsed = new Set(cards.map(c => c.stack));
      return ticket.requirements.every(r => stacksUsed.has(r.stack));
    },
  },
  {
    key: 'hotfix',
    name: 'HOTFIX',
    bonus: 2,
    desc: 'Includes a senior fix (value 13)',
    test: cards => cards.some(c => c.value === 13),
  },
];

function detectCombos(cards, ticket) {
  if (cards.length !== 3) return [];
  // A legendary in the deploy short-circuits scoring; suppress combos so the
  // (value === 0) trio doesn't accidentally trigger VERSION_MATCH etc.
  if (cards.some(c => c.legendary)) return [];
  return COMBO_DEFS.filter(combo => combo.test(cards, ticket));
}

// Evaluate a deploy against a ticket with one or more requirements.
//
// Per-card scoring: each card contributes its value + (sequence bonus if fired)
// to its own stack's tally.
//
// Per-requirement rules:
//   - stackSum = sum of card values + fired bonus points for cards on that stack
//   - combo bonus is added per-requirement, but ONLY if the requirement has
//     at least one card invested (prevents "free passes" on unplayed stacks)
//   - the requirement passes iff effectiveScore >= threshold
//
// Overall success = ALL requirements pass AND no blocked-stack card played.
// Reward score = sum of stack sums + comboBonus.
function scoreDeploy(cards, ticket) {
  const perStack = {};
  const stackCardCount = {};
  ticket.requirements.forEach(r => {
    perStack[r.stack] = 0;
    stackCardCount[r.stack] = 0;
  });

  // Per-card bonus fired states (also returned for UI display)
  const cardBonuses = cards.map((c, idx) => ({
    fired: bonusFires(c.bonus, idx, cards),
    bonus: c.bonus,
    points: c.bonus && bonusFires(c.bonus, idx, cards) ? c.bonus.points : 0,
  }));

  cards.forEach((c, idx) => {
    if (perStack[c.stack] !== undefined) {
      perStack[c.stack] += effectiveValue(c) + cardBonuses[idx].points;
      stackCardCount[c.stack]++;
    }
  });

  const combos = detectCombos(cards, ticket);
  const comboBonus = combos.reduce((s, c) => s + c.bonus, 0);

  const reqStatus = ticket.requirements.map(r => {
    const stackSum = perStack[r.stack] || 0;
    // "Invested" = at least one card placed on this stack.
    // Using card count (not stackSum > 0) — a faulty card with negative contribution
    // still counts as investment, so combo bonuses can apply.
    const invested = (stackCardCount[r.stack] || 0) > 0;
    const bonusApplied = invested ? comboBonus : 0;
    const effective = stackSum + bonusApplied;
    return {
      stack: r.stack,
      threshold: r.threshold,
      stackSum,
      bonusApplied,
      effective,
      passed: effective >= r.threshold,
    };
  });

  const baseScore = Object.values(perStack).reduce((a, b) => a + b, 0);

  // Legendary auto-pass: a single legendary card in the 3-card deploy
  // forces every requirement to pass and ignores the blocked-stack taint.
  // Velocity still comes from the non-legendary cards' values (legendaries
  // contribute 0). Mark the result so the UI can surface the override.
  const hasLegendary = cards.some(c => c.legendary);
  const legendaryAuthors = cards.filter(c => c.legendary).map(c => c.author);

  const tainted = hasLegendary
    ? false
    : (!!ticket.blocked && cards.some(c => c.stack === ticket.blocked));

  const finalReqStatus = hasLegendary
    ? reqStatus.map(r => ({ ...r, passed: true }))
    : reqStatus;
  const allPassed = finalReqStatus.every(r => r.passed);

  return {
    perStack,
    reqStatus: finalReqStatus,
    baseScore,
    combos,
    comboBonus,
    cardBonuses,
    total: baseScore + comboBonus,
    tainted,
    allPassed,
    legendary: hasLegendary,
    legendaryAuthors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fix card
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  Hand card — shown in the hand area, one per stack.
//  Tapping places it into the next deploy slot.
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
  const showBox = hovered || isLegendary;
  const borderColor = isLegendary ? C.legendary : (bonusFiresNow ? C.warning : C.borderHi);
  // Legendary cards ignore blocked-stack warnings — they auto-pass anyway.
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
        boxShadow: isLegendary
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
        }}>
          {isLegendary ? '★' : s.name}
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
        <div style={{ fontSize: '0.6rem', color: C.faint, flexShrink: 0 }}>
          ×{remaining}
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
//  Deploy package — read-only display of cherry-picked fixes (final, no revert)
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
  // Per-stack draw pool — cards waiting behind the one currently in hand.
  // Built once at startShift() with fixed faulty/legendary quotas; sliced as
  // cards are played. `usesRemaining` below is derived from this + hand.
  const [pool, setPool]                   = useState({});
  // Hand: one card per stack (preview of what would be placed next from that stack)
  const [hand, setHand]                   = useState({});
  // Deploy package: ordered array of placed cards, max 3
  const [deployed, setDeployed]           = useState([]);
  const [tickets, setTickets]             = useState([]);
  const [activeUid, setActiveUid]         = useState(null);
  const [credits, setCredits]             = useState(0);
  const [strikes, setStrikes]             = useState(3);
  const [resolved, setResolved]           = useState(0);
  // Anti-snowball: armed when the player drops to 1 strike on a rejection;
  // disarmed after softening the very next rolled ticket.
  const [mercyArmed, setMercyArmed]       = useState(false);
  // Phases: 'intro' | 'playing' | 'over'. Deploys auto-fire on the 3rd
  // placement, so there's no separate 'result' phase — the just-finished
  // ticket lives in `closedTickets` and is surfaced via `viewingClosedUid`.
  const [phase, setPhase]                 = useState('intro');
  // Most recent git command (cherry-pick / restore) — shown in terminal scrollback
  const [lastCommand, setLastCommand]     = useState(null);
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

  const ticket = useMemo(
    () => tickets.find(t => t.uid === activeUid) || null,
    [tickets, activeUid]
  );
  const viewingClosed = useMemo(
    () => closedTickets.find(c => c.ticket.uid === viewingClosedUid) || null,
    [closedTickets, viewingClosedUid]
  );

  // Per-stack "draws still possible" count: the card currently in hand plus
  // every card still queued in the pool. Drives the StackPoolList readout
  // and the deploy-impossible shift-end check.
  const usesRemaining = useMemo(() => {
    const out = {};
    STACK_KEYS.forEach(s => {
      out[s] = (hand[s] ? 1 : 0) + (pool[s]?.length || 0);
    });
    return out;
  }, [hand, pool]);

  // Visible count of legendaries still in the player's deck (hand + pool).
  const legendaryRemaining = useMemo(() => {
    let n = 0;
    STACK_KEYS.forEach(s => {
      if (hand[s]?.legendary) n++;
      (pool[s] || []).forEach(c => { if (c.legendary) n++; });
    });
    return n;
  }, [hand, pool]);

  function startShift() {
    const decks = buildShiftDecks();
    const initialHand = {};
    const initialPool = {};
    STACK_KEYS.forEach(s => {
      initialHand[s] = decks[s][0] || null;
      initialPool[s] = decks[s].slice(1);
    });
    const initialQueue = [rollTicket(0), rollTicket(0), rollTicket(0)];
    setPool(initialPool);
    setHand(initialHand);
    setDeployed([]);
    setTickets(initialQueue);
    setActiveUid(initialQueue[0].uid);
    setCredits(0);
    setStrikes(3);
    setResolved(0);
    setMercyArmed(false);
    setLastCommand(null);
    setClosedTickets([]);
    setViewingClosedUid(null);
    // If we're coming from an over screen, adopt the host shown on the
    // restart prompt so the new terminal header matches what was clicked.
    setHost(nextHost || genHost());
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

  // Place the hand card from stack S into the deploy package.
  // On the 3rd placement the deploy fires automatically: the ticket gets
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
    // Pop the next pool card into hand; null if the pool for this stack is dry.
    const newPoolForStack = pool[stack] || [];
    const nextCard = newPoolForStack[0] || null;
    const newPool = { ...pool, [stack]: newPoolForStack.slice(1) };
    const newHand = { ...hand, [stack]: nextCard };
    setPool(newPool);
    setHand(newHand);
    setLastCommand({
      cmd: `git cherry-pick ${card.sha}`,
      note: `${STACKS[card.stack].name}: ${card.description}`,
      kind: 'pick',
    });

    if (newDeployed.length < 3) {
      setDeployed(newDeployed);
      return;
    }

    // Auto-deploy on the third placement.
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
    // 3-card deploy out of the remaining fix pool.
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
      const nextTicket = rollTicket(nextResolved, { mercy: mercyArmed });
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
      // Partial: per-card bonuses can fire (e.g. "first", "after X") even with <3 cards
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
              {/* LEFT: inbox queue */}
              <div style={{ flex: '1 1 240px', maxWidth: '300px', minWidth: 0 }}>
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
                      // After auto-deploy the player is parked on the just-
                      // finished ticket (no active). The inbox rows are how
                      // they pick the next task — light them up to invite.
                      pickable={phase === 'playing' && !activeUid}
                      onClick={() => selectTicket(t.uid)}
                    />
                  ))}
                </div>
              </div>

              {/* MIDDLE: ticket detail — active OR closed (when viewing) */}
              <div style={{ flex: '99 1 320px', minWidth: 0 }}>
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

              {/* RIGHT: closed tickets */}
              <div style={{ flex: '1 1 220px', maxWidth: '280px', minWidth: 0 }}>
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
                <TerminalPrompt
                  command={`git tag -l 'fix-*-pending' | awk -F- '{print $2}' | uniq -c`}
                  comment="placements remaining per stack"
                />
                <StackPoolList usesRemaining={usesRemaining} legendaryRemaining={legendaryRemaining} />

                <TerminalPrompt command="git log -4 fix-candidates --oneline" comment="tap to cherry-pick into deploy" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '0 10px 4px' }}>
                  {STACK_KEYS.map(s => (
                    <HandCard
                      key={s}
                      stack={s}
                      card={hand[s]}
                      remaining={usesRemaining[s]}
                      blocked={ticket && s === ticket.blocked}
                      deployFull={deployed.length >= 3}
                      deployed={deployed}
                      phase={phase}
                      onClick={() => placeFromHand(s)}
                    />
                  ))}
                </div>

                <ScrollbackLine command={lastCommand} />

                <TerminalPrompt command="git diff --staged HEAD~3..HEAD" comment={
                  !ticket ? 'no ticket selected · pick one from the inbox' :
                  deployed.length === 0 ? 'nothing staged' :
                  deployed.length < 3 ? `${deployed.length}/3 staged · the 3rd pick auto-ships` :
                  '3/3 staged'
                } />
                <div style={{ padding: '0 10px' }}>
                  <DeployPackage
                    deployed={deployed}
                    preview={preview}
                    blocked={ticket?.blocked}
                    phase={phase}
                  />
                </div>
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
          previous runs
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
              if (narrow) {
                // Mobile: rank + velocity on a primary line, meta on a secondary muted line.
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: '8px 12px',
                      borderBottom: i === sorted.length - 1 ? 'none' : `1px solid ${C.trackerBorder}`,
                      background: isTop ? C.panel2 : 'transparent',
                    }}
                  >
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
                  }}
                >
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
                  }}>
                    {r.credits}
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
function TerminalPrompt({ command, comment, tone, onClick, disabled }) {
  const color =
    tone === 'danger'  ? C.danger  :
    tone === 'warning' ? C.warning :
    C.termPrompt;
  const clickable = !!onClick && !disabled;
  const [hovered, setHovered] = useState(false);
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
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: '6px',
    rowGap: '2px',
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

  const inner = (
    <>
      <span style={{ color, fontWeight: 700, flexShrink: 0 }}>$</span>
      <span style={{
        color: C.termText,
        fontWeight: 600,
        flex: '1 1 auto',
        minWidth: 0,
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
      }}>{command}</span>
      {comment && (
        <span style={{
          color: C.faint,
          fontStyle: 'italic',
          // Force the comment onto its own line, anchored to the right.
          // Long commands no longer push it past the terminal edge.
          flex: '1 0 100%',
          textAlign: 'right',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
        }}>
          # {comment}
        </span>
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

// Scrollback echo line — shows the most recent git command that was run.
// Persists until the next interaction replaces it.
function ScrollbackLine({ command }) {
  if (!command) return null;
  return (
    <div style={{
      padding: '2px 14px 4px',
      fontSize: '0.65rem',
      fontFamily: "'JetBrains Mono', monospace",
      display: 'flex',
      alignItems: 'baseline',
      gap: '6px',
      opacity: 0.85,
    }}>
      <span style={{ color: C.faint }}>›</span>
      <span style={{ color: C.termPrompt, fontWeight: 600 }}>
        {command.cmd}
      </span>
      <span style={{ color: C.faint, marginLeft: 'auto', fontStyle: 'italic' }}>
        # {command.note}
      </span>
    </div>
  );
}

// Per-stack pool bar — shown in the terminal (engineer's resources)
// Per-stack pool — shown as terminal command output (uniq -c style).
function StackPoolList({ usesRemaining, legendaryRemaining }) {
  return (
    <div style={{
      padding: '4px 14px 10px',
      fontSize: '0.72rem',
      fontFamily: "'JetBrains Mono', monospace",
      borderBottom: `1px solid ${C.termBorder}`,
    }}>
      {/* legendaries-remaining readout — sits above the per-stack counts so the
          player can plan rescues. Goes faint when none are left in the deck. */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '1px 0 4px',
        lineHeight: 1.4,
      }}>
        <span style={{
          color: legendaryRemaining > 0 ? C.legendary : C.faint,
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
          minWidth: '24px',
          fontWeight: 700,
        }}>
          {legendaryRemaining}
        </span>
        <span style={{
          color: legendaryRemaining > 0 ? C.legendary : C.faint,
          fontWeight: 700,
          fontSize: '0.7rem',
          letterSpacing: '0.04em',
        }}>
          ★ legendary
        </span>
        {legendaryRemaining === 0 && (
          <span style={{
            color: C.faint,
            fontSize: '0.6rem',
            fontStyle: 'italic',
            letterSpacing: '0.05em',
            marginLeft: '4px',
          }}>
            none in deck
          </span>
        )}
      </div>
      {STACK_KEYS.map(s => {
        const remaining = usesRemaining[s] ?? 0;
        const isLow = remaining > 0 && remaining <= 3;
        const isDead = remaining === 0;
        return (
          <div key={s} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            opacity: isDead ? 0.5 : 1,
            padding: '1px 0',
            lineHeight: 1.4,
          }}>
            {/* count, right-aligned like `uniq -c` output */}
            <span style={{
              color: isDead ? C.faint : isLow ? C.warning : C.termText,
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
              minWidth: '24px',
              fontWeight: 700,
            }}>
              {remaining}
            </span>
            {/* stack label, lowercased like a real tag prefix */}
            <span style={{
              color: STACKS[s].color,
              fontWeight: 700,
              fontSize: '0.7rem',
            }}>
              {STACKS[s].name.toLowerCase()}
            </span>
            {isDead && (
              <span style={{
                color: C.danger,
                fontSize: '0.6rem',
                fontStyle: 'italic',
                letterSpacing: '0.05em',
                fontWeight: 700,
                marginLeft: '4px',
              }}>
                exhausted
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Compact one-line ticket row, shown in the inbox queue ──────────────
// `pickable` flags rows the player can click in result phase to advance the
// queue — drawn with a subtle accent tint to invite the click.
function QueueRow({ ticket, active, disabled, pickable, onClick }) {
  const sevColor =
    ticket.severity === 'prio-1' ? C.danger  :
    ticket.severity === 'prio-2' ? C.warning :
    C.muted;
  const isMulti = ticket.requirements.length > 1;

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

      {/* required stacks (joined with +) */}
      <span style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '2px',
        flexShrink: 0,
        minWidth: '38px',
      }}>
        {ticket.requirements.map((r, i) => (
          <React.Fragment key={r.stack}>
            {i > 0 && <span style={{ fontSize: '0.55rem', color: C.faint }}>+</span>}
            <span style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              color: STACKS[r.stack].color,
              letterSpacing: '0.03em',
            }}>
              {STACKS[r.stack].name}
            </span>
          </React.Fragment>
        ))}
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

      {/* threshold + indicators */}
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span style={{ fontSize: '0.65rem', color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
          {ticket.requirements.map(r => `≥${r.threshold}`).join(isMulti ? '+' : '')}
        </span>
        {ticket.blocked && (
          <span style={{
            fontSize: '0.55rem',
            color: C.danger,
            padding: '1px 4px',
            border: `1px solid ${C.danger}`,
            borderRadius: '2px',
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}>
            ✕{STACKS[ticket.blocked].name}
          </span>
        )}
        {active && <span style={{ color: C.accent, fontWeight: 700, fontSize: '0.75rem' }}>●</span>}
      </span>
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
// section (the push output of that deploy).
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

// ── Closed ticket detail card, rendered in the main triage panel when a
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
            · ★ legendary by {result.legendaryAuthors.join(' + ')}
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

// ─────────────────────────────────────────────────────────────────────────────
//  README-style helpers — render the intro screen as if it's a rendered .md file
// ─────────────────────────────────────────────────────────────────────────────

function MdH1({ children }) {
  return (
    <h1 style={{
      fontSize: '1.6rem',
      fontWeight: 700,
      margin: '0 0 0.3em',
      color: C.text,
      borderBottom: `1px solid ${C.border}`,
      paddingBottom: '0.3em',
      letterSpacing: '-0.01em',
    }}>{children}</h1>
  );
}

function MdH2({ children }) {
  return (
    <h2 style={{
      fontSize: '1.05rem',
      fontWeight: 700,
      margin: '1.4em 0 0.4em',
      color: C.text,
      borderBottom: `1px solid ${C.border}`,
      paddingBottom: '0.25em',
    }}>{children}</h2>
  );
}

function MdP({ children, color }) {
  return (
    <p style={{
      fontSize: '0.85rem',
      lineHeight: 1.6,
      color: color || C.muted,
      margin: '0.6em 0',
    }}>{children}</p>
  );
}

function MdUL({ children }) {
  return (
    <ul style={{
      margin: '0.4em 0',
      paddingLeft: '1.4em',
      color: C.muted,
      fontSize: '0.85rem',
      lineHeight: 1.7,
    }}>{children}</ul>
  );
}

function MdLI({ children }) {
  return <li style={{ margin: '0.25em 0' }}>{children}</li>;
}

function MdOL({ children }) {
  return (
    <ol style={{
      margin: '0.4em 0',
      paddingLeft: '1.6em',
      color: C.muted,
      fontSize: '0.85rem',
      lineHeight: 1.7,
    }}>{children}</ol>
  );
}

function MdB({ children, color }) {
  return (
    <strong style={{
      color: color || C.text,
      fontWeight: 700,
    }}>{children}</strong>
  );
}

function MdCode({ children, color }) {
  return (
    <code style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.88em',
      background: 'rgba(110, 118, 129, 0.15)',
      color: color || C.warning,
      padding: '1px 6px',
      borderRadius: '4px',
    }}>{children}</code>
  );
}

function MdNote({ children, color }) {
  return (
    <blockquote style={{
      margin: '0.8em 0',
      padding: '0.5em 1em',
      borderLeft: `3px solid ${color || C.accent}`,
      background: 'rgba(88, 166, 255, 0.06)',
      color: C.muted,
      fontSize: '0.82rem',
      lineHeight: 1.55,
      borderRadius: '0 4px 4px 0',
    }}>{children}</blockquote>
  );
}

function MdHR() {
  return (
    <hr style={{
      border: 'none',
      borderTop: `1px solid ${C.border}`,
      margin: '1.5em 0',
    }} />
  );
}

function IntroScreen({ onStart }) {
  const narrow = useIsNarrow();
  return (
    <div style={{
      maxWidth: '720px',
      margin: narrow ? '8px auto 0' : '14px auto 0',
      padding: narrow ? '16px 14px' : '28px 32px',
      background: C.trackerBg,
      border: `1px solid ${C.trackerBorder}`,
      borderRadius: '8px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: C.muted,
    }}>
      {/* file header — like a GitHub repo file view */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.7rem',
        color: C.faint,
        marginBottom: '20px',
        paddingBottom: '8px',
        borderBottom: `1px dashed ${C.border}`,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <span style={{ color: C.success }}>●</span>
        <span>README.md</span>
        <span style={{ marginLeft: 'auto', color: C.faint }}>· main · last edited just now</span>
      </div>

      <MdH1>on-call</MdH1>

      <MdNote>
        <MdB>A solo card game about DevOps triage.</MdB> Tickets land in your inbox. Cherry-pick fixes from your hand. Ship before the pager fires.{' '}
        <span style={{ color: C.faint, fontStyle: 'italic' }}>
          So you can keep doing DevOps after you've finished doing DevOps — because clearly one shift a day wasn't enough.
        </span>
      </MdNote>

      <MdH2>quick start</MdH2>
      <MdOL>
        <MdLI>Pick a ticket from the <MdB color={C.accent}>inbox</MdB> — each demands one or two stack thresholds (e.g. <MdCode color={STACKS.db.color}>db ≥ 7</MdCode> or <MdCode color={STACKS.db.color}>db ≥ 5</MdCode> <span style={{ color: C.faint }}>+</span> <MdCode color={STACKS.api.color}>api ≥ 5</MdCode>).</MdLI>
        <MdLI>Read your candidate fixes — they appear as <MdCode>git log -4 fix-candidates --oneline</MdCode>, one per stack.</MdLI>
        <MdLI>Tap a candidate to <MdB color={C.success}>cherry-pick</MdB> it into the deploy. The <MdB color={C.success}>3rd pick auto-ships</MdB> — every requirement must clear its threshold.</MdLI>
        <MdLI>Successful deploys earn <MdB color={C.success}>velocity</MdB>. Failed deploys cost a strike. <MdB color={C.danger}>3 strikes → paged off-call.</MdB></MdLI>
        <MdLI>Shift ends on the third strike, or when fewer than 3 fixes remain in the pool.</MdLI>
      </MdOL>

      <MdH2>the board</MdH2>
      <MdUL>
        <MdLI><MdB color={C.accent}>INBOX</MdB> — up to {QUEUE_SIZE} open tickets at a time. A new one rolls in after each resolution.</MdLI>
        <MdLI><MdB color={C.accent}>ACTIVE TICKET</MdB> — the one you're currently solving. Shows requirements, blocked stack, and live preview.</MdLI>
        <MdLI><MdB color={C.accent}>HAND</MdB> — one candidate fix per stack, refilled from each stack's pool of {STACK_POOL_SIZE}.</MdLI>
        <MdLI><MdB color={C.accent}>DEPLOY</MdB> — the staged cherry-picks. Auto-ships at 3.</MdLI>
        <MdLI><MdB color={C.accent}>DONE</MdB> — closed tickets. Click any to inspect its diff and outcome.</MdLI>
      </MdUL>

      <MdH2>stacks</MdH2>
      <MdP>Four disciplines. Each fix lives on exactly one stack:</MdP>
      <MdUL>
        {STACK_KEYS.map(k => (
          <MdLI key={k}>
            <MdCode color={STACKS[k].color}>{STACKS[k].name.toLowerCase()}</MdCode>{' '}
            <span style={{ color: C.muted }}>— {STACKS[k].label}</span>
          </MdLI>
        ))}
      </MdUL>

      <MdH2>tickets</MdH2>
      <MdUL>
        <MdLI><MdB>Requirements:</MdB> single-stack (must beat one threshold) or dual-stack (both must beat their own threshold independently).</MdLI>
        <MdLI><MdB color={C.danger}>Blocked stack:</MdB> some tickets ban one stack. Touching it taints the entire deploy — automatic rejection.</MdLI>
        <MdLI><MdB>Reward multiplier:</MdB> tier-based (<MdCode>×2</MdCode> easy, <MdCode>×4</MdCode> medium, <MdCode>×6</MdCode> incident). Final velocity = deploy score × multiplier.</MdLI>
        <MdLI>Tickets get harder as your <MdCode>resolved</MdCode> count climbs — more dual-stack, more incidents, creeping thresholds.</MdLI>
      </MdUL>

      <MdH2>priority &amp; skip penalty</MdH2>
      <MdP>
        Severity is <MdCode color={C.danger}>prio-1</MdCode> (most urgent), <MdCode color={C.warning}>prio-2</MdCode>, <MdCode>prio-3</MdCode>. You may close them in any order — but resolving <MdCode>prio-n</MdCode> while a stricter <MdCode>prio-m</MdCode> (<MdCode>m &lt; n</MdCode>) sits in the inbox deducts <MdCode color={C.danger}>−((3 − m) × 3 + n − m) × (resolved ticket's multiplier)</MdCode> velocity per skipped ticket. The multiplier scaling means cheap closes feel cheap and great closes still pay — but ducking a prio-1 for a cushy prio-3 stings.
      </MdP>
      <MdUL>
        <MdLI>Skip a <MdCode color={C.danger}>prio-1</MdCode> to close a <MdCode>prio-3</MdCode> (×2) → <MdCode color={C.danger}>−16</MdCode></MdLI>
        <MdLI>Skip a <MdCode color={C.danger}>prio-1</MdCode> to close a <MdCode color={C.warning}>prio-2</MdCode> (×4) → <MdCode color={C.danger}>−28</MdCode></MdLI>
        <MdLI>Skip a <MdCode color={C.warning}>prio-2</MdCode> to close a <MdCode>prio-3</MdCode> (×2) → <MdCode color={C.danger}>−8</MdCode></MdLI>
      </MdUL>

      <MdH2>fix cards</MdH2>
      <MdUL>
        <MdLI><MdB>Value:</MdB> <MdCode>1</MdCode>–<MdCode>13</MdCode> effort points contributed to the card's stack.</MdLI>
        <MdLI><MdB color={C.warning}>★ sequence bonus</MdB> (~half of cards): extra points if the placement condition is met. The hand highlights amber with <MdCode color={C.success}>✓ ready</MdCode> when it would fire on the next pick.</MdLI>
        <MdLI><MdB color={C.danger}>Bugged:</MdB> exactly <MdCode>6</MdCode> per shift (~15% of draws) — scored as <MdCode color={C.danger}>−⌊value/2⌋</MdCode> after placement. Look for the <MdCode color={C.danger}>patch:</MdCode> prefix in the description — it's the soft tell. Bonuses still fire on bugged cards.</MdLI>
        <MdLI><MdB color={C.danger}>Cherry-picks are final</MdB> — no revert once a card lands in the deploy.</MdLI>
      </MdUL>

      <MdP>Sequence bonus conditions:</MdP>
      <MdUL>
        <MdLI><MdCode color={C.warning}>first placed</MdCode> — fires in slot 1</MdLI>
        <MdLI><MdCode color={C.warning}>last placed</MdCode> — fires in slot 3</MdLI>
        <MdLI><MdCode color={C.warning}>after &lt;stack&gt;</MdCode> — previous slot has that stack</MdLI>
        <MdLI><MdCode color={C.warning}>before &lt;stack&gt;</MdCode> — next slot will have that stack</MdLI>
        <MdLI><MdCode color={C.warning}>with &lt;stack&gt;</MdCode> — any other slot has that stack</MdLI>
      </MdUL>

      <MdH2>★ legendary fixes</MdH2>
      <MdP>
        Exactly <MdCode>2</MdCode> <MdB color={C.legendary}>legendary fixes</MdB> are seeded into the deck each shift — gold-tinted, attributed to a famous programmer (Linus Torvalds, Ada Lovelace, Grace Hopper, &amp; co). The terminal shows how many remain in the deck so you can plan around them.
      </MdP>
      <MdUL>
        <MdLI>One legendary in your 3-card deploy <MdB color={C.success}>auto-passes</MdB> every requirement and ignores the blocked stack.</MdLI>
        <MdLI>The card itself contributes <MdCode>0</MdCode> velocity — only the other two normal cards in the deploy add points.</MdLI>
        <MdLI>Never bugged. Never carries a sequence bonus. Combos are suppressed when a legendary is in the deploy.</MdLI>
        <MdLI>Skip penalty still applies — they rescue a ticket but don't rewrite which ticket you chose.</MdLI>
      </MdUL>
      <MdP>
        <span style={{ color: C.faint, fontStyle: 'italic' }}>
          Burn them on an impossible blocked-stack incident, or save them for a prio-1 you'd otherwise have to skip. Three legendaries in a row clears a ticket for zero velocity — sometimes that's still the right call.
        </span>
      </MdP>

      <MdH2>mercy</MdH2>
      <MdP>
        Drop to your last strike on a rejection and the very next inbox ticket arrives with a <MdB color={C.success}>MERCY</MdB> tag: tier drops by one, no blocked stack. Single-shot anti-snowball — it doesn't trigger twice in a row.
      </MdP>

      <MdH2>combo bonuses</MdH2>
      <MdP>Detected on the full 3-card deploy. They stack with sequence bonuses and the multiplier:</MdP>
      <MdUL>
        {COMBO_DEFS.map(c => (
          <MdLI key={c.key}>
            <MdCode color={C.accent}>{c.name}</MdCode>{' '}
            <span style={{ color: C.muted }}>— {c.desc}</span>{' '}
            <MdB color={C.success}>+{c.bonus}</MdB>
          </MdLI>
        ))}
      </MdUL>

      <MdH2>scoring</MdH2>
      <MdUL>
        <MdLI>Each requirement passes iff <MdCode>stack sum + sequence bonuses + applicable combo ≥ threshold</MdCode>.</MdLI>
        <MdLI>A combo bonus only counts toward a requirement that has at least one card invested.</MdLI>
        <MdLI>Deploy succeeds iff every requirement passes <MdB>and</MdB> no blocked-stack card was played.</MdLI>
        <MdLI>On success: <MdCode color={C.success}>+velocity = total score × ticket multiplier</MdCode>. Then subtract any skip penalty.</MdLI>
        <MdLI>On failure: no velocity, lose a strike, skip penalty still applies.</MdLI>
      </MdUL>

      <MdHR />

      <button
        onClick={onStart}
        style={{
          width: '100%',
          padding: '14px',
          background: 'transparent',
          color: C.success,
          border: `1px solid ${C.success}`,
          borderRadius: '6px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.9rem',
          fontWeight: 700,
          letterSpacing: '0.03em',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(63,185,80,0.1)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        $ start-shift
      </button>
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

      {/* overall status */}
      <div style={{ fontSize: '0.72rem', marginTop: '6px' }}>
        <span style={{ color: C.faint }}>deploy status: </span>
        {preview.tainted ? (
          <span style={{ color: C.danger, fontWeight: 700 }}>BLOCKED — touches {blk?.name}</span>
        ) : preview.allPassed ? (
          <span style={{ color: C.success, fontWeight: 700 }}>READY · all requirements met</span>
        ) : (
          <span style={{ color: C.warning, fontWeight: 700 }}>
            {preview.reqStatus.filter(r => !r.passed).length} of {preview.reqStatus.length} short
          </span>
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
          : `   ! [rejected]   ${result.sha} -> main (deploy failed)`}
      </TermLine>

      {/* Spacer */}
      <div style={{ height: '6px' }} />

      <TermLine color={C.warning}>
        commit {result.sha}{' '}
        <span style={{ color: C.faint }}>(HEAD → main)</span>
      </TermLine>
      <TermLine dim>ticket: {ticket.ticketId}</TermLine>

      <div style={{ height: '6px' }} />

      {/* Diff lines for each deployed card */}
      {cards.map((c, i) => {
        const s = STACKS[c.stack];
        const isLegendary = !!c.legendary;
        const counted = requiredStacks.has(c.stack);
        // Legendary cards bypass blocked-stack taint entirely.
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
            ★ legendary fix · auto-pass by {result.legendaryAuthors.join(' + ')}
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

      {/* Per-requirement results */}
      {!result.tainted && result.reqStatus && (
        <>
          <div style={{ height: '6px' }} />
          <TermLine dim>requirement check:</TermLine>
          {result.reqStatus.map(r => {
            const s = STACKS[r.stack];
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
              }}>
                <span style={{ width: '10px', color: r.passed ? C.success : C.danger, fontWeight: 700 }}>
                  {r.passed ? '✓' : '✗'}
                </span>
                <span style={{ color: s.color, fontWeight: 700, minWidth: '30px' }}>
                  {s.name.toLowerCase()}
                </span>
                <span style={{ color: C.muted }}>
                  {r.stackSum}
                  {r.bonusApplied > 0 && (
                    <>
                      <span style={{ color: C.faint }}> + </span>
                      <span style={{ color: C.success }}>{r.bonusApplied}</span>
                      <span style={{ color: C.faint }}> = </span>
                      {r.effective}
                    </>
                  )}
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
          ? '× paged off-call — three failed deploys'
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
