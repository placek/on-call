export const FONTS_CSS = `
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

export const C = {
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
