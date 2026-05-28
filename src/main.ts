import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { router } from '@/router'
import { applyEmbeddedFavicon } from '@/core/favicon'
import { registerPwa } from '@/core/services/pwa'
import '@/app.css'
import 'ant-design-vue/dist/reset.css'
import '@/core/echarts/setup'

applyEmbeddedFavicon()
registerPwa()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
