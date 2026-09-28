import type { DayTimes, ResolvedPlace, Settings } from './types'
import { computeTimes, currentAndNext, localDateKey, orderedTimes } from './prayer'

/** Bir günün vakitlerini verilen saat diliminde hesaplar. */
export function timesForDay(s: Settings, place: ResolvedPlace, date: Date): DayTimes {
  return computeTimes(s, place, date)
}

/** Gece yarısını geçince vakitleri yeniden hesaplar. */
export function needsRecompute(lastKey: string, now: Date): boolean {
  return localDateKey(now) !== lastKey
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Vakit listesini HTML olarak basar. */
export function timesHtml(s: Settings, t: DayTimes, now: Date): string {
  const { current } = currentAndNext(t, s.showImsak, now)
  return orderedTimes(s, t)
    .map((r) => {
      const on = r.key === current
      return `<div class="row${on ? ' now' : ''}">
        <span class="lbl">${r.label}</span>
        <span class="dots"></span>
        <span class="val">${pad(r.at.getHours())}:${pad(r.at.getMinutes())}</span>
      </div>`
    })
    .join('')
}

/** Kalan süreyi "2 sa 15 dk" gibi biçimlendirir. */
export function remainingText(target: Date, now: Date): string {
  let ms = target.getTime() - now.getTime()
  if (ms < 0) return '—'
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h} sa ${m} dk`
  return `${m} dk`
}
