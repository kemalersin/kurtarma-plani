<template>
  <span class="kp-typing-dots" role="status" aria-label="Yanıt yazılıyor">
    <span v-for="n in 3" :key="n" class="kp-typing-dots__dot" />
  </span>
</template>

<style scoped>
.kp-typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 1.25em;
  padding: 2px 0;
  color: rgba(0, 0, 0, 0.45);
}

[data-theme='dark'] .kp-typing-dots {
  color: rgba(255, 255, 255, 0.45);
}

.kp-typing-dots__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.35;
  animation: kp-typing-dots 1.2s ease-in-out infinite;
}

.kp-typing-dots__dot:nth-child(2) {
  animation-delay: 0.15s;
}

.kp-typing-dots__dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes kp-typing-dots {
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  30% {
    opacity: 1;
    transform: translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .kp-typing-dots__dot {
    animation: kp-typing-dots-fade 1.2s ease-in-out infinite;
    transform: none;
  }
}

@keyframes kp-typing-dots-fade {
  0%,
  60%,
  100% {
    opacity: 0.35;
  }

  30% {
    opacity: 1;
  }
}
</style>
