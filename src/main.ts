import './assets/index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useMockContactoOtpUiStore } from './stores/mockContactoOtpUi'
import { useMatriculaAlumnoContextStore } from './stores/matriculaAlumnoContext'
import { useMockMatriculaContextStore } from './stores/mockMatriculaContext'
import { logMockContactoOtp } from './utils/mockContactoOtpDebug'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

void (async () => {
  logMockContactoOtp('boot.inicio')
  useMockContactoOtpUiStore().resetAll()
  await useAuthStore().hydrateFromStorage()
  useMockMatriculaContextStore().hydrateFromSessionStorage()
  useMatriculaAlumnoContextStore().hydrateFromSessionStorage()
  logMockContactoOtp('boot.listo')
  app.use(router)
  app.mount('#app')
})()
