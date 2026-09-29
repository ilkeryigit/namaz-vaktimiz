import { clockHtml, formatGregorian, formatHijri } from './clock'
import { computeTimes, currentAndNext, localDateKey, orderedTimes } from './prayer'
import { resolvePlace } from './location'
import { remainingText, timesHtml } from './render'
import { broadcastSettings, loadPosition, loadSettings, onResetPosition, onSettingsChanged, savePosition, saveSettings } from './store'
import { applyTheme } from './themes'
import type { DayTimes, Settings } from './types'

let settings: Settings | null = null
let times: DayTimes | null = null
/** Hesaplama girdisinin parmak izi — girdi değişmeden yeniden hesaplama yok. */
let calcKey = ''
/** Son uygulanan pencere ölçüsü — aynı ölçüyü tekrar set etmeyelim. */
let lastFit = ''

const el = (id: string) => document.getElementById(id) as HTMLElement

function calcSignature(s: Settings, now: Date): string {
  const p = resolvePlace(s)
  return [p.lat, p.lon, s.method, s.madhab, s.highLat, s.imsakMinutes, JSON.stringify(s.offsets), localDateKey(now)].join('|')
}

export function tickOnce(s: Settings, now = new Date()): void {
  applyTheme(document.documentElement, s)

  const key = calcSignature(s, now)
  if (!times || calcKey !== key) {
    const place = resolvePlace(s)
    times = computeTimes(s, place, now)
    calcKey = key
  }

  const t = times
  const p = resolvePlace(s)
  const { currentLabel, next, nextLabel } = currentAndNext(t, s.showImsak, now)
  const nextAt = orderedTimes(s, t).find((r) => r.key === next)?.at ?? null

  el('date').textContent = `${formatHijri(now)} · ${formatGregorian(now)}`
  el('place').textContent = p.label
  el('clock').innerHTML = clockHtml(now, s)
  el('times').innerHTML = timesHtml(s, t, now, p.tz)
  el('now').textContent = currentLabel
  el('next').innerHTML = `${nextLabel}<b>${nextAt ? remainingText(nextAt, now) : '—'}</b>`
}

export async function start(): Promise<void> {
  settings = await loadSettings()
  tickOnce(settings)

  // Tek 1 Hz zamanlayıcı. Arka planda 60 kare/saniye çizim yapmayalım.
  window.setInterval(() => {
    if (settings) tickOnce(settings)
  }, 1000)

  await onSettingsChanged((next) => {
    settings = next
    tickOnce(settings)
    void syncWindow(next)
  })
  await onResetPosition(() => void centerWindow())

  await applyPlatform(settings)
  // İlk ölçüm: yazı tipi hazır olduktan sonra pencereyi içeriğe oturt.
  await syncWindow(settings)
}

/**
 * Ayar değişimi pencere durumunu da etkiler: gösterim modu, sabitleme
 * düğmesi ve yazı boyutuna göre pencere ölçüsü.
 */
async function syncWindow(s: Settings): Promise<void> {
  try {
    const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window')
    const w = getCurrentWindow()
    await applyDisplayMode(w, s)

    // Pencereyi içerik yüksekliğine oturt: yazı büyüdükçe büyür.
    // offsetWidth/Height border-box ölçer; scrollWidth border'ı saymaz.
    const root = el('root')
    void root.offsetHeight // yazı tipi uygulanmadan önce ölçmemek için
    const nw = root.offsetWidth
    const nh = root.offsetHeight
    const key = `${nw}x${nh}`
    // Son uygulananı hatırla: pencere boyutunu okumak DPI ölçeklemesi
    // yüzünden mantıksal/fiziksel piksel karşılaştırması bozuluyor.
    if (key !== lastFit) {
      lastFit = key
      await w.setSize(new LogicalSize(nw, nh))
      await keepOnScreen(nw, nh)
    }
  } catch {
    /* tarayıcıda çalışıyorsa pencere API'si yok */
  }
}

/**
 * Boyut büyürken sağ/alt kenar ekranı taşmasın. Aksi hâlde pencere
 * ekran dışına kayıp yeniden bulunamaz olur — düzelttiğimiz hatanın kendisi.
 */
async function keepOnScreen(nw: number, nh: number): Promise<void> {
  const { getCurrentWindow, PhysicalPosition, availableMonitors } = await import('@tauri-apps/api/window')
  const w = getCurrentWindow()
  const pos = await w.outerPosition()
  const m = (await availableMonitors()).find(
    (m) =>
      pos.x >= m.position.x &&
      pos.y >= m.position.y &&
      pos.x < m.position.x + m.size.width &&
      pos.y < m.position.y + m.size.height,
  )
  if (!m) return
  const x = Math.max(m.position.x, Math.min(pos.x, m.position.x + m.size.width - nw))
  const y = Math.max(m.position.y, Math.min(pos.y, m.position.y + m.size.height - nh))
  if (x !== pos.x || y !== pos.y) await w.setPosition(new PhysicalPosition(x, y))
}

/**
 * Görünüm modunu uygular. 'desktop' modunda görev çubuğunda görünür olur
 * (eskiden pencere erişilemez biçimde kaybolabiliyordu).
 */
async function applyDisplayMode(w: import('@tauri-apps/api/window').Window, s: Settings): Promise<void> {
  const top = s.displayMode === 'top'
  await w.setAlwaysOnTop(top)
  // Görev çubuğu düğmesi kritik: başlıksız/çerçevesiz pencere tek başına
  // erişilemez oluyordu (asıl şikâyet). 'desktop' modunda düğmenin varlığını
  // açıkça garantile; diğer modlarda platform ne verirse onu bozma.
  if (s.displayMode === 'desktop') await w.setSkipTaskbar(false)
  if (s.displayMode === 'tray') await w.hide()
  else await w.show()
}

function syncPinButton(s: Settings): void {
  const b = el('pin-btn')
  // Etiket de durumla değişmeli: sabitliyken "sabitle" demek yanlış bilgi verir.
  const label = s.pinned ? 'Sabitlenmiş — hareket ettirmek için tıkla' : 'Pencereyi sabitle'
  b.setAttribute('aria-pressed', String(s.pinned))
  b.setAttribute('aria-label', label)
  b.title = label
}

/** Sabitleme açıkken pencere bulunduğu yerde durur; tekrar tıklayınca taşınır. */
async function togglePin(): Promise<void> {
  if (!settings) return
  settings = { ...settings, pinned: !settings.pinned }
  syncPinButton(settings)
  await saveSettings(settings)
  await broadcastSettings(settings)
}

async function centerWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().center()
  } catch (e) {
    console.warn('pencere ortalanamadı', e)
  }
}

/** Kayıtlı konum ekranda değilse (monitör sökülmüş) ortalamaya düşer. */
async function applyPlatform(s: Settings): Promise<void> {
  try {
    const { getCurrentWindow, PhysicalPosition, availableMonitors } = await import('@tauri-apps/api/window')
    const w = getCurrentWindow()
    await applyDisplayMode(w, s)
    syncPinButton(s)

    el('pin-btn').addEventListener('click', () => void togglePin())
    el('settings-btn').addEventListener('click', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      void invoke('open_settings')
    })

    const pos = await loadPosition()
    if (pos) {
      const visible = (await availableMonitors()).some((m) => {
        const p = m.position
        const sz = m.size
        return pos.x >= p.x - 40 && pos.y >= p.y - 40 && pos.x <= p.x + sz.width - 40 && pos.y <= p.y + sz.height - 40
      })
      // Ekran dışıysa (monitör sökülmüş) ortalamaya düş.
      if (visible) await w.setPosition(new PhysicalPosition(pos.x, pos.y))
    }

    // Sürükleme bitince yaz; her onMoved olayında değil.
    let saveTimer: number | undefined
    await w.onMoved(({ payload }) => {
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => void savePosition({ x: payload.x, y: payload.y }), 400)
    })

    // Pencerenin tamamı sürüklenebilir; yalnız düğmeler tıklanabilir kalsın.
    document.body.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('button, a')) return
      if (settings?.pinned) return
      void w.startDragging()
    })
  } catch (e) {
    // Tarayıcıda pencere API'si yok (sürükleme devre dışı) ya da yetki eksik.
    console.warn('pencere entegrasyonu kurulamadı', e)
  }
}
