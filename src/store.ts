import type { Settings } from './types'
import { normalizeSettings } from './settings'

const KEY = 'settings.json'

type Backend = {
  get: (k: string) => Promise<unknown>
  set: (k: string, v: unknown) => Promise<void>
}

/** Tauri store varsa onu, yoksa localStorage'ı kullanır. */
async function backend(): Promise<Backend> {
  try {
    const { load } = await import('@tauri-apps/plugin-store')
    const store = await load('settings.json', { autoSave: true })
    return {
      get: (k) => store.get(k),
      set: (k, v) => store.set(k, v),
    }
  } catch {
    return {
      get: async (k) => JSON.parse(localStorage.getItem(k) ?? 'null'),
      set: async (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    }
  }
}

let cache: Backend | null = null

export async function loadSettings(): Promise<Settings> {
  cache ??= await backend()
  return normalizeSettings(await cache.get(KEY))
}

export async function saveSettings(s: Settings): Promise<void> {
  cache ??= await backend()
  await cache.set(KEY, normalizeSettings(s))
}

const POS_KEY = 'position'

/** Fiziksel piksel cinsinden pencere köşesi. */
export interface WinPos {
  x: number
  y: number
}

/**
 * Pencere konumu ayarlardan ayrı tutulur: widget her sürüklemede yazarken
 * ayarları (aynı anahtarda) ezme riski olmasın.
 */
export async function loadPosition(): Promise<WinPos | null> {
  cache ??= await backend()
  const v = await cache.get(POS_KEY)
  const p = v as Partial<WinPos> | null
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x!, y: p.y! } : null
}

export async function savePosition(p: WinPos): Promise<void> {
  cache ??= await backend()
  await cache.set(POS_KEY, p)
}

export async function clearPosition(): Promise<void> {
  cache ??= await backend()
  await cache.set(POS_KEY, null)
}

/** Widget ile ayarlar penceresi arasında değişiklikleri duyurur. */
export const SETTINGS_CHANGED = 'nv:settings-changed'
export const RESET_POSITION = 'nv:reset-position'

/**
 * Ayar ve widget ayrı WebView2 pencereleri olduğu için DOM olayı tek başına
 * yetmez; Tauri olayı kullanılır, tarayıcıda DOM olayına düşülür.
 */
async function toWindows(name: string, payload: unknown): Promise<void> {
  try {
    const { emit } = await import('@tauri-apps/api/event')
    await emit(name, payload)
  } catch {
    window.dispatchEvent(new CustomEvent(name, { detail: payload }))
  }
}

async function fromWindows<T>(name: string, cb: (v: T) => void): Promise<void> {
  try {
    const { listen } = await import('@tauri-apps/api/event')
    await listen<T>(name, (e) => cb(e.payload))
  } catch {
    window.addEventListener(name, (e) => cb((e as CustomEvent<T>).detail))
  }
}

export function broadcastSettings(s: Settings): Promise<void> {
  return toWindows(SETTINGS_CHANGED, s)
}

export function onSettingsChanged(cb: (s: Settings) => void): Promise<void> {
  return fromWindows<Settings>(SETTINGS_CHANGED, (p) => cb(normalizeSettings(p)))
}

export function broadcastResetPosition(): Promise<void> {
  return toWindows(RESET_POSITION, null)
}

export function onResetPosition(cb: () => void): Promise<void> {
  return fromWindows<null>(RESET_POSITION, () => cb())
}
