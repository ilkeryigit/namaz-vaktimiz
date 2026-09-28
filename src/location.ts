import raw from './data/turkiye-locations.json'
import type { ResolvedPlace, Settings } from './types'

interface District {
  name: string
  lat: number
  lon: number
}
interface Province {
  code: string
  name: string
  lat: number
  lon: number
  districts: District[]
}

const data = raw as unknown as { timezone: string; provinces: Province[] }

export const TIMEZONE = data.timezone
export const PROVINCES: Province[] = data.provinces

export const DEFAULT_PROVINCE = '64' // Uşak
export const DEFAULT_DISTRICT = 'Merkez'

export function findProvince(code: string): Province | undefined {
  return PROVINCES.find((p) => p.code === code)
}

export function findDistrict(province: Province, name: string): District | undefined {
  return province.districts.find((d) => d.name === name)
}

/** İlçe bilinmiyorsa il merkezine düş — alfabetik ilk ilçeye değil. */
export function centralDistrict(province: Province): District {
  return province.districts.find((d) => d.name === DEFAULT_DISTRICT) ?? province.districts[0]!
}

/** Ayar seçimini koordinata çevirir. Geçersizse Uşak/Merkez'e düşer. */
export function resolvePlace(s: Settings): ResolvedPlace {
  if (s.country === 'WLD') {
    return {
      label: s.worldName || 'Konum',
      lat: s.worldLat,
      lon: s.worldLon,
      tz: s.worldTz || TIMEZONE,
      province: 'WLD',
      district: s.worldName,
    }
  }
  const province = findProvince(s.province) ?? findProvince(DEFAULT_PROVINCE)!
  const district = findDistrict(province, s.district) ?? centralDistrict(province)
  return {
    label: `${province.name} / ${district.name}`,
    lat: district.lat,
    lon: district.lon,
    tz: TIMEZONE,
    province: province.name,
    district: district.name,
  }
}

/** Arama kutusu için il/ilçe listesi. */
export function searchTurkey(q: string, limit = 12): ResolvedPlace[] {
  const needle = q.trim().toLocaleLowerCase('tr')
  if (needle.length < 2) return []
  const out: ResolvedPlace[] = []
  for (const p of PROVINCES) {
    if (p.name.toLocaleLowerCase('tr').startsWith(needle) && out.length < limit) {
      const d = p.districts[0]!
      out.push({ label: `${p.name} / ${d.name}`, lat: d.lat, lon: d.lon, tz: TIMEZONE, province: p.name, district: d.name })
    }
    for (const d of p.districts) {
      if (out.length >= limit) break
      if (d.name.toLocaleLowerCase('tr').includes(needle)) {
        out.push({ label: `${p.name} / ${d.name}`, lat: d.lat, lon: d.lon, tz: TIMEZONE, province: p.name, district: d.name })
      }
    }
  }
  return out
}
