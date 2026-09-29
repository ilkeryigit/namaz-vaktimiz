import { DEFAULT_DISTRICT, DEFAULT_PROVINCE, findDistrict, findProvince } from './location'
import { IMSAK_DEFAULT_MINUTES, type DisplayMode, type Offsets, type Settings } from './types'

export function defaultSettings(): Settings {
  return {
    country: 'TR',
    province: DEFAULT_PROVINCE,
    district: DEFAULT_DISTRICT,
    worldName: '',
    worldLat: 0,
    worldLon: 0,
    worldTz: 'Europe/Istanbul',

    method: 'diyanet',
    madhab: 'shafi',
    highLat: 'auto',
    offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
    imsakMinutes: IMSAK_DEFAULT_MINUTES,

    showImsak: true,
    theme: 'glass',
    clock: 'analog',
    showSeconds: true,
    hour24: true,

    displayMode: 'top',
    pinned: false,
    autostart: false,
    opacity: 0.95,
    fontScale: 1,
    online: 'off',
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v as string) ? (v as T) : fallback

const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const

/**
 * Eski sürümlerde `alwaysOnTop` vardı: false idiyse pencere erişilemez
 * hâle geliyordu (görev çubuğunda yok, üstte de değil). Bu yüzden yanlış
 * seçim masaüstüne çevrilir, doğru seçim yeni karşılığına taşınır.
 */
function resolveDisplayMode(p: Record<string, unknown>, fallback: DisplayMode): DisplayMode {
  if (p.displayMode !== undefined) {
    return oneOf(p.displayMode, ['desktop', 'top', 'tray'] as const, fallback)
  }
  if (typeof p.alwaysOnTop === 'boolean') return p.alwaysOnTop ? 'top' : 'desktop'
  return fallback
}

/**
 * Bozuk/eksik ayar dosyasını güvenli hale getirir. Kullanıcının elindeki
 * eski sürüm ayarları yeni alanları yoksayabilir; burada doldurulur.
 */
export function normalizeSettings(partial: unknown): Settings {
  const d = defaultSettings()
  if (!partial || typeof partial !== 'object') return d
  const p = partial as Record<string, unknown>

  const province = String(p.province ?? d.province)
  const prov = findProvince(province) ?? findProvince(DEFAULT_PROVINCE)!
  const district = String(p.district ?? '')
  const dist = findDistrict(prov, district) ?? prov.districts.find((x) => x.name === DEFAULT_DISTRICT) ?? prov.districts[0]!

  const rawOffsets = (p.offsets ?? {}) as Record<string, unknown>
  const offsets = {} as Offsets
  for (const k of PRAYER_KEYS) {
    offsets[k] = clamp(Math.round(num(rawOffsets[k], d.offsets[k])), -30, 30)
  }

  return {
    country: p.country === 'WLD' ? 'WLD' : 'TR',
    province: prov.code,
    district: dist.name,
    worldName: String(p.worldName ?? ''),
    worldLat: clamp(num(p.worldLat, 0), -90, 90),
    worldLon: clamp(num(p.worldLon, 0), -180, 180),
    worldTz: String(p.worldTz ?? d.worldTz),

    method: oneOf(p.method, ['diyanet', 'moonsighting', 'mwl', 'egyptian', 'karachi', 'ummalqura', 'kuwait'] as const, d.method),
    madhab: oneOf(p.madhab, ['shafi', 'hanafi'] as const, d.madhab),
    highLat: oneOf(p.highLat, ['auto', 'middleofthenight', 'seventhofthenight', 'twilightangle'] as const, d.highLat),
    offsets,
    imsakMinutes: clamp(Math.round(num(p.imsakMinutes, d.imsakMinutes)), 0, 60),

    showImsak: bool(p.showImsak, d.showImsak),
    theme: oneOf(p.theme, ['glass', 'night', 'neutral'] as const, d.theme),
    clock: oneOf(p.clock, ['analog', 'digital'] as const, d.clock),
    showSeconds: bool(p.showSeconds, d.showSeconds),
    hour24: bool(p.hour24, d.hour24),

    displayMode: resolveDisplayMode(p, d.displayMode),
    pinned: bool(p.pinned, d.pinned),
    autostart: bool(p.autostart, d.autostart),
    opacity: clamp(num(p.opacity, d.opacity), 0.35, 1),
    fontScale: clamp(num(p.fontScale, d.fontScale), 0.8, 1.4),
    online: p.online === 'aladhan' ? 'aladhan' : 'off',
  }
}
