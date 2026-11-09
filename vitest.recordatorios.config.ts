import {defineConfig} from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import {fileURLToPath,URL} from 'node:url'
export default defineConfig({envDir:'/tmp/recordatorios-no-env',plugins:[vue()],resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},cacheDir:'/tmp/recordatorios-vite-cache',test:{environment:'jsdom',cache:false,include:['src/components/seguimiento/SeguimientoRecordatorios*.test.ts','src/utils/seguimientoRecordatorios.test.ts','src/components/seguimiento/SeguimientoFiltrosRecordatorios.test.ts']}})
