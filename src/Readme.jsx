import React from 'react';
import { C } from './theme';
import { STACKS, STACK_KEYS, STACK_POOL_SIZE, QUEUE_SIZE, COMBO_DEFS } from './game';
import { useIsNarrow } from './hooks';

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

function formatDeployDate() {
  try {
    /* eslint-disable no-undef */
    const iso = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : null;
    /* eslint-enable no-undef */
    if (!iso) return 'dev';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'dev';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  IntroScreen — the README-styled landing page rendered before a shift starts.
// ─────────────────────────────────────────────────────────────────────────────

export function IntroScreen({ onStart }) {
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
        <span style={{ marginLeft: 'auto', color: C.faint }}>
          · main · last deployed {formatDeployDate()}
        </span>
      </div>

      <MdH1>on-call</MdH1>

      <MdNote>
        <MdB>A solo game about DevOps triage.</MdB> Tickets land in your inbox. Cherry-pick from your fix candidates. Ship before the pager fires.{' '}
        <span style={{ color: C.faint, fontStyle: 'italic' }}>
          So you can keep doing DevOps after you've finished doing DevOps — because clearly one shift a day wasn't enough.
        </span>
      </MdNote>

      <MdH2>quick start</MdH2>
      <MdOL>
        <MdLI>Pick a ticket from the <MdB color={C.accent}>inbox</MdB> — each demands one or two stack thresholds (e.g. <MdCode color={STACKS.db.color}>db ≥ 7</MdCode> or <MdCode color={STACKS.db.color}>db ≥ 5</MdCode> <span style={{ color: C.faint }}>+</span> <MdCode color={STACKS.api.color}>api ≥ 5</MdCode>).</MdLI>
        <MdLI>Read your fix candidates — they appear as <MdCode>git log -4 fix-candidates --oneline</MdCode>, one per stack.</MdLI>
        <MdLI>Tap a candidate to <MdB color={C.success}>cherry-pick</MdB> it into the stage. The <MdB color={C.success}>3rd pick auto-ships</MdB> — every requirement must clear its threshold.</MdLI>
        <MdLI>Successful stages earn <MdB color={C.success}>velocity</MdB>. Failed stages cost a strike. <MdB color={C.danger}>3 strikes → paged off-call.</MdB></MdLI>
        <MdLI>Shift ends on the third strike, or when fewer than 3 fixes remain in the pool.</MdLI>
      </MdOL>

      <MdH2>the board</MdH2>
      <MdUL>
        <MdLI><MdB color={C.accent}>INBOX</MdB> — up to {QUEUE_SIZE} open tickets at a time. A new one rolls in after each resolution.</MdLI>
        <MdLI><MdB color={C.accent}>ACTIVE TICKET</MdB> — the one you're currently solving. Shows requirements, blocked stack, and live preview.</MdLI>
        <MdLI><MdB color={C.accent}>FIX CANDIDATES</MdB> — one per stack, refilled from each stack's pool of {STACK_POOL_SIZE}.</MdLI>
        <MdLI><MdB color={C.accent}>STAGE</MdB> — the staged cherry-picks. Auto-ships at 3.</MdLI>
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
        <MdLI><MdB color={C.danger}>Blocked stack:</MdB> some tickets ban one stack. Touching it taints the entire stage — automatic rejection.</MdLI>
        <MdLI><MdB>Reward multiplier:</MdB> tier-based (<MdCode>×2</MdCode> easy, <MdCode>×4</MdCode> medium, <MdCode>×6</MdCode> incident). Final velocity = stage score × multiplier.</MdLI>
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

      <MdH2>fixes</MdH2>
      <MdUL>
        <MdLI><MdB>Value:</MdB> <MdCode>1</MdCode>–<MdCode>13</MdCode> effort points contributed to the fix's stack.</MdLI>
        <MdLI><MdB color={C.warning}>★ sequence bonus</MdB> (~half of fixes): extra points if the placement condition is met. The fix candidates highlight amber with <MdCode color={C.success}>✓ ready</MdCode> when it would fire on the next pick.</MdLI>
        <MdLI><MdB color={C.danger}>Bugged:</MdB> exactly <MdCode>6</MdCode> per shift (~15% of draws) — scored as <MdCode color={C.danger}>−⌊value/2⌋</MdCode> after placement. Look for the <MdCode color={C.danger}>patch:</MdCode> prefix in the description — it's the soft tell. Bonuses still fire on bugged fixes.</MdLI>
        <MdLI><MdB color={C.danger}>Cherry-picks are final</MdB> — no revert once a fix lands in the stage.</MdLI>
      </MdUL>

      <MdP>Sequence bonus conditions:</MdP>
      <MdUL>
        <MdLI><MdCode color={C.warning}>first placed</MdCode> — fires in slot 1</MdLI>
        <MdLI><MdCode color={C.warning}>last placed</MdCode> — fires in slot 3</MdLI>
        <MdLI><MdCode color={C.warning}>after &lt;stack&gt;</MdCode> — previous slot has that stack</MdLI>
        <MdLI><MdCode color={C.warning}>before &lt;stack&gt;</MdCode> — next slot will have that stack</MdLI>
        <MdLI><MdCode color={C.warning}>with &lt;stack&gt;</MdCode> — any other slot has that stack</MdLI>
      </MdUL>

      <MdH2>legendary fixes</MdH2>
      <MdP>
        Exactly <MdCode>2</MdCode> <MdB color={C.legendary}>legendary fixes</MdB> are seeded into the deck each shift — gold-tinted, attributed to a famous programmer (Linus Torvalds, Ada Lovelace, Grace Hopper, &amp; co). The terminal shows how many remain in the deck so you can plan around them.
      </MdP>
      <MdUL>
        <MdLI>One legendary in your 3-fix stage <MdB color={C.success}>auto-passes</MdB> every requirement and ignores the blocked stack.</MdLI>
        <MdLI>The fix itself contributes <MdCode>0</MdCode> velocity — only the other two normal fixes in the stage add points.</MdLI>
        <MdLI>Never bugged. Never carries a sequence bonus. Combos are suppressed when a legendary is in the stage.</MdLI>
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
      <MdP>Detected on the full 3-fix stage. They stack with sequence bonuses and the multiplier:</MdP>
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
        <MdLI>A combo bonus only counts toward a requirement that has at least one fix invested.</MdLI>
        <MdLI>Stage succeeds iff every requirement passes <MdB>and</MdB> no blocked-stack fix was played.</MdLI>
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
