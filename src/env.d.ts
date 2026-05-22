/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __APP_BUILD_DATE__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '*.json' {
  const value: unknown
  export default value
}
