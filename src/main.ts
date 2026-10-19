import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import './style.css'
import App from './App.vue'
import { router } from './app/router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
