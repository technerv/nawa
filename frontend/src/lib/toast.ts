export type ToastType = 'success' | 'error' | 'info'

export function showToast(text: string, type: ToastType = 'info') {
  const ev = new CustomEvent('toast', { detail: { text, type } })
  window.dispatchEvent(ev)
}