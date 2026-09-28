import { clockHtml, formatGregorian, formatHijri } from './clock'
import { computeTimes, currentAndNext, localDateKey, orderedTimes } from './prayer'
import { resolvePlace } from './location'
import { remainingText, timesHtml } from './render'
import { loadPosition, loadSettings, onResetPosition, onSettingsChanged, savePosition } from './store'
import { applyTheme } from './themes'
import type { DayTimes, Settings } from './types'

let settings: Settings | null = null
let times: DayTimes | null = null
/** Hesaplama girdisinin parmak izi — girdi değişmeden yeniden hesaplama yok. */
let calcKey = ''

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
  const { currentLabel, next, nextLabel } = currentAndNext(t, s.showImsak, now)
  const nextAt = orderedTimes(s, t).find((r) => r.key === next)?.at ?? null

  el('date').textContent = `${formatHijri(now)} · ${formatGregorian(now)}`
  el('place').textContent = resolvePlace(s).label
  el('clock').innerHTML = clockHtml(now, s)
  el('times').innerHTML = timesHtml(s, t, now)
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
}

/** Ayar değişimi pencere durumunu da etkiler (örn. "her zaman üstte"). */
async function syncWindow(s: Settings): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().setAlwaysOnTop(s.alwaysOnTop)
  } catch {
    /* tarayıcıda çalışıyorsa pencere API'si yok */
  }
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
    await w.setAlwaysOnTop(s.alwaysOnTop)

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

    document.getElementById('drag')?.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('button, a, .no-drag')) return
      void w.startDragging()
    })
  } catch (e) {
    // Tarayıcıda pencere API'si yok (sürükleme devre dışı) ya da yetki eksik.
    console.warn('pencere entegrasyonu kurulamadı', e)
  }
}
