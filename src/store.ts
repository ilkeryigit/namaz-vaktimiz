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

/** Widget ile ayarlar penceresi arasında değişiklikleri duyurur. */
export const SETTINGS_CHANGED = 'nv:settings-changed'

export function broadcastSettings(s: Settings): void {
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED, { detail: s }))
}
