#!/usr/bin/env bash
# Detiene el frontend legacy rematricula-online en PM2 (:9501)
# para evitar conflicto con mol-dev Docker (prod vía Traefik o compose.dev).
set -euo pipefail

NAME="${PM2_APP_NAME:-rematricula-online}"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 no está en PATH; nada que detener."
  exit 0
fi

if pm2 describe "$NAME" >/dev/null 2>&1; then
  echo "Deteniendo PM2 process: $NAME"
  pm2 stop "$NAME" || true
  pm2 save || true
  echo "OK: $NAME detenido."
else
  echo "Process PM2 '$NAME' no encontrado (ya detenido o no registrado)."
fi
