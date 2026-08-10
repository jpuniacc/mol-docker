/// <reference types="vite/client" />

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAdminAdmision?: boolean
    requiresGrupoTI?: boolean
    /** Solo `mv_usuario.codigo_grupo === 1` (DVU). Bloquea TI aunque el menú liste la ruta. */
    requiresSoloGrupoDvU?: boolean
    /** Restringe a estos `mv_usuario.codigo_perfil_usuario` (p. ej. [1,2,3]). */
    requiresPerfilUsuarioIn?: number[]
  }
}
