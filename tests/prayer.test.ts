import { describe, expect, it } from 'vitest'
import { computeTimes, currentAndNext, makeParams, orderedTimes } from '../src/prayer'
import { defaultSettings, normalizeSettings } from '../src/settings'
import type { Settings } from '../src/types'

const USAK = { lat: 38.5, lon: 29.4167 }

const d = (iso: string) => new Date(iso)

/** Bir Date'ı yerel saat diliminde "SS:DD" olarak biçimlendirir. */
const hm = (x: Date) =>
  `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`

const times = (s: Settings, iso: string) => computeTimes(s, USAK, d(iso))

describe('Diyanet / Türkiye hesaplama', () => {
  const s = defaultSettings()

  it('vakitler kronolojik sırada olur', () => {
    const t = times(s, '2026-09-28T12:00:00')
    const seq = [t.imsak, t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha]
    const sorted = [...seq].sort((a, b) => a.getTime() - b.getTime())
    expect(seq.map((x) => x.getTime())).toEqual(sorted.map((x) => x.getTime()))
  })

  it('imsak, sabah vaktinden imsakMinutes kadar öncedir', () => {
    const t = times(s, '2026-09-28T12:00:00')
    const diff = (t.fajr.getTime() - t.imsak.getTime()) / 60_000
    expect(diff).toBe(10)
    expect(s.imsakMinutes).toBe(10)
  })

  it('imsakMinutes değişince imsak kayar ama sabah sabit kalır', () => {
    const base = times(defaultSettings(), '2026-09-28T12:00:00')
    const t = times({ ...defaultSettings(), imsakMinutes: 20 }, '2026-09-28T12:00:00')
    expect(t.fajr.getTime()).toBe(base.fajr.getTime())
    expect((base.imsak.getTime() - t.imsak.getTime()) / 60_000).toBe(10)
  })

  it('öğle vakti güneş meridiyenine denk gelir (Türkiye UTC+3, Uşak 29°Doğu)', () => {
    // Aladhan (method=13, Diyanet) 21-12-2026 Uşak öğle = 13:05. Güneş
    // meridiyen saat dilimi meridyeninden ~1 saat geç gelir, bu yüzden 12 değil 13.
    const winter = times(s, '2026-12-21T12:00:00')
    const summer = times(s, '2026-06-21T12:00:00')
    expect(winter.dhuhr.getHours()).toBe(13)
    expect(summer.dhuhr.getHours()).toBe(13)
  })

  it('yazın gün doğumu sabah aylarından erkendir', () => {
    const jun = times(s, '2026-06-21T12:00:00')
    const dec = times(s, '2026-12-21T12:00:00')
    const dayLength = (t: { sunrise: Date; maghrib: Date }) => t.maghrib.getTime() - t.sunrise.getTime()
    expect(dayLength(jun)).toBeGreaterThan(dayLength(dec))
    expect(jun.sunrise.getHours()).toBeLessThan(dec.sunrise.getHours())
  })

  it('Diyanet metodu Türkiye saatiyle uyumlu değerler üretir', () => {
    // Diyanet 1 Ocak Uşak: imsak ~06:15, sabah ~06:45 (yaklaşık).
    const t = times(s, '2026-01-01T12:00:00')
    expect(hm(t.fajr)).toMatch(/^0[56]:\d\d$/)
    expect(hm(t.isha)).toMatch(/^(17|18|19):\d\d$/)
  })
})

describe('mezhep', () => {
  it('hanefi ikindiyi şafiiye göre daha geç yapar', () => {
    const shafi = times(defaultSettings(), '2026-01-15T12:00:00')
    const hanafi = times({ ...defaultSettings(), madhab: 'hanafi' }, '2026-01-15T12:00:00')
    expect(hanafi.asr.getTime()).toBeGreaterThan(shafi.asr.getTime())
  })
})

describe('metod', () => {
  it('farklı metotlar farklı sabah vakti verir', () => {
    const a = times(defaultSettings(), '2026-03-20T12:00:00')
    const b = times({ ...defaultSettings(), method: 'egyptian' }, '2026-03-20T12:00:00')
    expect(a.fajr.getTime()).not.toBe(b.fajr.getTime())
  })

  it('makeParams seçilen metodu uygular', () => {
    expect(makeParams(defaultSettings(), 38.5, 29.4).fajrAngle).toBe(18)
    expect(makeParams({ ...defaultSettings(), method: 'egyptian' }, 38.5, 29.4).fajrAngle).toBeCloseTo(19.5)
  })
})

describe('kullanıcı ofsetleri', () => {
  it('sabah ofseti yalnızca sabahı kaydırır, imsak onu izler', () => {
    const base = times(defaultSettings(), '2026-09-28T12:00:00')
    const s: Settings = { ...defaultSettings(), offsets: { ...defaultSettings().offsets, fajr: 5 } }
    const t = times(s, '2026-09-28T12:00:00')
    expect((t.fajr.getTime() - base.fajr.getTime()) / 60_000).toBe(5)
    expect((t.imsak.getTime() - base.imsak.getTime()) / 60_000).toBe(5)
  })

  it('akşam ofseti akşam vaktini kaydırır', () => {
    const base = times(defaultSettings(), '2026-09-28T12:00:00')
    const s: Settings = { ...defaultSettings(), offsets: { ...defaultSettings().offsets, maghrib: 7 } }
    const t = times(s, '2026-09-28T12:00:00')
    expect((t.maghrib.getTime() - base.maghrib.getTime()) / 60_000).toBe(7)
  })
})

describe('sıralama ve anlık vakit', () => {
  it('imsak gizlenince listede çıkmaz', () => {
    const t = times(defaultSettings(), '2026-09-28T12:00:00')
    expect(orderedTimes(defaultSettings(), t).map((r) => r.key)).toContain('imsak')
    const hidden = orderedTimes({ ...defaultSettings(), showImsak: false }, t)
    expect(hidden.map((r) => r.key)).not.toContain('imsak')
    expect(hidden).toHaveLength(6)
  })

  it('öğleden hemen önce öğle vaktindeyiz', () => {
    const t = times(defaultSettings(), '2026-09-28T12:00:00')
    const justBeforeDhuhr = new Date(t.dhuhr.getTime() - 60_000)
    const r = currentAndNext(t, true, justBeforeDhuhr)
    expect(r.current).toBe('sunrise')
    const justAfterDhuhr = new Date(t.dhuhr.getTime() + 60_000)
    expect(currentAndNext(t, true, justAfterDhuhr).current).toBe('dhuhr')
  })

  it('vakit tam geldiğinde o vakit seçilir', () => {
    const t = times(defaultSettings(), '2026-09-28T12:00:00')
    expect(currentAndNext(t, true, new Date(t.dhuhr.getTime())).current).toBe('dhuhr')
  })

  it('yatsıdan sonra sıradaki vakit ertesi günün imsakıdır', () => {
    const t = times(defaultSettings(), '2026-09-28T12:00:00')
    const r = currentAndNext(t, true, d('2026-09-28T23:59:00'))
    expect(r.current).toBe('isha')
    expect(r.next).toBe('imsak')
  })
})

describe('ayarların normalleştirilmesi', () => {
  it('bozuk girdide varsayılanlara döner', () => {
    expect(normalizeSettings(null).province).toBe('64')
    expect(normalizeSettings({ method: 'uydurma' }).method).toBe('diyanet')
    expect(normalizeSettings({ theme: 42 }).theme).toBe('glass')
  })

  it('bilinmeyen ilçeyi il merkezine düşürür', () => {
    const s = normalizeSettings({ province: '64', district: 'OlmayanYer' })
    expect(s.province).toBe('64')
    expect(s.district).toBe('Merkez')
  })

  it('opaklık ve yazı ölçeğini sınırlar', () => {
    expect(normalizeSettings({ opacity: 5 }).opacity).toBe(1)
    expect(normalizeSettings({ opacity: 0 }).opacity).toBe(0.35)
    expect(normalizeSettings({ fontScale: 99 }).fontScale).toBe(1.4)
  })

  it('ofsetleri ±30 dakikaya kıstırır', () => {
    expect(normalizeSettings({ offsets: { fajr: 999 } }).offsets.fajr).toBe(30)
    expect(normalizeSettings({ offsets: { fajr: -999 } }).offsets.fajr).toBe(-30)
  })
})
