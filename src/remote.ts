import type { DayTimes, ResolvedPlace, Settings } from './types'

/**
 * Aladhan metod numaraları. Uzak doğrulama yalnızca Diyanet için
 * anlamlı: kullanıcı yerelde başka bir metot seçtiyse doğrulama
 * yapılmaz, çünkü iki farklı yöntemin farkını "doğrulama" diye
 * sunmak yanıltıcı olurdu.
 */
const ALADHAN_METHOD: Record<string, number> = { diyanet: 13 }
const ALADHAN_SCHOOL: Record<string, number> = { shafi: 0, hanafi: 1 }

export function canVerifyOnline(s: Settings): boolean {
  return s.online === 'aladhan' && ALADHAN_METHOD[s.method] !== undefined
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** Belirtilen saat diliminde o anki UTC ofseti (dakika). */
function tzOffsetMinutes(utc: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const q = Object.fromEntries(dtf.formatToParts(utc).map((p) => [p.type, p.value]))
  const asUTC = Date.UTC(+q.year!, +q.month! - 1, +q.day!, +q.hour! % 24, +q.minute!, +q.second!)
  return (asUTC - utc.getTime()) / 60_000
}

/** "2026-12-21" + "13:05" + tz -> Date. İki turda yakınsar. */
export function zonedToUtc(dateKey: string, hhmm: string, tz: string): Date {
  const [y, mo, da] = dateKey.split('-').map(Number) as [number, number, number]
  const [h, mi] = hhmm.split(':').map(Number) as [number, number]
  const naive = Date.UTC(y, mo - 1, da, h, mi)
  let guess = naive - tzOffsetMinutes(new Date(naive), tz) * 60_000
  guess = naive - tzOffsetMinutes(new Date(guess), tz) * 60_000
  return new Date(guess)
}

export interface RemoteTimings {
  fajr: Date
  sunrise: Date
  dhuhr: Date
  asr: Date
  maghrib: Date
  isha: Date
  tz: string
}

/** Aladhan'dan günün vakitlerini çeker. Hata durumunda null döner. */
export async function fetchAladhan(
  place: ResolvedPlace,
  dateKey: string,
  s: Settings,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000
): Promise<RemoteTimings | null> {
  const method = ALADHAN_METHOD[s.method]
  if (method === undefined) return null

  const [dd, mm, yyyy] = dateKey.split('-')
  const url =
    `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}` +
    `?latitude=${place.lat}&longitude=${place.lon}` +
    `&method=${method}&school=${ALADHAN_SCHOOL[s.madhab] ?? 0}`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { timings?: Record<string, string>; meta?: { timezone?: string } }
    }
    const t = json.data?.timings
    if (!t) return null
    const tz = json.data?.meta?.timezone ?? place.tz
    const read = (key: string) => t[key]?.split(' ')[0] ?? ''
    return {
      fajr: zonedToUtc(dateKey, read('Fajr'), tz),
      sunrise: zonedToUtc(dateKey, read('Sunrise'), tz),
      dhuhr: zonedToUtc(dateKey, read('Dhuhr'), tz),
      asr: zonedToUtc(dateKey, read('Asr'), tz),
      maghrib: zonedToUtc(dateKey, read('Maghrib'), tz),
      isha: zonedToUtc(dateKey, read('Isha'), tz),
      tz,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Uzak vakitleri ayarlardaki ofsetleri uygulayarak yerel biçime çevirir. */
export function applyRemote(r: RemoteTimings, s: Settings, dateKey: string): DayTimes {
  const add = (d: Date, m: number) => new Date(d.getTime() + m * 60_000)
  return {
    dateKey,
    imsak: add(r.fajr, s.offsets.fajr - s.imsakMinutes),
    fajr: add(r.fajr, s.offsets.fajr),
    sunrise: add(r.sunrise, s.offsets.sunrise),
    dhuhr: add(r.dhuhr, s.offsets.dhuhr),
    asr: add(r.asr, s.offsets.asr),
    maghrib: add(r.maghrib, s.offsets.maghrib),
    isha: add(r.isha, s.offsets.isha),
  }
}

/** Yerel ve uzak hesap arasındaki en büyük fark (dakika). Doğrulama için. */
export function maxDiffMinutes(a: DayTimes, b: DayTimes): number {
  const keys: (keyof DayTimes)[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
  return Math.max(
    ...keys.map((k) => Math.abs(new Date(a[k] as Date).getTime() - new Date(b[k] as Date).getTime()) / 60_000)
  )
}

export { p2 }
