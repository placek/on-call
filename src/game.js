export const STACKS = {
  api: { name: 'API', label: 'Backend',  color: '#58a6ff' },
  db:  { name: 'DB',  label: 'Database', color: '#bc8cff' },
  ui:  { name: 'UI',  label: 'Frontend', color: '#f778ba' },
  ops: { name: 'OPS', label: 'Infra',    color: '#f0883e' },
};

export const STACK_KEYS = Object.keys(STACKS);

// Per-stack pool size — how many placements you get from each stack per shift.
export const STACK_POOL_SIZE = 10;

// Inbox cap — number of open tickets visible at any time.
export const QUEUE_SIZE = 3;

// Sequence bonuses added to the required-stack score on a stage.
export const COMBO_DEFS = [
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
    desc: 'A fix invested in every required stack',
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
