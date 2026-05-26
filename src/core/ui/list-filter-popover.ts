import { computed, type ComputedRef } from 'vue'
import { KP_LIST_MOBILE_MQ, useMatchMedia } from '@/composables/useMatchMedia'

const listFilterPopoverBase = {
  trigger: 'click' as const,
  overlayClassName: 'kp-list-filter-popover',
  destroyTooltipOnHide: false,
  /** Kenar margin kaldırıldı; yatay sıkıştırma güvenli. */
  autoAdjustOverflow: { adjustX: 1, adjustY: 1 } as const,
}

/** Araç çubuğu solunda (arama yanı) filtre düğmesi — masaüstü. */
export const listFilterPopoverProps = {
  ...listFilterPopoverBase,
  placement: 'bottomLeft' as const,
}

/** Kart başlığı / satır sağında filtre düğmesi. */
export const listFilterPopoverEndProps = {
  ...listFilterPopoverBase,
  placement: 'bottomRight' as const,
}

export type ListFilterPopoverProps =
  | typeof listFilterPopoverProps
  | typeof listFilterPopoverEndProps

/** Masaüstü popover ayarları; mobilde `KpListFilterOverlay` → `FormDrawer`. */
export function useListFilterPopoverProps(): ComputedRef<ListFilterPopoverProps> {
  const isMobile = useMatchMedia(KP_LIST_MOBILE_MQ)
  return computed(() =>
    isMobile.value ? listFilterPopoverEndProps : listFilterPopoverProps,
  )
}
