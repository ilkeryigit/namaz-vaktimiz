// Türkiye il/ilçe veri setini üretir -> src/data/turkiye-locations.json
// İlçe koordinatları GeoNames TR dökümünden alınır (CC BY 4.0).
// İl/ilçe adları TürkiyeAPI türevi açık veri setinden alınır.
import { writeFileSync, readFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'src/data/turkiye-locations.json')

const GEONAMES = 'https://download.geonames.org/export/dump/TR.zip'
const DISTRICTS = 'https://raw.githubusercontent.com/adilmustafayilmaz/turkiye-il-ilce-mahalle-verileri/main/turkiye_ilce_mahalle.json'

const TZ = 'Europe/Istanbul'
// İki koordinat arası yaklaşık mesafe (km).
const km = (a, b, c, d) => {
  const R = 6371
  const t = Math.PI / 180
  const dLat = (c - a) * t
  const dLon = (d - b) * t
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Türkçe aksanı atar, I/ı ve ş/ğ/ç/ö/ü'yü sadeleştirir, küçük harfe indirger.
const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[çÇ]/g, 'c')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    .toLowerCase()
    .trim()

// Aynı ilçenin farklı yazımları. (Samsun'in 19 Mayıs ilçesi resmen
// "Ondokuz Mayıs" olarak kuruldu.)
const ALIAS = { '19mayis': 'ondokuzmayis' }

// "Karkamış ilçesi" -> "karkamis", "19 Mayıs Belediyesi" -> "19mayis"
const normDistrict = (s) => {
  const n = fold(s)
    .replace(/\b(ilce|ilcesi|belediyesi|belde|koyu|merkez)\b/g, '')
    .replace(/\s+/g, '')
    .trim()
  return ALIAS[n] ?? n
}

// Küçük yerleşim ilçe merkezini temsil etmez; PPLA2/PPLA daha güvenilir.
const RANK = { ADM2: 0, PPLA: 0, PPLA2: 0, PPLA3: 1, PPLA4: 2, PPL: 3, PPLX: 4 }

const r4 = (n) => Math.round(n * 1e4) / 1e4

async function text(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  return res.text()
}

// GeoNames yalnızca .zip dağıtır. Node'ta zip açıcı yok; Windows'ta
// Expand-Archive'i çağırıp dosyayı okuyoruz.
async function geonamesDump() {
  const res = await fetch(GEONAMES, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${GEONAMES} -> HTTP ${res.status}`)
  const dir = mkdtempSync(join(tmpdir(), 'geonames-tr-'))
  const zip = join(dir, 'TR.zip')
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()))
  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force`,
  ])
  return readFileSync(join(dir, 'TR.txt'), 'utf8')
}

const titleCaseTr = (s) =>
  s
    .split('-')
    .map((w) => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1).toLocaleLowerCase('tr'))
    .join(' ')

const main = async () => {
  console.log('1/3  GeoNames TR indiriliyor...')
  const geoTxt = await geonamesDump()

  console.log('2/3  Il/ilce adi listesi indiriliyor...')
  const raw = JSON.parse(await text(DISTRICTS))

  // GeoNames kolonları: 1=name 4=lat 5=lon 7=featureCode 10=admin1
  const adm1 = new Map() // admin1 kodu -> il
  const byProvince = new Map() // admin1 kodu -> ilçe adayları
  const country = new Map() // normalize edilmiş ilçe adı -> kayıtlar (ülke geneli)

  const add = (map, key, rec) => {
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(rec)
  }

  for (const line of geoTxt.split('\n')) {
    if (!line) continue
    const c = line.split('\t')
    const code = c[7]
    const rec = { name: c[1], norm: normDistrict(c[1]), lat: +c[4], lon: +c[5], code }
    if (code === 'ADM1') {
      adm1.set(c[10], rec)
      continue
    }
    if (RANK[code] === undefined) continue
    const a1 = c[10]
    if (a1) add(byProvince, a1, rec)
    if (rec.norm) add(country, rec.norm, rec)
  }

  const adm1ByName = new Map([...adm1].map(([code, r]) => [fold(r.name), code]))

  const provinces = []
  const misses = []
  const borrowed = []
  let ownCount = 0
  let centerCount = 0
  let worstKm = 0
  let worstName = ''

  for (const [provinceName, p] of Object.entries(raw)) {
    const gcode = adm1ByName.get(fold(provinceName))
    if (!gcode) {
      misses.push(`${provinceName} — il adı GeoNames'te yok`)
      continue
    }
    const g = adm1.get(gcode)
    const cands = byProvince.get(gcode) ?? []
    const used = new Set()

    const districts = []
    for (const dName of Object.keys(p.ilceler ?? {})) {
      const norm = normDistrict(dName)
      const center = { lat: p.koordinatlar.latitude, lon: p.koordinatlar.longitude }

      let hit = null
      let how = ''

      if (!norm || norm === 'merkez') {
        // "Merkez" tam olarak il merkezidir; il koordinatı doğru cevap.
        hit = g
        how = 'il-merkezi'
      } else {
        const sameProv = cands.filter((c) => c.norm === norm)
        const nationWide = country.get(norm) ?? []
        if (sameProv.length) {
          hit = sameProv[0]
          how = 'il-ici'
        } else if (nationWide.length === 1) {
          // 2019'da başka ilden ayrılan ilçeler eski parent altında kalmış olabilir.
          hit = nationWide[0]
          how = 'ulke-tekil'
        } else {
          const alt = cands.filter((c) => c.norm.includes(norm) && norm.length >= 5)
          if (alt.length === 1) {
            hit = alt[0]
            how = 'il-ici-ek'
          } else {
            // Son çare: il içindeki en yakın yerleşim. Aynı koordinat iki
            // ilçeye verilmesin (19 Mayıs gibi 2019 ilçeleri komşudan
            // ödünç alıyordu).
            const near = [...cands]
              .filter((c) => !used.has(`${c.lat},${c.lon}`))
              .sort(
                (a, b) => RANK[a.code] - RANK[b.code] || km(g.lat, g.lon, a.lat, a.lon) - km(g.lat, g.lon, b.lat, b.lon)
              )[0]
            if (near) {
              hit = near
              how = 'il-ici-en-yakin'
            }
          }
        }
      }

      const lat = r4(hit ? hit.lat : center.lat)
      const lon = r4(hit ? hit.lon : center.lon)
      if (how === 'il-merkezi') centerCount++
      else {
        ownCount++
        if (how !== 'il-ici') borrowed.push(`${provinceName}/${dName} (${how})`)
        const d = km(g.lat, g.lon, hit.lat, hit.lon)
        if (d > worstKm) {
          worstKm = d
          worstName = `${provinceName}/${dName} (${how}, ${d.toFixed(0)} km)`
        }
      }

      if (!hit) misses.push(`${provinceName}/${dName} — il merkezine düştü`)
      used.add(`${lat},${lon}`)
      districts.push({ name: dName, lat, lon })
    }

    districts.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    provinces.push({
      code: String(p.plaka).padStart(2, '0'),
      name: titleCaseTr(provinceName),
      lat: r4(g.lat),
      lon: r4(g.lon),
      districts,
    })
  }

  provinces.sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generated: new Date().toISOString().slice(0, 10),
        timezone: TZ,
        sources: {
          districts: 'https://github.com/adilmustafayilmaz/turkiye-il-ilce-mahalle-verileri (TurkiyeAPI)',
          coordinates: 'https://download.geonames.org/export/dump/TR.txt (CC BY 4.0)',
        },
        provinces,
      },
      null,
      0
    ),
    'utf8'
  )

  const dCount = provinces.reduce((a, p) => a + p.districts.length, 0)
  console.log(`3/3  Yazıldı: ${OUT}`)
  console.log(`     ${provinces.length} il / ${dCount} ilçe`)
  console.log(`     Kendi koordinatıyla: ${ownCount} · il merkezi (Merkez ilçeler): ${centerCount} · komşudan ödünç: ${borrowed.length}`)
  if (borrowed.length) borrowed.forEach((m) => console.log(`       ~ ${m}`))
  if (misses.length) misses.forEach((m) => console.log(`       ! ${m}`))
  console.log(`     En uzak eşleşme: ${worstName || 'yok'}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
