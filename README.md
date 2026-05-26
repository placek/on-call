# on-call

**A solo game about DevOps triage.** Tickets land in your inbox. Cherry-pick from your fix candidates. Ship before the pager fires. _So you can keep doing DevOps after you've finished doing DevOps — because clearly one shift a day wasn't enough._

## quick start

1. Pick a ticket from the **inbox** — each demands one or two stack thresholds (e.g. `db ≥ 7` or `db ≥ 5` + `api ≥ 5`).
2. Read your fix candidates — they appear as `git log -4 fix-candidates --oneline`, one per stack.
3. Tap a candidate to **cherry-pick** it into the stage. The **3rd pick auto-ships** — every requirement must clear its threshold.
4. Successful stages earn **velocity**. Failed stages cost a strike. **3 strikes → paged off-call.**
5. Shift ends on the third strike, or when fewer than 3 fixes remain in the pool.

## the board

- **INBOX** — up to 3 open tickets at a time. A new one rolls in after each resolution.
- **ACTIVE TICKET** — the one you're currently solving. Shows requirements, blocked stack, and live preview.
- **FIX CANDIDATES** — one per stack, refilled from each stack's pool of 10.
- **STAGE** — the staged cherry-picks. Auto-ships at 3.
- **DONE** — closed tickets. Click any to inspect its diff and outcome.

## stacks

Four disciplines. Each fix lives on exactly one stack:

- `api` — Backend
- `db` — Database
- `ui` — Frontend
- `ops` — Infra

## tickets

- **Requirements:** single-stack (must beat one threshold) or dual-stack (both must beat their own threshold independently).
- **Blocked stack:** some tickets ban one stack. Touching it taints the entire stage — automatic rejection.
- **Reward multiplier:** tier-based (`×2` easy, `×4` medium, `×6` incident). Final velocity = stage score × multiplier.
- Tickets get harder as your `resolved` count climbs — more dual-stack, more incidents, creeping thresholds (capped at `+2`).

## priority & skip penalty

Severity is `prio-1` (most urgent), `prio-2`, `prio-3`. You may close them in any order — but resolving `prio-n` while a stricter `prio-m` (`m < n`) sits in the inbox deducts `−((3 − m) × 3 + n − m) × (resolved ticket's multiplier)` velocity per skipped ticket. The multiplier scaling means cheap closes feel cheap and great closes still pay — but ducking a prio-1 for a cushy prio-3 stings.

- Skip a `prio-1` to close a `prio-3` (×2) → `−16`
- Skip a `prio-1` to close a `prio-2` (×4) → `−28`
- Skip a `prio-2` to close a `prio-3` (×2) → `−8`

## fixes

- **Value:** `1`–`13` effort points contributed to the fix's stack.
- **★ sequence bonus** (~half of fixes): extra points if the placement condition is met. The fix candidates highlight amber with `✓ ready` when it would fire on the next pick.
- **Bugged:** exactly `6` per shift (~15% of draws) — scored as `−⌊value/2⌋` after placement. Look for the `patch:` prefix in the description — it's the soft tell. Bonuses still fire on bugged fixes.
- **Cherry-picks are final** — no revert once a fix lands in the stage.

Sequence bonus conditions:

- `first placed` — fires in slot 1
- `last placed` — fires in slot 3
- `after <stack>` — previous slot has that stack
- `before <stack>` — next slot will have that stack
- `with <stack>` — any other slot has that stack

## legendary fixes

Exactly `2` **legendary fixes** are seeded into the deck each shift — gold-tinted, attributed to a famous programmer (Linus Torvalds, Ada Lovelace, Grace Hopper, & co). The terminal shows how many remain in the deck so you can plan around them.

- One legendary in your 3-fix stage **auto-passes** every requirement and ignores the blocked stack.
- The fix itself contributes `0` velocity — only the other two normal fixes in the stage add points.
- Never bugged. Never carries a sequence bonus. Combos are suppressed when a legendary is in the stage.
- Skip penalty still applies — they rescue a ticket but don't rewrite which ticket you chose.

_Burn them on an impossible blocked-stack incident, or save them for a prio-1 you'd otherwise have to skip. Three legendaries in a row clears a ticket for zero velocity — sometimes that's still the right call._

## mercy

Drop to your last strike on a rejection and the very next inbox ticket arrives with a **MERCY** tag: tier drops by one, no blocked stack. Single-shot anti-snowball — it doesn't trigger twice in a row.

## combo bonuses

Detected on the full 3-fix stage. They stack with sequence bonuses and the multiplier:

- `STACK_MATCH` — All three fixes on a required stack **+8**
- `VERSION_MATCH` — Three fixes of the same effort value **+10**
- `PATCH_CHAIN` — Three consecutive effort values **+5**
- `MULTI_COVER` — A fix invested in every required stack (dual-stack only) **+4**
- `HOTFIX` — Includes a senior fix (value 13) **+2**

## scoring

- Each requirement passes iff `stack sum + sequence bonuses + applicable combo ≥ threshold`.
- A combo bonus only counts toward a requirement that has at least one fix invested.
- Stage succeeds iff every requirement passes **and** no blocked-stack fix was played.
- On success: `+velocity = total score × ticket multiplier`. Then subtract any skip penalty.
- On failure: no velocity, lose a strike, skip penalty still applies.
