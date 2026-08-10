import { toast } from 'vue-sonner'

interface CustomError extends Error {
  customCode?: number
}

export const useErrorStore = defineStore('error-store', () => {
  const activeError = ref<null | CustomError>(null)
  const isCustomError = ref(false)

  const setError = ({
    error,
    customCode,
    showToast = true,
  }: {
    error: string | Error
    customCode?: number
    showToast?: boolean
  }) => {
    // Log detallado del error
    logDetallado(error)

    // Mostrar toast con mensaje de error
    if (showToast) {
      toast.error('Hubo un error. Inténtalo nuevamente.', {
        duration: 3000,
      })
    }

    // Handle string error
    if (typeof error === 'string') {
      isCustomError.value = true
      activeError.value = new Error(error) as CustomError
      activeError.value.customCode = customCode || 500
      return
    }

    // Handle standard Error
    if (error instanceof Error) {
      activeError.value = error as CustomError
      activeError.value.customCode = customCode || 500
      return
    }

    // Fallback
    activeError.value = new Error('Unknown error') as CustomError
    activeError.value.customCode = customCode || 500
  }

  const clearError = () => {
    console.log('Error borrado')
    activeError.value = null
    isCustomError.value = false
  }

  const logDetallado = (error: string | Error) => {
    console.group('🔥 ERROR DETALLADO:')
    console.log('Timestamp:', new Date().toISOString())
    console.log('Tipo de error:', typeof error)
    console.log('Error completo:', error)

    if (typeof error === 'string') {
      console.log('Error tipo string:', error)
    } else if (error instanceof Error) {
      console.log('Error name:', error.name)
      console.log('Error message:', error.message)
      console.log('Error stack:', error.stack)
    }

    console.log('Ruta actual:', window.location.href)
    console.log('User Agent:', navigator.userAgent)

    console.groupEnd()
  }

  return {
    activeError,
    setError,
    isCustomError,
    clearError,
  }
})

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useErrorStore, import.meta.hot))
}
