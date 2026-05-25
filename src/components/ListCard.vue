<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Varsayılan: tıklanabilir kart (satır tıklama eşdeğeri). */
    clickable?: boolean
  }>(),
  { clickable: true },
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

function onClick(event: MouseEvent): void {
  emit('click', event)
}
</script>

<template>
  <li
    class="kp-list-card"
    :class="{ 'kp-list-card--clickable': clickable }"
    @click="clickable ? onClick($event) : undefined"
  >
    <header v-if="$slots.title || $slots.actions" class="kp-list-card__head">
      <h3 v-if="$slots.title" class="kp-list-card__title">
        <slot name="title" />
      </h3>
      <div v-if="$slots.actions" class="kp-list-card__actions" @click.stop>
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </li>
</template>
