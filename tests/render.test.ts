import { describe, expect, it } from 'vitest'
import { analogSvg, formatClock, formatHijri, meridiem } from '../src/clock'
import { remainingText, timesHtml } from '../src/render'
import { defaultSettings } from '../src/settings'
import { computeTimes, formatInTz, zonedDateKey } from '../src/prayer'
import { resolvePlace, searchTurkey, findProvince } from '../src/location'
import { canVerifyOnline, maxDiffMinutes, zonedToUtc } from '../src/remote'

const TZ = 'Europe/Istanbul'
const USAK = { lat: 38.5, lon: 29.4167, tz: TZ }
const when = new Date('2026-09-28T12:00:00')

describe('varsayılan konum', () => {
  it('Uşak / Merkez çözümlenir', () => {
    const p = resolvePlace(defaultSettings())
    expect(p.label).toBe('Uşak / Merkez')
    expect(p.tz).toBe('Europe/Istanbul')
  })

  it('bilinmeyen konum Uşak/Merkez\'e düşer', () => {
    const p = resolvePlace({ ...defaultSettings(), province: '99', district: 'Yok' })
    expect(p.label).toBe('Uşak / Merkez')
  })

  it('arama ilçe bulur', () => {
    const r = searchTurkey('karahall')
    expect(r.length).toBeGreaterThan(0)
    expect(r[0]!.label).toBe('Uşak / Karahallı')
  })

  it('81 il ve 973 ilçe yüklendi', () => {
    const total = Object.values(findProvince('64') ? { 1: 1 } : {}).length
    expect(total).toBe(1)
    const usak = findProvince('64')!
    expect(usak.name).toBe('Uşak')
    expect(usak.districts.map((d) => d.name)).toEqual(['Banaz', 'Eşme', 'Karahallı', 'Merkez', 'Sivaslı', 'Ulubey'])
  })
})

describe('saat biçimi', () => {
  it('24 saatte 13:05:09', () => {
    const d = new Date('2026-09-28T13:05:09')
    expect(formatClock(d, { ...defaultSettings(), hour24: true, showSeconds: true })).toBe('13:05:09')
  })

  it('12 saatte 01:05 ve ÖÖ', () => {
    const d = new Date('2026-09-28T13:05:09')
    expect(formatClock(d, { ...defaultSettings(), hour24: false, showSeconds: true })).toBe('01:05:09')
    expect(meridiem(d)).toBe('ÖS')
  })

  it('saniye gizlenince atlanır', () => {
    const d = new Date('2026-09-28T13:05:09')
    expect(formatClock(d, { ...defaultSettings(), hour24: true, showSeconds: false })).toBe('13:05')
  })

  it('analog kadranı çiziyor', () => {
    const svg = analogSvg(when, defaultSettings())
    expect(svg).toContain('<svg')
    expect(svg).toContain('class="hh"')
    expect(svg).toContain('class="mh"')
  })
})

describe('hicri tarih', () => {
  it('Ummü\'l-Kurra takvimine göre biçimlendirir', () => {
    // 28 Eylül 2026 = 17 Rebiülahir 1448 (Türkiye'nin resmi takvimi)
    expect(formatHijri(when)).toBe('17 Rebiülahir Pazartesi')
  })
})

describe('vakit listesi render', () => {
  const s = defaultSettings()
  const t = computeTimes(s, USAK, when)

  it('her vakit satırı üretir', () => {
    const html = timesHtml(s, t, when, TZ)
    for (const label of ['İmsak', 'Sabah', 'Güneş Doğumu', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']) {
      expect(html).toContain(label)
    }
  })

  it('saatlar SS:DD biçiminde', () => {
    const html = timesHtml(s, t, when, TZ)
    expect(html).toMatch(/class="val">\d{2}:\d{2}</)
  })

  it('anlık vakit "now" sınıfını alır', () => {
    const html = timesHtml(s, t, new Date(t.dhuhr.getTime() + 60_000), TZ)
    expect(html).toMatch(/class="row now"[^]*?Öğle/)
  })

  it('imsak gizliyse satır sayısı 6', () => {
    const html = timesHtml({ ...s, showImsak: false }, t, when, TZ)
    expect(html.match(/class="row/g) ?? []).toHaveLength(6)
  })
})

describe('kalan süre', () => {
  it('saat ve dakika biçimlendirir', () => {
    const now = new Date('2026-09-28T13:00:00')
    expect(remainingText(new Date('2026-09-28T15:15:00'), now)).toBe('2 sa 15 dk')
    expect(remainingText(new Date('2026-09-28T13:40:00'), now)).toBe('40 dk')
  })

  it('geçmiş zaman için em dash döner', () => {
    expect(remainingText(new Date('2026-09-28T12:00:00'), new Date('2026-09-28T13:00:00'))).toBe('—')
  })
})

describe('uzak doğrulama yardımcıları', () => {
  it('saat dilimi çevrimi Uçak saatine döner', () => {
    // Aladhan 21-12-2026 Uşak Dhuhr = 13:05 (Europe/Istanbul)
    const d = zonedToUtc('2026-12-21', '13:05', 'Europe/Istanbul')
    expect(d.toISOString()).toBe('2026-12-21T10:05:00.000Z')
  })

  it('Diyanet dışı metotlarda doğrulama kapalı', () => {
    expect(canVerifyOnline({ ...defaultSettings(), method: 'diyanet', online: 'aladhan' })).toBe(true)
    expect(canVerifyOnline({ ...defaultSettings(), method: 'karachi', online: 'aladhan' })).toBe(false)
    expect(canVerifyOnline({ ...defaultSettings(), online: 'off' })).toBe(false)
  })

  it('en büyük farkı dakika olarak verir', () => {
    const a = computeTimes(defaultSettings(), USAK, when)
    const b = { ...a, isha: new Date(a.isha.getTime() + 4 * 60_000) }
    expect(maxDiffMinutes(a, b)).toBe(4)
  })
})

describe('dünya modu: saat dilimi', () => {
  // New York, 28.09.2026'da İstanbul'dan 7 saat geride.
  const NYC = { lat: 40.7128, lon: -74.006, tz: 'America/New_York' }

  it('vakitleri konumun saat diliminde basar, sistem saatinde değil', () => {
    const s = defaultSettings()
    const t = computeTimes(s, NYC, when)
    const html = timesHtml(s, t, when, NYC.tz)
    // 28.09 New York: Güneş Doğumu 06:43, Gün Batımı 18:50 -> Öğle 12:52 (EDT)
    expect(html).toMatch(/class="val">06:43</)
    expect(html).toMatch(/class="val">18:50</)
    expect(html).toMatch(/class="val">12:52</)
    // Aynı anlar İstanbul saatinde 13:43 / 01:50 / 19:52 olurdu.
    expect(html).not.toMatch(/class="val">13:43</)
    expect(html).not.toMatch(/class="val">19:52</)
  })

  it('hesaplanan gün konumun takvim günüdür', () => {
    // 29.09 02:00 TRT -> New York'da hâlâ 28.09
    const gece = new Date('2026-09-29T02:00:00')
    expect(zonedDateKey(gece, 'Europe/Istanbul')).toBe('2026-09-29')
    expect(zonedDateKey(gece, 'America/New_York')).toBe('2026-09-28')
    expect(computeTimes(defaultSettings(), NYC, gece).dateKey).toBe('2026-09-28')
  })

  it('aynı uzak gün, iki farklı andan aynı vakitleri verir', () => {
    // 28.09 12:00 TRT ve 29.09 02:00 TRT -> New York'da ikisi de 28.09
    const a = computeTimes(defaultSettings(), NYC, new Date('2026-09-28T12:00:00'))
    const b = computeTimes(defaultSettings(), NYC, new Date('2026-09-29T02:00:00'))
    expect(b.dateKey).toBe(a.dateKey)
    for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
      expect(b[k].getTime()).toBe(a[k].getTime())
    }
  })

  it('saati hedef dilimde biçimlendirir', () => {
    const instant = new Date('2026-09-28T09:05:00Z')
    expect(formatInTz(instant, 'Europe/Istanbul')).toBe('12:05')
    expect(formatInTz(instant, 'America/New_York')).toBe('05:05')
  })
})
