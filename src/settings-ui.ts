import './style'
import { PROVINCES, findProvince, resolvePlace } from './location'
import { computeTimes, localDateKey } from './prayer'
import { applyRemote, canVerifyOnline, fetchAladhan, maxDiffMinutes } from './remote'
import { broadcastResetPosition, broadcastSettings, clearPosition, loadSettings, saveSettings } from './store'
import { applyTheme, THEME_CSS } from './themes'
import { METHODS, PRAYER_LABELS, THEMES, type PrayerKey, type Settings } from './types'

let s: Settings
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const PRAYERS: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

function css() {
  const st = document.createElement('style')
  st.textContent = `${THEME_CSS}
  body.settings-body { background: #1b1f27; color: #e9edf4; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; padding: 0; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 22px 24px 40px; }
  h1 { font-size: 20px; font-weight: 600; }
  h3 { font-size: 13px; font-weight: 600; margin: 22px 0 4px; color: #9fb0c9; text-transform: uppercase; letter-spacing: .06em; }
  .dim, .hint { color: #8b98ab; font-size: 12.5px; line-height: 1.5; }
  .hint { margin: 4px 0 10px; }
  .tabs { display: flex; gap: 4px; margin: 18px 0 20px; border-bottom: 1px solid #2b323d; }
  .tab { background: none; border: 0; border-bottom: 2px solid transparent; color: #8b98ab; padding: 8px 14px; font-size: 13.5px; cursor: pointer; }
  .tab.on { color: #7fd1c1; border-bottom-color: #7fd1c1; }
  .page { display: none; }
  .page.on { display: block; }
  .row2 { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px solid #232935; }
  .row2 > label { flex: 1 1 auto; }
  select, input[type=search], input[type=number] { background: #232935; color: #e9edf4; border: 1px solid #333c4a; border-radius: 7px; padding: 6px 9px; font-size: 13.5px; min-width: 190px; font-family: inherit; }
  input[type=range] { width: 190px; accent-color: #7fd1c1; }
  input[type=checkbox] { width: 17px; height: 17px; accent-color: #7fd1c1; }
  .seg { display: flex; border: 1px solid #333c4a; border-radius: 7px; overflow: hidden; }
  .seg button { background: #1b1f27; color: #8b98ab; border: 0; padding: 6px 14px; font-size: 13px; cursor: pointer; font-family: inherit; }
  .seg button.on { background: #7fd1c1; color: #10202a; font-weight: 600; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
  .grid .o { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
  .grid input { width: 74px; text-align: right; }
  .btn { background: #2b3340; color: #e9edf4; border: 1px solid #3a4553; border-radius: 7px; padding: 7px 15px; font-size: 13px; cursor: pointer; font-family: inherit; }
  .btn.primary { background: #7fd1c1; color: #10202a; border-color: #7fd1c1; font-weight: 600; }
  .results { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 10px; }
  .results button { text-align: left; background: #232935; color: #dfe6f0; border: 0; border-radius: 6px; padding: 7px 10px; font-size: 13px; cursor: pointer; font-family: inherit; }
  .results button:hover { background: #2c3542; }
  .out { background: #141821; border: 1px solid #2b323d; border-radius: 7px; padding: 11px 13px; font-size: 12px; white-space: pre-wrap; margin-top: 10px; color: #9fd8c8; }
  .s-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 30px; padding-top: 16px; border-top: 1px solid #2b323d; }
  .src { margin: 6px 0 0 18px; color: #8b98ab; font-size: 12.5px; line-height: 1.8; }
  code { background: #232935; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  `
  document.head.appendChild(st)
}

async function commit(): Promise<void> {
  await saveSettings(s)
  $('save-state').textContent = 'Kaydedildi'
  window.setTimeout(() => ($('save-state').textContent = ''), 1400)
  await broadcastSettings(s)
}

function fillProvinces(): void {
  const sel = $<HTMLSelectElement>('province')
  sel.innerHTML = PROVINCES.map((p) => `<option value="${p.code}">${p.code} — ${p.name}</option>`).join('')
  sel.value = s.province
}

function fillDistricts(): void {
  const p = findProvince(s.province) ?? PROVINCES[0]!
  const sel = $<HTMLSelectElement>('district')
  sel.innerHTML = p.districts.map((d) => `<option value="${d.name}">${d.name}</option>`).join('')
  sel.value = s.district
  const d = p.districts.find((x) => x.name === s.district) ?? p.districts[0]!
  $('coord-hint').textContent = `Seçili koordinat: ${d.lat.toFixed(4)}, ${d.lon.toFixed(4)} · Saat dilimi Europe/Istanbul`
}

function fillMethods(): void {
  const sel = $<HTMLSelectElement>('method')
  sel.innerHTML = METHODS.map((m) => `<option value="${m.key}">${m.label}</option>`).join('')
  sel.value = s.method
  const note = METHODS.find((m) => m.key === s.method)?.note ?? ''
  $('method-note').textContent = note
}

function fillOffsets(): void {
  $('offsets').innerHTML = PRAYERS.map(
    (k) => `<label class="o"><span>${PRAYER_LABELS[k]}</span>
      <input type="number" min="-30" max="30" step="1" data-off="${k}" value="${s.offsets[k]}" /></label>`
  ).join('')
  $('offsets')
    .querySelectorAll<HTMLInputElement>('input[data-off]')
    .forEach((inp) =>
      inp.addEventListener('change', () => {
        s.offsets[inp.dataset.off as PrayerKey] = Math.max(-30, Math.min(30, Number(inp.value) || 0))
        void commit()
      })
    )
}

function fillThemes(): void {
  const box = $('theme')
  box.innerHTML = THEMES.map((t) => `<button data-v="${t.key}">${t.label}</button>`).join('')
  syncSeg(box, s.theme)
  box.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
    b.addEventListener('click', () => {
      s.theme = b.dataset.v as Settings['theme']
      syncSeg(box, s.theme)
      applyTheme(document.documentElement, s)
      void commit()
    })
  )
}

function syncSeg(box: HTMLElement, v: string): void {
  box.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.v === v))
}

function updateOnlineNote(): void {
  const n = $('online-note')
  if (!canVerifyOnline(s)) {
    n.textContent =
      s.online === 'aladhan'
        ? 'Seçili yerel yöntem Aladhan metodlarıyla eşleşmiyor. Doğrulama için "Diyanet (Türkiye)" yöntemini seçin.'
        : 'Kapalıyken uygulama hiçbir ağ isteği yapmaz. Açarsanız günde bir kez Diyanet değerleriyle karşılaştırılır.'
  } else {
    n.textContent = 'Vakitler yine yerel hesaplanır; Aladhan yalnızca karşılaştırma için kullanılır. Açıklama: yöntem Diyanet.'
  }
  $('verify').toggleAttribute('disabled', !canVerifyOnline(s))
}

async function verify(): Promise<void> {
  const out = $<HTMLPreElement>('verify-out')
  out.hidden = false
  out.textContent = 'Sorgulanıyor…'
  const place = resolvePlace(s)
  const dateKey = localDateKey(new Date())
  const remote = await fetchAladhan(place, dateKey, s)
  if (!remote) {
    out.textContent = 'Aladhan\'a ulaşılamadı. Yerel hesaplama etkin kalıyor.'
    return
  }
  const localT = computeTimes(s, place, new Date())
  const remoteT = applyRemote(remote, s, dateKey)
  const diff = maxDiffMinutes(localT, remoteT)
  const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  out.textContent =
    `Tarih: ${dateKey} (${remote.tz})\n` +
    `En büyük fark: ${diff.toFixed(1)} dakika\n\n` +
    ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
      .map((k) => `${PRAYER_LABELS[k as PrayerKey].padEnd(14)} yerel ${fmt(new Date(localT[k as PrayerKey]))}   uzak ${fmt(new Date(remoteT[k as PrayerKey]))}`)
      .join('\n')
}

async function worldSearch(): Promise<void> {
  const q = $<HTMLInputElement>('worldq').value.trim()
  const box = $('world-results')
  if (q.length < 2) {
    box.innerHTML = ''
    return
  }
  box.innerHTML = '<button disabled>Aranıyor…</button>'
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=tr&format=json`
    const res = await fetch(url)
    const json = (await res.json()) as {
      results?: { name: string; country: string; admin1?: string; latitude: number; longitude: number; timezone: string }[]
    }
    const rs = json.results ?? []
    box.innerHTML = rs
      .map(
        (r, i) =>
          `<button data-i="${i}">${r.name} — ${[r.admin1, r.country].filter(Boolean).join(', ')}</button>`
      )
      .join('') || '<button disabled>Sonuç yok</button>'
    box.querySelectorAll<HTMLButtonElement>('button[data-i]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = rs[Number(b.dataset.i)]!
        s.country = 'WLD'
        s.worldName = [r.name, r.admin1, r.country].filter(Boolean).join(' / ')
        s.worldLat = r.latitude
        s.worldLon = r.longitude
        s.worldTz = r.timezone
        box.innerHTML = ''
        $('world-picked').textContent = `${s.worldName} · ${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)} · ${r.timezone}`
        syncCountry()
        void commit()
      })
    )
  } catch {
    box.innerHTML = '<button disabled>Arama yapılamadı (çevrimdışı?)</button>'
  }
}

function syncCountry(): void {
  const tr = s.country === 'TR'
  $('tr-part').toggleAttribute('hidden', !tr)
  $('wld-part').toggleAttribute('hidden', tr)
  syncSeg($('country'), s.country)
}

function bind(): void {
  $('tabs')
    .querySelectorAll<HTMLButtonElement>('.tab')
    .forEach((t) =>
      t.addEventListener('click', () => {
        $('tabs').querySelectorAll('.tab').forEach((x) => x.classList.remove('on'))
        document.querySelectorAll('.page').forEach((p) => p.classList.remove('on'))
        t.classList.add('on')
        document.querySelector(`.page[data-page="${t.dataset.tab}"]`)?.classList.add('on')
      })
    )

  $('country')
    .querySelectorAll<HTMLButtonElement>('button')
    .forEach((b) =>
      b.addEventListener('click', () => {
        s.country = b.dataset.v as Settings['country']
        syncCountry()
        void commit()
      })
    )

  $('province').addEventListener('change', (e) => {
    s.province = (e.target as HTMLSelectElement).value
    s.district = findProvince(s.province)!.districts[0]!.name
    fillDistricts()
    void commit()
  })
  $('district').addEventListener('change', (e) => {
    s.district = (e.target as HTMLSelectElement).value
    fillDistricts()
    void commit()
  })

  $('method').addEventListener('change', (e) => {
    s.method = (e.target as HTMLSelectElement).value as Settings['method']
    fillMethods()
    updateOnlineNote()
    void commit()
  })

  const bindSel = (id: keyof Settings, ev = 'change') =>
    $(id).addEventListener(ev, (e) => {
      const t = e.target as HTMLInputElement
      ;(s as unknown as Record<string, unknown>)[id] = t.type === 'checkbox' ? t.checked : t.type === 'range' || t.type === 'number' ? Number(t.value) : t.value
      if (id === 'opacity' || id === 'fontScale') $(`${id}-v`).textContent = Number(t.value).toFixed(2)
      if (id === 'theme' || id === 'opacity' || id === 'fontScale') applyTheme(document.documentElement, s)
      updateOnlineNote()
      void commit()
    })

  for (const id of ['madhab', 'highLat', 'showImsak', 'hour24', 'showSeconds', 'alwaysOnTop', 'online', 'imsak'] as (keyof Settings)[]) {
    bindSel(id)
  }
  bindSel('opacity', 'input')
  bindSel('fontScale', 'input')

  $('clock')
    .querySelectorAll<HTMLButtonElement>('button')
    .forEach((b) =>
      b.addEventListener('click', () => {
        s.clock = b.dataset.v as Settings['clock']
        syncSeg($('clock'), s.clock)
        void commit()
      })
    )

  $('worldq').addEventListener('change', () => void worldSearch())
  $('worldq').addEventListener('input', debounce(() => void worldSearch(), 450))
  $('verify').addEventListener('click', () => void verify())
  $('reset-pos').addEventListener('click', async () => {
    await clearPosition()
    // Pencereyi kendisi ortalar: ayarlar penceresi widget'ı bulmaya çalışmaz.
    await broadcastResetPosition()
  })
  $('autostart').addEventListener('change', async (e) => {
    const want = (e.target as HTMLInputElement).checked
    try {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart')
      want ? await enable() : await disable()
    } catch {
      /* eklenti yoksa ayar yalnız kaydedilir */
    }
  })
  $('close').addEventListener('click', async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().hide()
    } catch {
      window.close()
    }
  })
}

function debounce<T extends unknown[]>(fn: (...a: T) => void, ms: number) {
  let t: number
  return (...a: T) => {
    window.clearTimeout(t)
    t = window.setTimeout(() => fn(...a), ms)
  }
}

async function main(): Promise<void> {
  css()
  s = await loadSettings()

  fillProvinces()
  fillDistricts()
  fillMethods()
  fillOffsets()
  fillThemes()
  syncCountry()

  $<HTMLSelectElement>('madhab').value = s.madhab
  $<HTMLSelectElement>('highLat').value = s.highLat
  $<HTMLSelectElement>('online').value = s.online
  $<HTMLInputElement>('imsak').value = String(s.imsakMinutes)
  $<HTMLInputElement>('showImsak').checked = s.showImsak
  $<HTMLInputElement>('hour24').checked = s.hour24
  $<HTMLInputElement>('showSeconds').checked = s.showSeconds
  $<HTMLInputElement>('alwaysOnTop').checked = s.alwaysOnTop
  $<HTMLInputElement>('autostart').checked = s.autostart
  $<HTMLInputElement>('opacity').value = String(s.opacity)
  $<HTMLInputElement>('fontScale').value = String(s.fontScale)
  $('opacity-v').textContent = s.opacity.toFixed(2)
  $('fontScale-v').textContent = s.fontScale.toFixed(2)
  syncSeg($('clock'), s.clock)
  $('world-picked').textContent = s.worldName ? `${s.worldName} · ${s.worldLat.toFixed(3)}, ${s.worldLon.toFixed(3)}` : '—'
  applyTheme(document.documentElement, s)
  updateOnlineNote()
  bind()
}

void main()
