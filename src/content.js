// ─────────────────────────────────────────────────────────────────────────────
//  Content catalog — every string that's rolled at runtime.
//
//  Edit freely: nothing here affects mechanics, only flavor and variety.
//
//  Shapes:
//   - FIXES[stack][value-1]  → array of { description, context } variants.
//                              One is sampled per card draw, so the same
//                              (stack, value) pair can read differently
//                              between draws.
//   - TICKET_POOL            → flat list of { title, from, note, tier }
//                              with tier ∈ {1, 2, 3}. rollTicket() filters
//                              by tier.
//   - HOST_WORDS / HOST_TLDS / HOST_SPLITS → tokens combined into the
//                              fake hostname shown in the terminal header.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  FIXES — indexed by effort value 1..13.
//  Small (1-4) = trivial; medium (5-9) = real work; large (10-13) = scary.
// ─────────────────────────────────────────────────────────────────────────────

export const FIXES = {
  api: [
    // value 1
    [
      { description: 'Patch typo in error response',     context: 'cosmetic; logs read cleaner' },
      { description: 'Fix off-by-one in pagination',     context: 'last page returned empty' },
      { description: 'Correct HTTP status on 404 route', context: 'was returning 500 by mistake' },
      { description: 'Remove dead /healthz alias',       context: 'duplicated /health for years' },
    ],
    // value 2
    [
      { description: 'Bump axios to 1.6.2',              context: 'closes CVE-2024-1234' },
      { description: 'Bump express patch version',       context: 'dependabot has been nagging' },
      { description: 'Upgrade pino to latest',           context: 'silences deprecation noise' },
      { description: 'Replace deprecated body-parser',   context: 'inlined into express now' },
    ],
    // value 3
    [
      { description: 'Add structured log line',          context: 'improves observability' },
      { description: 'Add trace ID propagation',         context: 'jaeger spans were orphaned' },
      { description: 'Tag metrics with route name',      context: 'grafana dashboards finally split' },
      { description: 'Emit deploy version on boot',      context: 'easier rollback diagnostics' },
    ],
    // value 4
    [
      { description: 'Add request timeout',              context: 'no more hung requests' },
      { description: 'Drop oversized payloads early',    context: 'rejects > 5MB at the edge' },
      { description: 'Add ETag on /products',            context: 'cache hit rate +18%' },
      { description: 'Return 429 with Retry-After',      context: 'clients can back off properly' },
    ],
    // value 5
    [
      { description: 'Add input validation',             context: 'rejects bad payloads early' },
      { description: 'Adopt zod schemas at handlers',    context: 'replaces ad-hoc type checks' },
      { description: 'Normalize email on signup',        context: 'mixed-case dupes cleared' },
      { description: 'Enforce uuid format on IDs',       context: 'stops malformed lookups' },
    ],
    // value 6
    [
      { description: 'Fix N+1 query in /orders',         context: 'expected p99: −300ms' },
      { description: 'Batch downstream calls',           context: 'cut webhook fanout 4×' },
      { description: 'Cache /me responses for 30s',      context: 'auth check load halves' },
      { description: 'Eager-load related entities',      context: 'no more lazy round trips' },
    ],
    // value 7
    [
      { description: 'Add idempotency keys',             context: 'safe to retry now' },
      { description: 'Add request deduplication',        context: 'webhook storms tamed' },
      { description: 'Persist outbox events',            context: 'no more lost notifications' },
      { description: 'Add optimistic locking on rows',   context: 'concurrent writes settle' },
    ],
    // value 8
    [
      { description: 'Add rate-limit middleware',        context: 'blocks abusive clients' },
      { description: 'Switch to token-bucket limiter',   context: 'smooths burst spikes' },
      { description: 'Per-tenant API quotas',            context: 'noisy neighbor fix' },
      { description: 'Add bot fingerprinting',           context: 'cuts scraping volume by half' },
    ],
    // value 9
    [
      { description: 'Refactor auth middleware',         context: 'touches every route' },
      { description: 'Centralize permission checks',     context: 'replaces 14 scattered guards' },
      { description: 'Move sessions to Redis',           context: 'sticky LBs no longer needed' },
      { description: 'Add JWT key rotation',             context: 'security wanted it months ago' },
    ],
    // value 10
    [
      { description: 'Wrap calls in circuit breaker',    context: 'isolates downstream failures' },
      { description: 'Add bulkhead pools for clients',   context: 'one bad dep stops cascading' },
      { description: 'Replace retries with hedging',     context: 'tail latency drops sharply' },
      { description: 'Adopt graceful shutdown',          context: 'in-flight requests finish clean' },
    ],
    // value 11
    [
      { description: 'Migrate handlers to async',        context: 'needs worker count bump' },
      { description: 'Move blocking I/O off main loop',  context: 'CPU profile finally clean' },
      { description: 'Adopt streaming responses',        context: 'memory footprint −60%' },
      { description: 'Switch JSON parser to simdjson',   context: 'measured 3× throughput' },
    ],
    // value 12
    [
      { description: 'Roll out new pagination API',      context: 'deprecates v1; comms ready' },
      { description: 'Cut v1 → v2 over feature flag',    context: 'staged 5/25/100% ramp' },
      { description: 'Introduce GraphQL gateway',        context: 'replaces 6 REST aggregators' },
      { description: 'Standardize error envelopes',      context: 'every client SDK updates' },
    ],
    // value 13
    [
      { description: 'Rewrite OrderService module',      context: 'high risk; large blast radius' },
      { description: 'Re-architect billing pipeline',    context: 'two weeks, one engineer' },
      { description: 'Replace monolith auth with OIDC',  context: 'every team has to migrate' },
      { description: 'Shard the events table by tenant', context: 'no rollback once written' },
    ],
  ],

  db: [
    // value 1
    [
      { description: 'Fix migration 042 typo',           context: 'comment-only, but blocks CI' },
      { description: 'Drop unused legacy column',        context: 'last written to in 2019' },
      { description: 'Rename misspelled index',          context: 'was off by one letter' },
      { description: 'Annotate FK with ON DELETE',       context: 'docs-only metadata' },
    ],
    // value 2
    [
      { description: 'Refresh table statistics',         context: 'planner gets fresh data' },
      { description: 'Run ANALYZE on hot tables',        context: 'wrong index was being chosen' },
      { description: 'Bump default_statistics_target',   context: 'better histograms on joins' },
      { description: 'Pin search_path on roles',         context: 'avoids surprise table shadowing' },
    ],
    // value 3
    [
      { description: 'VACUUM ANALYZE orders',            context: 'reclaims dead tuples' },
      { description: 'Reindex bloated PK',               context: 'index 40% wasted bytes' },
      { description: 'Truncate stale audit_log',         context: 'archived to S3 last week' },
      { description: 'Compact toast storage',            context: 'large BLOB churn' },
    ],
    // value 4
    [
      { description: 'CREATE INDEX on user_id',          context: 'fast lookups by user' },
      { description: 'Add partial index on active rows', context: 'cuts hot path scan cost' },
      { description: 'Add GIN index on tags array',      context: 'tag search was sequential' },
      { description: 'Drop redundant duplicate index',   context: 'two indexes did the same thing' },
    ],
    // value 5
    [
      { description: 'Add foreign key on orders.user_id',context: 'enforces referential integrity' },
      { description: 'Add CHECK constraint on status',   context: 'invalid states stop sneaking in' },
      { description: 'Enforce NOT NULL on email',        context: 'legacy nulls already backfilled' },
      { description: 'Add UNIQUE on (tenant, slug)',     context: 'dedupe race condition closed' },
    ],
    // value 6
    [
      { description: 'Bump connection pool to 50',       context: 'addresses pool exhaustion' },
      { description: 'Switch to pgbouncer transaction',  context: 'idle connection blowup' },
      { description: 'Tune statement_timeout',           context: 'rogue query took the db down' },
      { description: 'Cap idle_in_transaction',          context: 'orphan transactions cleared' },
    ],
    // value 7
    [
      { description: 'Tune autovacuum thresholds',       context: 'reduces table bloat' },
      { description: 'Per-table autovacuum tuning',      context: 'hot tables get aggressive runs' },
      { description: 'Raise maintenance_work_mem',       context: 'index builds finally fit' },
      { description: 'Tune checkpoint_timeout',          context: 'smoother WAL pressure' },
    ],
    // value 8
    [
      { description: 'Add covering index',               context: 'eliminates table lookups' },
      { description: 'Add expression index on lower()',  context: 'case-insensitive search fix' },
      { description: 'Add BRIN on time-series tables',   context: 'space-efficient for ranges' },
      { description: 'Convert btree to hash where ok',   context: 'equality-only lookups gain' },
    ],
    // value 9
    [
      { description: 'Optimize JOIN ordering',           context: 'saves a sequential scan' },
      { description: 'Rewrite correlated subquery',      context: 'planner picks hash join now' },
      { description: 'Add CTE materialization hints',    context: 'execution plan stabilizes' },
      { description: 'Push filters below the JOIN',      context: 'row count drops 10×' },
    ],
    // value 10
    [
      { description: 'Rewrite materialized view',        context: 'rebuild takes ~30 min' },
      { description: 'Switch to incremental refresh',    context: 'no more nightly full rebuild' },
      { description: 'Denormalize hot aggregates',       context: 'reports run in seconds' },
      { description: 'Build summary tables via triggers',context: 'aggregates kept warm' },
    ],
    // value 11
    [
      { description: 'Partition orders by month',        context: 'scan volume drops 10×' },
      { description: 'Partition events by tenant_id',    context: 'noisy tenant isolated' },
      { description: 'Migrate to declarative partitions',context: 'replaces trigger-based scheme' },
      { description: 'Roll partitions monthly via cron', context: 'no more end-of-month panic' },
    ],
    // value 12
    [
      { description: 'Spin up read replica',             context: 'needs ops coordination' },
      { description: 'Add cross-region replica',         context: 'reads served closer to users' },
      { description: 'Route reports to replica pool',    context: 'primary load drops sharply' },
      { description: 'Stand up logical replication',     context: 'enables zero-downtime move' },
    ],
    // value 13
    [
      { description: 'Migrate Postgres 14 → 16',         context: 'scheduled maintenance window' },
      { description: 'Re-shard cluster by tenant',       context: 'all-hands deploy weekend' },
      { description: 'Cut over to Aurora replica',       context: 'no rollback after promotion' },
      { description: 'Replace ORM with raw queries',     context: 'every callsite gets touched' },
    ],
  ],

  ui: [
    // value 1
    [
      { description: 'Fix favicon for Safari',           context: 'Safari ignores .ico files' },
      { description: 'Tweak hover color on links',       context: 'failed WCAG AA contrast' },
      { description: 'Hide empty state when loading',    context: 'flicker reported on mobile' },
      { description: 'Capitalize CTA consistently',      context: 'designer noticed in a screenshot' },
    ],
    // value 2
    [
      { description: 'Update CTA button copy',           context: 'marketing asked twice' },
      { description: 'Fix tooltip arrow positioning',    context: 'mis-aligned in Firefox' },
      { description: 'Trim trailing whitespace in toast',context: 'looked sloppy' },
      { description: 'Show currency symbol with locale', context: 'EU users saw $ on €' },
    ],
    // value 3
    [
      { description: 'Adjust card padding',              context: 'designer flagged it' },
      { description: 'Tighten icon-button hit areas',    context: 'fitted to design tokens' },
      { description: 'Switch to fluid type scale',       context: 'remembered to ship the spec' },
      { description: 'Rebalance grid gutters',           context: 'finally matches Figma' },
    ],
    // value 4
    [
      { description: 'Fix mobile alignment',             context: 'iPhone SE specifically' },
      { description: 'Wrap long titles on small screens',context: 'overflow clipped the heading' },
      { description: 'Stack form fields below 480px',    context: 'side-by-side was unusable' },
      { description: 'Fix viewport meta tag',            context: 'zoom was disabled by accident' },
    ],
    // value 5
    [
      { description: 'Add aria-label to icons',          context: 'a11y audit blocker' },
      { description: 'Announce live region updates',     context: 'screen readers were silent' },
      { description: 'Add skip-to-content link',         context: 'keyboard users asked for it' },
      { description: 'Improve form error semantics',     context: 'aria-describedby everywhere' },
    ],
    // value 6
    [
      { description: 'Restore focus ring',               context: 'regressed last release' },
      { description: 'Trap focus in modal dialogs',      context: 'tab escaped into background' },
      { description: 'Return focus on dialog close',     context: 'kept landing on body' },
      { description: 'Make focus outline visible on dark',context: 'invisible in dark mode' },
    ],
    // value 7
    [
      { description: 'Patch keyboard nav',               context: 'Tab order was broken' },
      { description: 'Add keyboard shortcuts for actions',context: 'power users have been begging' },
      { description: 'Fix arrow-key nav in dropdown',    context: 'wrapped on the wrong axis' },
      { description: 'Make table sortable via keyboard', context: 'mouse-only was a blocker' },
    ],
    // value 8
    [
      { description: 'Add toast notifications',          context: 'users want save feedback' },
      { description: 'Inline form validation messages',  context: 'replaces alert() popups' },
      { description: 'Implement undo for destructive',   context: 'support tickets disappear' },
      { description: 'Add optimistic UI for likes',      context: 'feels instant now' },
    ],
    // value 9
    [
      { description: 'Add loading skeletons',            context: 'perceived perf win' },
      { description: 'Stream above-the-fold first',      context: 'cuts LCP by 800ms' },
      { description: 'Prefetch next-page assets',        context: 'navigation feels instant' },
      { description: 'Inline critical CSS',              context: 'no more flash of unstyled content' },
    ],
    // value 10
    [
      { description: 'Memoize heavy table rows',         context: 'drops 60→144fps on scroll' },
      { description: 'Virtualize the long list view',    context: 'memory drops dramatically' },
      { description: 'Move heavy work to a worker',      context: 'main thread breathes again' },
      { description: 'Code-split the admin panel',       context: 'main bundle −180KB' },
    ],
    // value 11
    [
      { description: 'Refactor checkout form',           context: 'long-standing tech debt' },
      { description: 'Rebuild calendar component',       context: 'replaces 6 forks of the same' },
      { description: 'Adopt design tokens everywhere',   context: 'no more magic colors' },
      { description: 'Migrate state to RTK Query',       context: 'sprawled reducers consolidated' },
    ],
    // value 12
    [
      { description: 'Implement i18n (5 locales)',       context: 'blocks EU launch' },
      { description: 'Add RTL layout support',           context: 'mirrors entire chrome' },
      { description: 'Refactor router for nested routes',context: 'multi-week migration' },
      { description: 'Move to typed forms framework',    context: 'eliminates a class of bugs' },
    ],
    // value 13
    [
      { description: 'Migrate to React 19',              context: 'feature freeze: one sprint' },
      { description: 'Move legacy app off jQuery',       context: 'concurrent refactor and ship' },
      { description: 'Rewrite design system in v2',      context: 'every component reviewed' },
      { description: 'Adopt server components',          context: 'rendering pipeline rewrite' },
    ],
  ],

  ops: [
    // value 1
    [
      { description: 'Pin node version in CI',           context: 'stops flaky builds' },
      { description: 'Fix wrong region in terraform',    context: 'plan was a no-op for weeks' },
      { description: 'Correct cron string typo',         context: 'ran daily instead of hourly' },
      { description: 'Disable deprecated build step',    context: 'log noise only' },
    ],
    // value 2
    [
      { description: 'Update DNS A record',              context: 'propagation: ~5 min' },
      { description: 'Add MX records for new domain',    context: 'email was bouncing' },
      { description: 'Lower TTL ahead of migration',     context: 'faster cutover window' },
      { description: 'Add CAA record for cert authority',context: 'security baseline ask' },
    ],
    // value 3
    [
      { description: 'Restart stuck pod',                context: 'kubectl delete pod' },
      { description: 'Drain noisy node',                 context: 'reschedule to fresh hardware' },
      { description: 'Clear cached image layer',         context: 'pull errors on cold start' },
      { description: 'Reseat the runner agent',          context: 'lost contact with control plane' },
    ],
    // value 4
    [
      { description: 'Bump container image',             context: 'rolling restart, zero downtime' },
      { description: 'Switch to distroless base',        context: 'image −60% smaller' },
      { description: 'Cache build layers properly',      context: 'CI time cut in half' },
      { description: 'Multi-arch image build',           context: 'arm runners worked overnight' },
    ],
    // value 5
    [
      { description: 'Rotate TLS certs',                 context: 'expires in 14 days' },
      { description: 'Renew internal CA cert',           context: 'service-mesh trust chain' },
      { description: 'Enable automatic cert renewal',    context: 'no more midnight pages' },
      { description: 'Swap to ACME DNS-01 challenge',    context: 'wildcards finally renewable' },
    ],
    // value 6
    [
      { description: 'Raise memory limit',               context: 'OOMKilled twice today' },
      { description: 'Set sane CPU requests',            context: 'noisy neighbors stopped' },
      { description: 'Reserve disk for ephemeral logs',  context: 'pods stopped getting evicted' },
      { description: 'Tune JVM heap caps',               context: 'GC pauses smoothed out' },
    ],
    // value 7
    [
      { description: 'Tune logrotate',                   context: '/var is at 94%' },
      { description: 'Ship logs to central pipeline',    context: 'kills local disk pressure' },
      { description: 'Sample DEBUG in prod',             context: 'index volume −40%' },
      { description: 'Add JSON log format on workers',   context: 'queryable from day one' },
    ],
    // value 8
    [
      { description: 'Wire up Prometheus alerts',        context: 'closes a monitoring gap' },
      { description: 'Add SLO burn-rate alerts',         context: 'replaces flapping thresholds' },
      { description: 'Route alerts via pagerduty',       context: 'no more email-only pages' },
      { description: 'Add synthetic checks for checkout',context: 'catches issues before users do' },
    ],
    // value 9
    [
      { description: 'Add HPA autoscaling',              context: 'traffic spikes are predictable' },
      { description: 'Predictive scale on cron',         context: 'morning peak handled clean' },
      { description: 'Pre-warm workers before campaign', context: 'cold starts caused timeouts' },
      { description: 'Move workloads onto spot fleet',   context: 'compute spend −35%' },
    ],
    // value 10
    [
      { description: 'Configure WAF rules',              context: 'security team approval needed' },
      { description: 'Enable bot management ruleset',    context: 'replaces in-house heuristics' },
      { description: 'Add geo-fencing for admin paths',  context: 'reduces attack surface' },
      { description: 'Roll out mTLS between services',   context: 'all callsites must update' },
    ],
    // value 11
    [
      { description: 'Write runbook for outage',         context: 'juniors must be able to follow' },
      { description: 'Wire up automated postmortems',    context: 'incident bot drafts the doc' },
      { description: 'Run gameday for failover',         context: 'discovered three latent bugs' },
      { description: 'Document service ownership map',   context: 'no more "who owns this?"' },
    ],
    // value 12
    [
      { description: 'Add canary deploy stage',          context: '5% traffic for 10 min' },
      { description: 'Adopt progressive delivery flags', context: 'every release becomes a ramp' },
      { description: 'Implement blue/green for the API', context: 'instant rollback path' },
      { description: 'Automate cross-region failover',   context: 'no more manual DNS surgery' },
    ],
    // value 13
    [
      { description: 'Migrate to new k8s cluster',       context: 'weekend maintenance window' },
      { description: 'Cut over to new VPC topology',     context: 'every service gets re-IP\'d' },
      { description: 'Multi-region active/active',       context: 'three-week incident risk' },
      { description: 'Replace CI/CD platform end-to-end',context: 'every pipeline rewritten' },
    ],
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  TICKET_POOL — sampled by tier in rollTicket().
// ─────────────────────────────────────────────────────────────────────────────

export const TICKET_POOL = [
  // ── tier 1 ── easy wins, no incidents ──
  { title: 'Login button misaligned on mobile',          from: 'Customer Success', note: 'Three reports in this morning. Quick win?',         tier: 1 },
  { title: 'Stale cache on /products endpoint',          from: 'Junior Dev',       note: 'Pretty sure it\'s just a TTL config thing.',         tier: 1 },
  { title: 'Background worker failing silently',         from: 'SRE',              note: 'No alerts, just missing rows in the analytics tbl.', tier: 1 },
  { title: 'Dashboard timezone bug',                     from: 'Product',          note: 'European users see yesterday\'s data.',              tier: 1 },
  { title: 'Slow query on /api/orders',                  from: 'Eng Manager',      note: 'p99 jumped from 80ms to 1.4s overnight.',            tier: 1 },
  { title: 'Health check returns 200 when DB is down',   from: 'SRE',              note: 'Load balancer keeps routing traffic to dead nodes.', tier: 1 },
  { title: 'Logs filling up /var partition',             from: 'On-Call',          note: 'Box at 94% disk. Logrotate is misconfigured.',       tier: 1 },
  { title: 'Email service intermittently flaky',         from: 'Support',          note: 'SendGrid retries usually catch it but it\'s ugly.',  tier: 1 },
  { title: 'CSV export missing UTF-8 BOM',               from: 'Finance',          note: 'Excel mangles every non-ASCII row.',                 tier: 1 },
  { title: 'Robots.txt blocks the marketing site',       from: 'Marketing',        note: 'Crawlers gave up. We are invisible to Google.',      tier: 1 },
  { title: 'Sentry quota exhausted by noisy warn',       from: 'On-Call',          note: 'One log line is 80% of our events. Silence it.',     tier: 1 },
  { title: 'Webhook signatures not verified',            from: 'Security',         note: 'We accept payloads from anyone. Embarrassing.',      tier: 1 },
  { title: 'Stripe test keys committed to repo',         from: 'Security',         note: 'Test only, but rotate anyway. Junior is mortified.', tier: 1 },
  { title: 'Cron task running in wrong timezone',        from: 'Data Eng',         note: 'Daily report lands 6 hours early.',                  tier: 1 },
  { title: 'README points to deleted page',              from: 'New Hire',         note: 'First-day setup confusion. Tiny fix, big delight.',  tier: 1 },
  { title: 'Profile pictures load over HTTP',            from: 'Security',         note: 'Mixed-content warnings everywhere.',                 tier: 1 },
  { title: 'Pagination shows 11 items instead of 10',    from: 'QA',               note: 'Off-by-one on the offset.',                          tier: 1 },
  { title: 'Search treats accents as different chars',   from: 'Product',          note: '"cafe" and "café" should match. They don\'t.',       tier: 1 },
  { title: 'Help link 404s after recent rename',         from: 'Support',          note: 'Customer-facing dead link for two weeks.',           tier: 1 },
  { title: '/favicon.ico spammed in error logs',         from: 'On-Call',          note: 'Pure noise, drowns out real signal.',                tier: 1 },
  { title: 'Form autocomplete disabled by mistake',      from: 'Customer Success', note: 'Users complaining they have to retype passwords.',   tier: 1 },
  { title: 'Slack alert message has broken markdown',    from: 'On-Call',          note: 'Channel reads like a ransom note.',                  tier: 1 },
  { title: '"Export to PDF" silently exports DOCX',      from: 'Support',          note: 'Last refactor swapped the wrong constant.',          tier: 1 },
  { title: 'Onboarding email links point to staging',    from: 'Marketing',        note: 'New users land on test data. Embarrassing.',         tier: 1 },
  { title: 'CSS classes leak across feature flags',      from: 'QA',               note: 'A/B variant styles bleed into control.',             tier: 1 },
  { title: 'API returns 200 with HTML error page',       from: 'Mobile Lead',      note: 'Parser crashes thinking it got JSON.',               tier: 1 },
  { title: 'Empty cart still ships a confirmation email',from: 'Customer Success', note: 'Customer asked "what did I order?"',                 tier: 1 },
  { title: 'Date picker offsets by one day in Brazil',   from: 'Product',          note: 'DST-adjacent timezone weirdness.',                   tier: 1 },
  { title: 'Linter rule disabled across the codebase',   from: 'Eng Manager',      note: 'Someone --no-verify\'d their way out of it.',        tier: 1 },
  { title: 'Internal admin tool slow on tabs',           from: 'CS Operations',    note: 'Renders all panels eagerly. Annoying, not urgent.',  tier: 1 },
  { title: 'Locale fallback chain skips zh-Hant',        from: 'Localization',     note: 'Taiwan users see simplified strings.',               tier: 1 },
  { title: 'Outdated copyright year in footer',          from: 'Marketing',        note: 'Forgot to update on Jan 1. Still says 2023.',        tier: 1 },

  // ── tier 2 ── real work, restrictions appear ──
  { title: 'Payment webhooks dropping randomly',         from: 'Finance',          note: 'Reconciliation off by $4k yesterday. Investigate.',  tier: 2 },
  { title: 'Auth tokens expiring early',                 from: 'Security',         note: 'JWT exp is 24h but users see logouts at ~6h.',       tier: 2 },
  { title: 'Memory leak in checkout service',            from: 'SRE',              note: 'OOMs every ~36h. Need patch by Friday.',             tier: 2 },
  { title: 'Cron job runs twice in production',          from: 'Data Eng',         note: 'Duplicate invoices last night. Idempotency missing.',tier: 2 },
  { title: 'Search index falling out of sync',           from: 'Product',          note: 'New products take ~2h to appear. Should be instant.',tier: 2 },
  { title: 'Mobile app crash on payment screen',         from: 'Mobile Lead',      note: 'Reproduces on Android 14 only. Stack trace attached.',tier: 2 },
  { title: 'Race condition on signup creates dup users', from: 'Eng Manager',      note: 'Spike of duplicates after the marketing push.',      tier: 2 },
  { title: 'Notification fan-out chokes during sales',   from: 'SRE',              note: 'Queue lag hits 40 minutes at peak.',                 tier: 2 },
  { title: 'Cache stampede on cold cache',               from: 'SRE',              note: 'When Redis evicts, the DB melts for 30s.',           tier: 2 },
  { title: 'Service mesh dropping idle connections',     from: 'Platform',         note: 'gRPC clients keep reconnecting in a loop.',          tier: 2 },
  { title: 'Background job retries DDoS the search API', from: 'SRE',              note: 'No backoff. Workers retry every 5s forever.',        tier: 2 },
  { title: 'New SDK release ships broken types',         from: 'Developer Rel',    note: 'TypeScript users can\'t install the latest.',        tier: 2 },
  { title: 'Feature flag eval inconsistent across pods', from: 'Platform',         note: 'Same user, different experience each refresh.',      tier: 2 },
  { title: 'Order status webhook out of order',          from: 'Partners',         note: '"shipped" arriving before "paid". Confusing partners.',tier: 2 },
  { title: 'Permissions cache stale after role change',  from: 'Security',         note: 'Users keep old permissions for up to 10 minutes.',   tier: 2 },
  { title: 'p99 latency spike correlates with deploys',  from: 'SRE',              note: 'Looks like cold caches or DI warmup.',               tier: 2 },
  { title: 'GraphQL N+1 in admin dashboard',             from: 'Eng Manager',      note: 'Loading the org page makes 400 queries.',            tier: 2 },
  { title: 'iOS users hit the email regex too strictly', from: 'Mobile Lead',      note: 'Legit Gmail+suffix addresses rejected.',             tier: 2 },
  { title: 'Refunds task occasionally double-credits',   from: 'Finance',          note: 'No idempotency key on the refund path.',             tier: 2 },
  { title: 'Sessions persist after password reset',      from: 'Security',         note: 'Tokens remain valid until natural expiry.',          tier: 2 },
  { title: 'Slow ramp on canary causes user-visible 5xx',from: 'SRE',              note: 'New version isn\'t graceful with in-flight reqs.',  tier: 2 },
  { title: 'Webhook delivery loses payloads on restart', from: 'Platform',         note: 'In-memory queue. No durable retry.',                 tier: 2 },
  { title: 'CDN purge skips one shard sporadically',     from: 'Platform',         note: 'Stale assets served from one edge POP.',             tier: 2 },
  { title: 'Mobile app silently retries failed uploads', from: 'Mobile Lead',      note: 'Eats user data plans. No user feedback either.',     tier: 2 },
  { title: 'Customer data export over-fetches PII',      from: 'Privacy',          note: 'Includes fields we promised to omit.',               tier: 2 },
  { title: 'Search relevance regressed after reindex',   from: 'Product',          note: 'Boost weights got reset to defaults.',               tier: 2 },
  { title: 'Saga compensations not running on failure',  from: 'Platform',         note: 'Half-applied transactions linger.',                  tier: 2 },
  { title: 'A/B test contaminates control via cookies',  from: 'Data Eng',         note: 'Statistical results are unusable until fixed.',      tier: 2 },

  // ── tier 3 ── critical incidents ──
  { title: 'PROD OUTAGE: EU region returning 503s',      from: 'CTO',              note: 'Half our European traffic is down. Fix this NOW.',   tier: 3 },
  { title: 'GDPR audit deadline tomorrow',               from: 'Legal',            note: 'User export endpoint must work flawlessly by 9am.',  tier: 3 },
  { title: 'Database replication lag at 4 minutes',      from: 'SRE',              note: 'Reads are stale. We\'re bleeding consistency bugs.', tier: 3 },
  { title: 'Auth breach attempt detected',               from: 'Security',         note: 'Active credential stuffing. Mitigate immediately.',  tier: 3 },
  { title: 'Checkout flow returning 500 site-wide',      from: 'CTO',              note: 'Revenue ticking down in real time. ALL HANDS.',      tier: 3 },
  { title: 'Customer DB connection pool fully saturated',from: 'SRE',              note: 'No new logins succeeding. Pager is on fire.',        tier: 3 },
  { title: 'PCI scanner just flagged a cleartext field', from: 'Compliance',       note: 'Card data not properly tokenized. 24h to remediate.',tier: 3 },
  { title: 'CEO\'s laptop session token leaked publicly',from: 'Security',         note: 'Posted to a public gist. Revoke and rotate.',        tier: 3 },
  { title: 'Production secrets exposed in error log',    from: 'Security',         note: 'Stack trace dumped DB creds to Datadog.',            tier: 3 },
  { title: 'Background workers deleting wrong rows',     from: 'CTO',              note: 'Missing WHERE clause in production. STOP THE BLEED.',tier: 3 },
  { title: 'Billing job double-charged 4k customers',    from: 'Finance',          note: 'Refunds + comms must go out within the hour.',       tier: 3 },
  { title: 'Mobile app force-quits on launch',           from: 'Mobile Lead',      note: 'Bad config push. Every active user hit.',            tier: 3 },
  { title: 'Search corruption: ranking returns garbage', from: 'Product',          note: 'Index regenerated with broken analyzer.',            tier: 3 },
  { title: 'Cross-tenant data leak in API response',     from: 'Privacy',          note: 'Customer saw another customer\'s order. WAR ROOM.',  tier: 3 },
  { title: 'Failover to DR region failed silently',      from: 'SRE',              note: 'Primary dead, DR cold. Manual revival in progress.', tier: 3 },
  { title: 'Cert expired on internal mTLS pair',         from: 'Platform',         note: 'Half the service mesh refuses connections.',         tier: 3 },
  { title: 'Live stream of payments writes to /dev/null',from: 'Finance',          note: 'No transactions persisted in the last 22 minutes.',  tier: 3 },
  { title: 'Stale DNS sends users to a parked domain',   from: 'CTO',              note: 'Migrating registrars went sideways. Brand visible.', tier: 3 },
  { title: 'Identity provider rate-limited us globally', from: 'Security',         note: 'Logins worldwide stalled. SSO down.',                tier: 3 },
  { title: 'Backup integrity check failed for 3 weeks',  from: 'SRE',              note: 'No verified recovery point. Investigate while live.',tier: 3 },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Fake hostnames — composed from these tokens.
// ─────────────────────────────────────────────────────────────────────────────

export const HOST_WORDS = [
  // original set
  'sock', 'shop', 'peanut', 'cabinet', 'kernel', 'daemon', 'socket', 'pipe',
  'fork', 'panic', 'ping', 'pong', 'foo', 'bar', 'baz', 'quux', 'crab', 'owl',
  'milk', 'salt', 'tea', 'gnu', 'vim', 'tmux', 'hack', 'build', 'deploy',
  'sync', 'queue', 'stack', 'heap', 'leaf', 'node', 'root', 'kebab', 'taco',
  'pickle', 'mango', 'wombat', 'gopher', 'badger', 'koala', 'modem', 'cron',
  'tarball', 'rune', 'whisper', 'shadow', 'banana', 'noodle', 'parrot',
  'pretzel', 'biscuit', 'walrus', 'otter', 'turnip',
  // tech-flavored additions
  'mutex', 'lambda', 'thunk', 'shard', 'proxy', 'gateway', 'broker', 'agent',
  'worker', 'router', 'beacon', 'sentinel', 'oracle', 'vault', 'forge', 'anvil',
  'cobalt', 'quartz', 'onyx', 'opal', 'flint', 'amber', 'jade', 'pearl',
  'pixel', 'bitmap', 'cursor', 'buffer', 'cache', 'chunk', 'frame', 'glyph',
  // food-flavored additions
  'waffle', 'donut', 'pretz', 'cracker', 'crouton', 'pancake', 'crepe',
  'sushi', 'ramen', 'tofu', 'wasabi', 'miso', 'curry', 'paneer', 'falafel',
  'gnocchi', 'risotto', 'fondue', 'tapas', 'churro', 'cookie', 'muffin',
  // critter-flavored additions
  'platypus', 'numbat', 'quokka', 'pangolin', 'lemur', 'capybara', 'manatee',
  'narwhal', 'puffin', 'mantis', 'newt', 'gecko', 'iguana', 'tapir', 'sloth',
  'meerkat', 'aardvark', 'okapi', 'ferret', 'weasel', 'marmot', 'wallaby',
  // verb/state flavor
  'whirl', 'simmer', 'jitter', 'wobble', 'wiggle', 'scribble', 'mumble',
  'grumble', 'fizzle', 'crinkle', 'crumble', 'fumble', 'rumble', 'tumble',
];

export const HOST_TLDS = [
  // original
  'com', 'net', 'dev', 'io', 'org', 'sh', 'er', 'prod', 'lan', 'local',
  'ai', 'app', 'inc', 'co', 'ws', 'log', 'sys', 'box',
  // additions
  'cluster', 'svc', 'mesh', 'edge', 'cdn', 'k8s', 'corp', 'eng', 'ops', 'sec',
  'dc', 'pod', 'ns', 'zone', 'region',
];

// ─────────────────────────────────────────────────────────────────────────────
//  PROGRAMMERS — authors stamped on legendary fix cards. Sampled in
//  generateCard(); the chosen entry's `signature` becomes the card's
//  description, and `name` is shown as the author byline. Nothing here
//  affects scoring — it's all flavor.
// ─────────────────────────────────────────────────────────────────────────────

export const PROGRAMMERS = [
  { name: 'Linus Torvalds',     signature: 'another perfectly fine rebase'              },
  { name: 'Ada Lovelace',       signature: 'designed the algorithm before the machine'   },
  { name: 'Grace Hopper',       signature: 'compiled what others said could not compile' },
  { name: 'Alan Turing',        signature: 'decided the undecidable, twice'              },
  { name: 'Donald Knuth',       signature: 'art of programming · vol 4, ch 7'            },
  { name: 'Dennis Ritchie',     signature: 'K&R idiom makes this trivial'                },
  { name: 'Brian Kernighan',    signature: 'two pages of awk · problem solved'           },
  { name: 'Ken Thompson',       signature: '/* you are not expected to understand this */'},
  { name: 'Edsger Dijkstra',    signature: 'GOTO considered harmful · removed'           },
  { name: 'Margaret Hamilton',  signature: 'guidance code landed it on the first try'    },
  { name: 'John Carmack',       signature: '0x5f3759df · what the fuck?'                 },
  { name: 'Bjarne Stroustrup',  signature: 'added one template · problem disappeared'    },
  { name: 'Guido van Rossum',   signature: 'there is one obvious way to do it'           },
  { name: 'Anders Hejlsberg',   signature: 'narrowed every type until the bug vanished'  },
  { name: 'James Gosling',      signature: 'wrote once · ran everywhere'                 },
  { name: 'Yukihiro Matsumoto', signature: 'made the programmer happy first'             },
  { name: 'Larry Wall',         signature: 'TMTOWTDI · picked the elegant one'           },
  { name: 'Rasmus Lerdorf',     signature: 'shipped a personal home page in an afternoon'},
  { name: 'Tim Berners-Lee',    signature: 'hyperlinked the failing service back to life'},
  { name: 'Vint Cerf',          signature: 'TCP retried until it worked'                 },
  { name: 'Brendan Eich',       signature: 'ten days · one language · zero blockers'     },
  { name: 'Barbara Liskov',     signature: 'substituted the base class · all green'      },
  { name: 'Richard Stallman',   signature: 'GPL\'d the fix · no take-backs'              },
  { name: 'Niklaus Wirth',      signature: 'algorithms + data structures = programs'     },
  { name: 'Tony Hoare',         signature: 'introduced quicksort to your bottleneck'     },
];

export const HOST_SPLITS = [
  // original
  'de|bug|er', 'in|tern|et', 'sys|tem|d', 'pro|gram|er', 'com|put|er',
  'web|ser|ver', 'net|work|s', 'da|ta|base', 'over|flow|ed', 'pro|cess|or',
  'pa|ck|et', 'fire|wall|s', 'pay|load|s', 'ren|der|er',
  // additions
  'check|sum|er', 'time|stamp|s', 'rate|limit|ed', 'load|balanc|er',
  'mes|sage|s', 'side|car|s', 'ser|vice|d', 'mid|dle|ware',
  'pipe|line|s', 'work|flow|s', 'pull|requ|est', 'merg|e|d',
  'feat|ure|d', 'roll|out|s', 'roll|back|s', 'au|to|scal',
  'health|chec|k', 'stor|age|d', 'syn|the|tic', 'tele|met|ry',
];
