import type { Settings } from './types'

/** Tema değişikliği. Widget sadece data-theme ile yeniden boyanır. */
export function applyTheme(root: HTMLElement, s: Settings): void {
  root.dataset.theme = s.theme
  root.style.setProperty('--opacity', String(s.opacity))
  root.style.setProperty('--scale', String(s.fontScale))
}

export const THEME_CSS = `
:root {
  --r: 14px;
  --gap: 8px;
}
[data-theme='glass'] {
  --bg: rgba(24, 30, 44, 0.72);
  --fg: #f2f5fa;
  --dim: rgba(242, 245, 250, 0.62);
  --line: rgba(255, 255, 255, 0.10);
  --accent: #7fd1c1;
  --now: #ffd479;
  --blur: 16px;
  --border: 1px solid rgba(255,255,255,.14);
  --shadow: 0 10px 30px rgba(0,0,0,.35);
}
[data-theme='night'] {
  --bg: rgba(8, 10, 16, 0.90);
  --fg: #e8ecf5;
  --dim: rgba(232, 236, 245, 0.55);
  --line: rgba(120, 160, 255, 0.16);
  --accent: #8ab4ff;
  --now: #ffcf6b;
  --blur: 0px;
  --border: 1px solid rgba(120,160,255,.22);
  --shadow: 0 0 0 1px rgba(0,0,0,.4);
}
[data-theme='neutral'] {
  --bg: rgba(246, 245, 242, 0.94);
  --fg: #23262b;
  --dim: rgba(35, 38, 43, 0.58);
  --line: rgba(0, 0, 0, 0.10);
  --accent: #3d7d6b;
  --now: #a8621b;
  --blur: 0px;
  --border: 1px solid rgba(0,0,0,.14);
  --shadow: 0 6px 18px rgba(0,0,0,.18);
}
`
