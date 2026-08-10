import { ref, computed, onMounted, onUnmounted } from 'vue'

/**
 * Composable para gestionar la actualización automática de datos
 * Horario: Lunes a Sábado, 07:00 - 23:00, cada hora
 */
export function useAutoRefresh() {
  const currentTime = ref(new Date())
  let intervalId: number | null = null

  /**
   * Verifica si estamos en horario laboral (Lun-Sáb, 07:00-23:00)
   */
  function isBusinessHours(date: Date = currentTime.value): boolean {
    const dayOfWeek = date.getDay() // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const hour = date.getHours()

    // Lunes a Sábado (1-6) y entre 07:00 y 23:00
    return dayOfWeek >= 1 && dayOfWeek <= 6 && hour >= 7 && hour < 23
  }

  /**
   * Calcula la próxima hora válida para actualización
   */
  function getNextRefreshTime(date: Date = currentTime.value): Date {
    const next = new Date(date)
    
    // Si es domingo, ir al lunes 07:00
    if (next.getDay() === 0) {
      const daysUntilMonday = 1
      next.setDate(next.getDate() + daysUntilMonday)
      next.setHours(7, 0, 0, 0)
      return next
    }

    // Si es sábado después de las 23:00, ir al lunes 07:00
    if (next.getDay() === 6 && next.getHours() >= 23) {
      const daysUntilMonday = 2
      next.setDate(next.getDate() + daysUntilMonday)
      next.setHours(7, 0, 0, 0)
      return next
    }

    // Si estamos fuera del horario laboral (antes de 07:00 o después de 23:00)
    if (!isBusinessHours(next)) {
      // Si es antes de las 07:00, ir a las 07:00 del mismo día
      if (next.getHours() < 7) {
        next.setHours(7, 0, 0, 0)
        return next
      }
      // Si es después de las 23:00, ir al siguiente día a las 07:00
      if (next.getHours() >= 23) {
        next.setDate(next.getDate() + 1)
        next.setHours(7, 0, 0, 0)
        // Si el siguiente día es domingo, ir al lunes
        if (next.getDay() === 0) {
          next.setDate(next.getDate() + 1)
        }
        return next
      }
    }

    // Si estamos en horario laboral, calcular la próxima hora
    const currentHour = next.getHours()
    const nextHour = currentHour + 1

    // Si la próxima hora está dentro del horario laboral
    if (nextHour < 23) {
      next.setHours(nextHour, 0, 0, 0)
    } else {
      // Si la próxima hora sería 23:00 o más, ir al siguiente día a las 07:00
      next.setDate(next.getDate() + 1)
      next.setHours(7, 0, 0, 0)
      // Si el siguiente día es domingo, ir al lunes
      if (next.getDay() === 0) {
        next.setDate(next.getDate() + 1)
      }
    }

    return next
  }

  /**
   * Calcula los minutos restantes hasta la próxima actualización
   */
  const minutesUntilNextRefresh = computed(() => {
    const now = currentTime.value
    const nextRefresh = getNextRefreshTime(now)
    const diffMs = nextRefresh.getTime() - now.getTime()
    const diffMinutes = Math.ceil(diffMs / (1000 * 60))
    return Math.max(0, diffMinutes)
  })

  /**
   * Mensaje formateado para mostrar el tiempo restante
   */
  const nextRefreshMessage = computed(() => {
    if (!isBusinessHours()) {
      const nextRefresh = getNextRefreshTime()
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      const dayName = dayNames[nextRefresh.getDay()]
      const hours = nextRefresh.getHours().toString().padStart(2, '0')
      const minutes = nextRefresh.getMinutes().toString().padStart(2, '0')
      
      if (currentTime.value.getDay() === 0) {
        return `Próxima actualización: ${dayName} ${hours}:${minutes}`
      }
      return `Fuera del horario. Próxima: ${dayName} ${hours}:${minutes}`
    }

    const minutes = minutesUntilNextRefresh.value
    if (minutes === 0) {
      return 'Actualizando...'
    }
    if (minutes === 1) {
      return 'Próxima actualización en 1 minuto'
    }
    return `Próxima actualización en ${minutes} minutos`
  })

  /**
   * Actualiza el tiempo actual cada minuto
   */
  function startTimer() {
    // Actualizar inmediatamente
    currentTime.value = new Date()
    
    // Actualizar cada minuto
    intervalId = window.setInterval(() => {
      currentTime.value = new Date()
    }, 60000) // 60 segundos
  }

  /**
   * Detiene el timer
   */
  function stopTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  onMounted(() => {
    startTimer()
  })

  onUnmounted(() => {
    stopTimer()
  })

  return {
    currentTime,
    minutesUntilNextRefresh,
    nextRefreshMessage,
    isBusinessHours: () => isBusinessHours(),
    getNextRefreshTime: () => getNextRefreshTime(),
    startTimer,
    stopTimer,
  }
}

