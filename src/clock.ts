import type { ClockStyle, Settings } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** "13:05" / "01:05:42" — 12 veya 24 saat. */
export function formatClock(now: Date, s: Settings): string {
  const h24 = now.getHours()
  const h = s.hour24 ? h24 : ((h24 + 11) % 12) + 1
  const base = pad(h)
  return s.showSeconds ? `${base}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` : `${base}:${pad(now.getMinutes())}`
}

/** 12 saatlik modda "ÖÖ" / "ÖS". */
export function meridiem(now: Date): string {
  return now.getHours() < 12 ? 'ÖÖ' : 'ÖS'
}

/** Hicri tarih — Türkiye resmi takvimi olan Ummü'l-Kurra. */
export function formatHijri(now: Date): string {
  try {
    return new Intl.DateTimeFormat('tr-TR-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    }).format(now)
  } catch {
    return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }).format(now)
  }
}

export function formatGregorian(now: Date): string {
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }).format(now)
}

/**
 * Analog kadranı SVG olarak döndürür. Saniyel ibre yalnızca showSeconds
 * açıkken çizilir; kapalıyken 60 kare/saniye yeniden çizim yapmayalım.
 */
export function analogSvg(now: Date, s: Settings): string {
  const h = ((now.getHours() % 12) + 11.5) / 12
  const m = (now.getMinutes() + now.getSeconds() / 60) / 60
  const sec = now.getSeconds() / 60

  const ticks: string[] = []
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const r1 = i % 3 === 0 ? 40 : 44
    ticks.push(
      `<line x1="${50 + Math.sin(a) * r1}" y1="${50 - Math.cos(a) * r1}" x2="${50 + Math.sin(a) * 47}" y2="${50 - Math.cos(a) * 47}" class="tk"/>`
    )
  }
  const hand = (angle: number, len: number, cls: string, w: number) =>
    `<line x1="50" y1="50" x2="${50 + Math.sin(angle) * len}" y2="${50 - Math.cos(angle) * len}" class="${cls}" stroke-width="${w}"/>`

  return `<svg viewBox="0 0 100 100" class="analog" aria-hidden="true">
    ${ticks.join('')}
    ${hand(h * Math.PI * 2, 26, 'hh', 5)}
    ${hand(m * Math.PI * 2, 38, 'mh', 3.5)}
    ${s.showSeconds ? hand(sec * Math.PI * 2, 44, 'sh', 1.5) : ''}
    <circle cx="50" cy="50" r="2.6" class="pin"/>
  </svg>`
}

export function clockHtml(now: Date, s: Settings): string {
  if (s.clock === 'analog') {
    return `<div class="clock">${analogSvg(now, s)}<div class="digital-sm">${formatClock(now, s)}${s.hour24 ? '' : ` <i>${meridiem(now)}</i>`}</div></div>`
  }
  const h = s.hour24 ? '' : `<i>${meridiem(now)}</i>`
  return `<div class="clock clock-dig"><div class="digital">${formatClock(now, s)}${h}</div></div>`
}

export type { ClockStyle }
