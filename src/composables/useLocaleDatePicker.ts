import { computed } from 'vue'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import { profileDateFormatToDayjs } from '@/core/locale/date-format'
import { useProfileStore } from '@/stores/profile'

/** AntDV DatePicker `format` — profil `localeSettings.dateFormat` → dayjs. */
export function useLocaleDatePicker() {
  const profileStore = useProfileStore()

  const format = computed(() =>
    profileDateFormatToDayjs(
      profileStore.activeProfile?.localeSettings.dateFormat
        ?? DEFAULT_LOCALE_SETTINGS.dateFormat,
    ),
  )

  return { format }
}
