import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes,
  Rounding,
} from 'adhan'
import { type DayTimes, type MethodKey, type Offsets, type Settings } from './types'

const METHOD_FACTORY: Record<MethodKey, () => CalculationParameters> = {
  diyanet: () => CalculationMethod.Turkey(),
  moonsighting: () => CalculationMethod.MoonsightingCommittee(),
  mwl: () => CalculationMethod.MuslimWorldLeague(),
  egyptian: () => CalculationMethod.Egyptian(),
  karachi: () => CalculationMethod.Karachi(),
  ummalqura: () => CalculationMethod.UmmAlQura(),
  kuwait: () => CalculationMethod.Kuwait(),
}

const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000)

/** Ayar metoduna göre hesaplama parametrelerini üretir. */
export function makeParams(s: Settings, lat: number, lon: number): CalculationParameters {
  const p = METHOD_FACTORY[s.method]()

  p.madhab = s.madhab === Madhab.Hanafi ? Madhab.Hanafi : Madhab.Shafi
  p.highLatitudeRule = HighLatitudeRule.recommended(new Coordinates(lat, lon))
  if (s.highLat !== 'auto') p.highLatitudeRule = s.highLat
  // Türkiye saat dilimi sabit +03 olduğundan yuvarlama hataları gün içinde
  // birikmesin; en yakın dakikaya yuvarlıyoruz.
  p.rounding = Rounding.Nearest
  p.polarCircleResolution = PolarCircleResolution.Unresolved

  for (const k of Object.keys(p.adjustments) as (keyof Offsets)[]) {
    p.adjustments[k] = s.offsets[k] ?? 0
  }
  return p
}

/**
 * Bir günün vakitlerini hesaplar. `date` gün içindeki an değil, günün
 * kendisidir — adhan tarihe göre gün sınırını kullanır.
 */
export function computeTimes(s: Settings, place: { lat: number; lon: number }, date: Date): DayTimes {
  const t = new PrayerTimes(new Coordinates(place.lat, place.lon), date, makeParams(s, place.lat, place.lon))
  return {
    dateKey: localDateKey(date),
    imsak: addMinutes(t.fajr, -s.imsakMinutes),
    fajr: t.fajr,
    sunrise: t.sunrise,
    dhuhr: t.dhuhr,
    asr: t.asr,
    maghrib: t.maghrib,
    isha: t.isha,
  }
}

/** Gösterilecek vakit sırası. */
export type PrayerRow = { key: PrayerRowKey; label: string; at: Date }
export type PrayerRowKey = 'imsak' | 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

const ROWS: { key: PrayerRowKey; label: string; pick: (t: DayTimes) => Date }[] = [
  { key: 'imsak', label: 'İmsak', pick: (t) => t.imsak },
  { key: 'fajr', label: 'Sabah', pick: (t) => t.fajr },
  { key: 'sunrise', label: 'Güneş Doğumu', pick: (t) => t.sunrise },
  { key: 'dhuhr', label: 'Öğle', pick: (t) => t.dhuhr },
  { key: 'asr', label: 'İkindi', pick: (t) => t.asr },
  { key: 'maghrib', label: 'Akşam', pick: (t) => t.maghrib },
  { key: 'isha', label: 'Yatsı', pick: (t) => t.isha },
]

export function orderedTimes(s: Settings, t: DayTimes): PrayerRow[] {
  return ROWS.filter((r) => r.key !== 'imsak' || s.showImsak).map((r) => ({ key: r.key, label: r.label, at: r.pick(t) }))
}

/** Şu an içinde bulunulan vakit ve sıradaki vakit. */
export function currentAndNext(t: DayTimes, showImsak: boolean, now: Date) {
  const rows = ROWS.filter((r) => showImsak || r.key !== 'imsak')
  const ms = now.getTime()

  let current: PrayerRowKey | null = null
  let next: PrayerRowKey | null = null
  for (const r of rows) {
    if (r.pick(t).getTime() <= ms) current = r.key
    else if (next === null) next = r.key
  }
  // Günün son vakti geçtiyse sıradaki vakit ertesi günün ilk vaktidir.
  if (next === null) next = rows[0]?.key ?? 'fajr'

  return {
    current,
    currentLabel: rows.find((r) => r.key === current)?.label ?? '—',
    next,
    nextLabel: rows.find((r) => r.key === next)?.label ?? '—',
  }
}

/** Yerel tarihi YYYY-MM-DD yapar. */
export function localDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

