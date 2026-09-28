import { THEME_CSS } from './themes'

const css = `${THEME_CSS}
* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: transparent;
  overflow: hidden;
  user-select: none;
  -webkit-font-smoothing: antialiased;
}

#root {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  padding: 12px 14px;
  font-size: calc(13px * var(--scale));
  color: var(--fg);
  background: var(--bg);
  border: var(--border);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  backdrop-filter: blur(var(--blur));
}

#drag { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.head-l { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
#place { font-weight: 600; font-size: 1.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dim { color: var(--dim); font-size: 0.85em; }

.clock { flex: none; display: flex; align-items: center; gap: 6px; }
.analog { width: 52px; height: 52px; }
.analog .tk { stroke: var(--dim); stroke-width: 1; stroke-linecap: round; }
.analog .hh { stroke: var(--fg); stroke-linecap: round; }
.analog .mh { stroke: var(--fg); stroke-linecap: round; }
.analog .sh { stroke: var(--now); stroke-linecap: round; }
.analog .pin { fill: var(--now); }
.digital-sm { font-variant-numeric: tabular-nums; font-size: 0.95em; font-weight: 600; }
.digital { font-variant-numeric: tabular-nums; font-size: 1.7em; font-weight: 300; letter-spacing: 0.02em; }
.digital i, .digital-sm i { font-style: normal; font-size: 0.5em; color: var(--dim); margin-left: 3px; }

#nowbox { text-align: center; padding: 4px 0 2px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.now-lbl { font-size: 0.72em; letter-spacing: 0.09em; text-transform: uppercase; color: var(--dim); }
#now { font-size: 1.6em; font-weight: 600; color: var(--now); line-height: 1.25; }
#next b { display: block; font-weight: 600; color: var(--fg); font-variant-numeric: tabular-nums; }

#times { display: flex; flex-direction: column; gap: 2px; }
.row { display: flex; align-items: baseline; gap: 6px; }
.row .lbl { flex: none; color: var(--dim); }
.row .dots { flex: 1 1 auto; border-bottom: 1px dotted var(--line); transform: translateY(-3px); }
.row .val { flex: none; font-variant-numeric: tabular-nums; font-weight: 600; }
.row.now .lbl, .row.now .val { color: var(--accent); }
`

const style = document.createElement('style')
style.textContent = css
document.head.appendChild(style)
