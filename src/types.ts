export type CountryCode = 'TR' | 'WLD'

export type MethodKey = 'diyanet' | 'moonsighting' | 'mwl' | 'egyptian' | 'karachi' | 'ummalqura' | 'kuwait'
export type MadhabKey = 'shafi' | 'hanafi'
export type HighLatKey = 'auto' | 'middleofthenight' | 'seventhofthenight' | 'twilightangle'
export type ThemeName = 'glass' | 'night' | 'neutral'
export type ClockStyle = 'analog' | 'digital'
export type OnlineSource = 'off' | 'aladhan'

/** Pencere nasıl görünür: masaüstünde, her şeyin üstünde, ya da yalnız tepsi. */
export type DisplayMode = 'desktop' | 'top' | 'tray'

export const DISPLAY_MODES: { key: DisplayMode; label: string; note: string }[] = [
  { key: 'desktop', label: 'Masaüstünde', note: 'Normal pencere gibi — görev çubuğunda bulunur' },
  { key: 'top', label: 'Her zaman üstte', note: 'Bütün pencerelerin üstünde kalır' },
  { key: 'tray', label: 'Sadece tepsi', note: 'Yalnız sistem tepsisine tıklanınca görünür' },
]

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

export type Offsets = Record<PrayerKey, number>

export interface Settings {
  country: CountryCode
  /** TR için plaka kodu ("64"), dünya için 'WLD' */
  province: string
  district: string
  /** Dünya seçimi için; TR'de boş */
  worldName: string
  worldLat: number
  worldLon: number
  worldTz: string

  method: MethodKey
  madhab: MadhabKey
  highLat: HighLatKey
  /** Her vakti ayrı ayrı kaydırır (dakika). */
  offsets: Offsets
  /** İmsak = Sabah − imsakMinutes */
  imsakMinutes: number

  showImsak: boolean
  theme: ThemeName
  clock: ClockStyle
  showSeconds: boolean
  hour24: boolean

  displayMode: DisplayMode
  /** Sabitlenince pencere bulunduğu yerde durur, sürüklenemez. */
  pinned: boolean
  autostart: boolean
  opacity: number
  fontScale: number
  online: OnlineSource
}

export interface ResolvedPlace {
  label: string
  lat: number
  lon: number
  tz: string
  province: string
  district: string
}

export interface DayTimes {
  /** Europe/Istanbul ya da seçilen tz'de YYYY-MM-DD */
  dateKey: string
  imsak: Date
  fajr: Date
  sunrise: Date
  dhuhr: Date
  asr: Date
  maghrib: Date
  isha: Date
}

export const IMSAK_DEFAULT_MINUTES = 10

export const METHODS: { key: MethodKey; label: string; note: string }[] = [
  { key: 'diyanet', label: 'Diyanet (Türkiye)', note: 'Fajr 18°, İsha 17° — Türkiye resmi değerlerine en yakın' },
  { key: 'moonsighting', label: 'Moonsighting (İngiltere)', note: 'Fajr 18°, İsha 16°' },
  { key: 'mwl', label: 'Muslim World League', note: 'Fajr 18°, İsha 17°' },
  { key: 'egyptian', label: 'Mısır (el-Ezher)', note: 'Fajr 19,5°, İsha 17,5°' },
  { key: 'karachi', label: 'Karachi', note: 'Fajr 18°, İsha 18°' },
  { key: 'ummalqura', label: 'Ummü’l-Kurra (Hicaz)', note: 'Fajr 18,5°, İsha 90 dk' },
  { key: 'kuwait', label: 'Kuveyt', note: 'Fajr 18°, İsha 17,5°' },
]

export const THEMES: { key: ThemeName; label: string }[] = [
  { key: 'glass', label: 'Cam' },
  { key: 'night', label: 'Gece' },
  { key: 'neutral', label: 'Nötr' },
]

export const PRAYER_LABELS: Record<PrayerKey | 'imsak', string> = {
  imsak: 'İmsak',
  fajr: 'Sabah',
  sunrise: 'Güneş Doğumu',
  dhuhr: 'Öğle',
  asr: 'İkindi',
  maghrib: 'Akşam',
  isha: 'Yatsı',
}
