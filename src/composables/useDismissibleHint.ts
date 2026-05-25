import { ref, type Ref } from 'vue'

const STORAGE_PREFIX = 'kp.dismissedHint.'

function readDismissed(key: string): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${key}`) === '1'
  } catch {
    return false
  }
}

export function useDismissibleHint(key: string): {
  visible: Ref<boolean>
  dismiss: () => void
} {
  const visible = ref(!readDismissed(key))

  function dismiss(): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, '1')
    } catch {
      /* ignore */
    }
    visible.value = false
  }

  return { visible, dismiss }
}
