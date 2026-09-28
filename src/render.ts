import type { DayTimes, ResolvedPlace, Settings } from './types'
import { computeTimes, currentAndNext, formatInTz, localDateKey, orderedTimes } from './prayer'

/** Bir günün vakitlerini verilen saat diliminde hesaplar. */
export function timesForDay(s: Settings, place: ResolvedPlace, date: Date): DayTimes {
  return computeTimes(s, place, date)
}

/** Gece yarısını geçince vakitleri yeniden hesaplar. */
export function needsRecompute(lastKey: string, now: Date): boolean {
  return localDateKey(now) !== lastKey
}

/** Vakit listesini HTML olarak basar. Saatler konumun saat dilimindedir. */
export function timesHtml(s: Settings, t: DayTimes, now: Date, tz: string): string {
  const { current } = currentAndNext(t, s.showImsak, now)
  return orderedTimes(s, t)
    .map((r) => {
      const on = r.key === current
      return `<div class="row${on ? ' now' : ''}">
        <span class="lbl">${r.label}</span>
        <span class="dots"></span>
        <span class="val">${formatInTz(r.at, tz)}</span>
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
