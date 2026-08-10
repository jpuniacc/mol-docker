/**
 * Store principal de la aplicación
 * Aquí puedes agregar estado global que necesites
 */
export const useAppStore = defineStore('app-store', () => {
  const appName = ref('Sitio Matricula Online')
  const isLoading = ref(false)

  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  return {
    appName,
    isLoading,
    setLoading,
  }
})

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
