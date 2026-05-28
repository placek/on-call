import { FIXES, TICKET_POOL, PROGRAMMERS } from './content';
import { STACK_KEYS, STACK_POOL_SIZE } from './game';

function _pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate a fake 7-char git SHA (lowercase hex)
function genSha() {
  let s = '';
  for (let i = 0; i < 7; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rollBonus(stack) {
  // ~50% of fixes have no bonus
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

let _cardUid = 0;

// Fixed per-shift quotas — guarantees the same risk/reward shape every game.
// Total pool slots = STACK_KEYS.length × STACK_POOL_SIZE = 4 × 10 = 40.
//   FAULTY_PER_SHIFT = 6  → 15% of draws are bugged (was random 18%)
//   LEGENDARY_PER_SHIFT = 2 → guaranteed two rescue fixes per shift
// Slot positions are randomized inside buildShiftDecks() so each game still
// feels different, but the *budget* is constant.
const FAULTY_PER_SHIFT = 6;
const LEGENDARY_PER_SHIFT = 2;

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
  // Soft tell: faulty fixes are prefixed with `patch:` instead of the natural
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

// Build the full 40-fix shift deck, bucketed by stack. Allocates the
// faulty/legendary quotas across slots first, then materializes each slot
// into a fix (value, description variant, sequence bonus, author rolled
// per-fix).
export function buildShiftDecks() {
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

let _ticketUid = 0;

// `mercy` (anti-snowball): when the player is on their last strike, the
// next-rolled ticket is softened — tier drops by 1 (min 1) and no blocked stack.
export function rollTicket(resolved, opts = {}) {
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
  const prefix = opts.projectKey || 'TKT';
  const ticketId = `${prefix}-${1000 + Math.floor(Math.random() * 9000)}`;

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
