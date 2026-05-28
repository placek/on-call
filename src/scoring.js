import { STACKS, COMBO_DEFS } from './game';

// ─────────────────────────────────────────────────────────────────────────────
//  Sequence bonuses — optional rules attached to fixes.
//  When a fix's bonus condition is met by its position in the stage,
//  the bonus points add to that fix's stack contribution toward the ticket.
// ─────────────────────────────────────────────────────────────────────────────

export function bonusFires(bonus, idx, deployed) {
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

export function bonusLabel(bonus) {
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

// "Would this bonus fire if I placed this fix right now?"
// Used to highlight fix candidates whose bonus is ripe for the picking.
export function bonusWouldFireIfPlacedNow(bonus, deployed) {
  if (!bonus) return false;
  const futureIdx = deployed.length;
  switch (bonus.kind) {
    case 'first':  return futureIdx === 0;
    case 'last':   return futureIdx === 2; // will complete the stage
    case 'after':  return futureIdx > 0 && deployed[futureIdx - 1].stack === bonus.dep;
    case 'before': return false; // can't know yet; depends on what's placed AFTER
    case 'with':   return deployed.some(c => c.stack === bonus.dep);
    default:       return false;
  }
}

// Effective scoring value of a fix.
// Faulty fixes contribute -floor(value/2) instead of +value.
// Legendary fixes contribute 0 — their power is the auto-pass, not points.
// Bonuses (when their condition fires) still add positively — they're independent of faultiness.
export function effectiveValue(card) {
  if (card.legendary) return 0;
  return card.faulty ? -Math.floor(card.value / 2) : card.value;
}

// ── Skip penalty ─────────────────────────────────────────────────────────────
// Priority is not enforced — any ticket in the inbox can be picked. Resolving
// a lower-priority (higher-numbered) ticket while a more urgent one waits
// incurs a credit penalty.
export function severityNum(t) {
  return parseInt(t.severity.split('-')[1], 10);
}

export function skipPenaltyFor(activeTicket, remaining) {
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

// ── Combos & stage scoring ───────────────────────────────────────────────────

export function detectCombos(cards, ticket) {
  if (cards.length !== 3) return [];
  // A legendary in the stage short-circuits scoring; suppress combos so the
  // (value === 0) trio doesn't accidentally trigger VERSION_MATCH etc.
  if (cards.some(c => c.legendary)) return [];
  return COMBO_DEFS.filter(combo => combo.test(cards, ticket));
}

// Evaluate a stage against a ticket with one or more requirements.
//
// Per-fix scoring: each fix contributes its value + (sequence bonus if fired)
// to its own stack's tally.
//
// Per-requirement rules:
//   - stackSum = sum of fix values + fired bonus points for fixes on that stack
//   - combo bonus is added per-requirement, but ONLY if the requirement has
//     at least one fix invested (prevents "free passes" on unplayed stacks)
//   - the requirement passes iff effectiveScore >= threshold
//
// Overall success = ALL requirements pass AND no blocked-stack fix played.
// Reward score = sum of stack sums + comboBonus.
export function scoreDeploy(cards, ticket) {
  const perStack = {};
  const stackCardCount = {};
  ticket.requirements.forEach(r => {
    perStack[r.stack] = 0;
    stackCardCount[r.stack] = 0;
  });

  // Per-fix bonus fired states (also returned for UI display)
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
    // "Invested" = at least one fix placed on this stack.
    // Using fix count (not stackSum > 0) — a faulty fix with negative contribution
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

  // Legendary auto-pass: a single legendary fix in the 3-fix stage
  // forces every requirement to pass and ignores the blocked-stack taint.
  // Velocity still comes from the non-legendary fixes' values (legendaries
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
