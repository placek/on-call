# on-call

**A solo card game about DevOps triage.** Tickets land in your inbox. Cherry-pick fixes from your hand. Ship before the pager fires. _So you can keep doing DevOps after you've finished doing DevOps — because clearly one shift a day wasn't enough._

## quick start

1. Pick a ticket from the **inbox** — each demands one or two stack thresholds (e.g. `db ≥ 7` or `db ≥ 5` + `api ≥ 5`).
2. Read your candidate fixes — they appear as `git log -4 fix-candidates --oneline`, one per stack.
3. Tap a candidate to **cherry-pick** it into the deploy. The **3rd pick auto-ships** — every requirement must clear its threshold.
4. Successful deploys earn **velocity**. Failed deploys cost a strike. **3 strikes → paged off-call.**
5. Shift ends on the third strike, or when fewer than 3 fixes remain in the pool.

## the board

- **INBOX** — up to 3 open tickets at a time. A new one rolls in after each resolution.
- **ACTIVE TICKET** — the one you're currently solving. Shows requirements, blocked stack, and live preview.
- **HAND** — one candidate fix per stack, refilled from each stack's pool of 12.
- **DEPLOY** — the staged cherry-picks. Auto-ships at 3.
- **DONE** — closed tickets. Click any to inspect its diff and outcome.

## stacks

Four disciplines. Each fix lives on exactly one stack:

- `api` — Backend
- `db` — Database
- `ui` — Frontend
- `ops` — Infra

## tickets

- **Requirements:** single-stack (must beat one threshold) or dual-stack (both must beat their own threshold independently).
- **Blocked stack:** some tickets ban one stack. Touching it taints the entire deploy — automatic rejection.
- **Reward multiplier:** tier-based (`×2` easy, `×4` medium, `×6` incident). Final velocity = deploy score × multiplier.
- Tickets get harder as your `resolved` count climbs — more dual-stack, more incidents, creeping thresholds.

## priority & skip penalty

Severity is `prio-1` (most urgent), `prio-2`, `prio-3`. You may close them in any order — but resolving `prio-n` while a stricter `prio-m` (`m < n`) sits in the inbox deducts `−((3 − m) × 3 + n − m)` velocity per skipped ticket. Penalties stack.

- Skip a `prio-1` to close a `prio-3` → `−8`
- Skip a `prio-1` to close a `prio-2` → `−7`
- Skip a `prio-2` to close a `prio-3` → `−4`

## fix cards

- **Value:** `1`–`13` effort points contributed to the card's stack.
- **★ sequence bonus** (~half of cards): extra points if the placement condition is met. The hand highlights amber with `✓ ready` when it would fire on the next pick.
- **Bugged (~18%):** looks normal in hand, scored as `−⌊value/2⌋` after placement. Bonuses still fire on bugged cards.
- **Cherry-picks are final** — no revert once a card lands in the deploy.

Sequence bonus conditions:

- `first placed` — fires in slot 1
- `last placed` — fires in slot 3
- `after <stack>` — previous slot has that stack
- `before <stack>` — next slot will have that stack
- `with <stack>` — any other slot has that stack

## combo bonuses

Detected on the full 3-card deploy. They stack with sequence bonuses and the multiplier:

- `STACK_MATCH` — All three fixes on a required stack **+5**
- `VERSION_MATCH` — Three fixes of the same effort value **+5**
- `PATCH_CHAIN` — Three consecutive effort values **+3**
- `HOTFIX` — Includes a senior fix (value 13) **+2**

## scoring

- Each requirement passes iff `stack sum + sequence bonuses + applicable combo ≥ threshold`.
- A combo bonus only counts toward a requirement that has at least one card invested.
- Deploy succeeds iff every requirement passes **and** no blocked-stack card was played.
- On success: `+velocity = total score × ticket multiplier`. Then subtract any skip penalty.
- On failure: no velocity, lose a strike, skip penalty still applies.
