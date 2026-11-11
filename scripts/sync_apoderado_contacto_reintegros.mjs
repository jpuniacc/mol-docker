#!/usr/bin/env node
/**
 * Completa telefono/mail del apoderado en consolidado para reintegros (es_rf = N)
 * leyendo MT_APODER en U+ PROD.
 *
 * Uso (desde el contenedor uniacc-api, con env DB_* y SUPABASE_PG_*):
 *   node sync_apoderado_contacto_reintegros.mjs           # dry-run
 *   node sync_apoderado_contacto_reintegros.mjs --apply
 *   node sync_apoderado_contacto_reintegros.mjs --fuente reintegro_2026 --apply
 *   node sync_apoderado_contacto_reintegros.mjs --codcli-file /path/lista.txt --apply
 */
import fs from 'fs'
import sql from 'mssql'
import pg from 'pg'

const APPLY = process.argv.includes('--apply')
const BATCH = 80
const ANIO = 2027
const PERIODO = 1

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return null
  return process.argv[i + 1]
}

const FUENTE_FILTER = argValue('--fuente') // exact match; default LIKE 'reintegro%'
const CODCLI_FILE = argValue('--codcli-file')

function normalizeEmail(raw) {
  if (!raw) return null
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '')
  return s || null
}

function normalizePhone(raw) {
  if (!raw) return null
  let s = String(raw).trim().replace(/\s+/g, '')
  s = s.replace(/-\d+$/, '')
  s = s.replace(/[^\d+]/g, '')
  if (s.startsWith('+')) s = `+${s.slice(1).replace(/\D/g, '')}`
  else s = s.replace(/\D/g, '')
  if (!s || s === '+') return null
  return s.length > 32 ? s.slice(0, 32) : s
}

function chunks(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const pgClient = new pg.Client({
    host: process.env.SUPABASE_PG_HOST || process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.SUPABASE_PG_PORT || process.env.POSTGRES_PORT || 54322),
    user: process.env.SUPABASE_PG_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.SUPABASE_PG_PASSWORD || process.env.POSTGRES_PASSWORD || '',
    database: process.env.SUPABASE_PG_DB || process.env.POSTGRES_DB || 'postgres',
  })
  await pgClient.connect()

  let codcliFilter = null
  if (CODCLI_FILE) {
    const text = fs.readFileSync(CODCLI_FILE, 'utf8')
    codcliFilter = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
    console.log(`filtro codcli-file: ${codcliFilter.length}`)
  }

  const params = [ANIO, PERIODO]
  let fuenteSql = `lower(o.fuente) LIKE 'reintegro%'`
  if (FUENTE_FILTER) {
    params.push(FUENTE_FILTER)
    fuenteSql = `o.fuente = $${params.length}`
  }
  let codcliSql = ''
  if (codcliFilter && codcliFilter.length) {
    params.push(codcliFilter)
    codcliSql = ` AND c.codcli = ANY($${params.length})`
  }

  const { rows: reintegros } = await pgClient.query(
    `SELECT c.codcli, c.rut_alumno
       FROM public.mnp_cartera_oficial o
       JOIN public.mnp_mv_plan_pagos_consolidado c
         ON regexp_replace(upper(coalesce(c.rut_alumno, '')), '[.\\s-]', '', 'g')
          = regexp_replace(upper(o.rut_norm), '[.\\s-]', '', 'g')
      WHERE ${fuenteSql}
        AND upper(trim(coalesce(c.es_responsable_financiero, ''))) = 'N'
        AND c.anio_matricula = $1
        AND c.periodo_matricula = $2
        ${codcliSql}
      ORDER BY c.codcli`,
    params,
  )
  console.log(
    `reintegros con sostenedor: ${reintegros.length}` +
      (FUENTE_FILTER ? ` (fuente=${FUENTE_FILTER})` : ''),
  )
  if (reintegros.length === 0) {
    await pgClient.end()
    return
  }

  const pool = await sql.connect({
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT || 1433),
    user: process.env.DB_USER,
    password: String(process.env.DB_PASSWORD || '').replace(/^["']|["']$/g, ''),
    database: process.env.DB_DATABASE,
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 30000,
    requestTimeout: 120000,
  })

  const byCodcli = new Map()
  for (const batch of chunks(reintegros.map((r) => r.codcli), BATCH)) {
    const list = batch.map((c) => `'${String(c).replace(/'/g, "''")}'`).join(',')
    const result = await pool.request().query(`
      SELECT
        a.CODCLI AS codcli,
        LTRIM(RTRIM(apo.CELULAR)) AS celular,
        LTRIM(RTRIM(apo.mail)) AS mail
      FROM dbo.MT_ALUMNO a
      LEFT JOIN dbo.MT_CLIENT cli ON cli.CODCLI = a.RUT
      LEFT JOIN dbo.MT_APODER apo ON apo.CODAPOD = cli.CODAPOD
      WHERE a.CODCLI IN (${list})
    `)
    for (const row of result.recordset) {
      byCodcli.set(String(row.codcli).trim(), {
        telefono: normalizePhone(row.celular),
        mail: normalizeEmail(row.mail),
      })
    }
  }
  await pool.close()

  let conTel = 0
  let conMail = 0
  let sinAmbos = 0
  let updated = 0
  let skippedEmpty = 0

  for (const row of reintegros) {
    const hit = byCodcli.get(row.codcli) || { telefono: null, mail: null }
    if (hit.telefono) conTel += 1
    if (hit.mail) conMail += 1
    if (!hit.telefono && !hit.mail) {
      sinAmbos += 1
      skippedEmpty += 1
      continue
    }
    if (!APPLY) continue
    const res = await pgClient.query(
      `UPDATE public.mnp_mv_plan_pagos_consolidado
          SET telefono_apoderado = COALESCE($3, telefono_apoderado),
              telefono_apoder = COALESCE($3, telefono_apoder),
              mail_apoder = COALESCE($4, mail_apoder),
              synced_at = now()
        WHERE codcli = $1
          AND anio_matricula = $2
          AND periodo_matricula = $5`,
      [row.codcli, ANIO, hit.telefono, hit.mail, PERIODO],
    )
    updated += res.rowCount || 0

    await pgClient.query(
      `UPDATE public.mnp_mv_alumnos_matricular_periodo
          SET telefono_apoderado = COALESCE($3, telefono_apoderado)
        WHERE codcli = $1
          AND anio_matricula = $2
          AND periodo_matricula = $4`,
      [row.codcli, ANIO, hit.telefono, PERIODO],
    ).catch(() => null)
  }

  console.log(
    JSON.stringify(
      {
        modo: APPLY ? 'apply' : 'dry-run',
        candidatos: reintegros.length,
        erp_con_telefono: conTel,
        erp_con_mail: conMail,
        erp_sin_tel_ni_mail: sinAmbos,
        filas_actualizadas: APPLY ? updated : 0,
        skipped_sin_dato_erp: skippedEmpty,
      },
      null,
      2,
    ),
  )

  if (APPLY) {
    const checkParams = [ANIO, PERIODO]
    let checkFuente = `lower(o.fuente) LIKE 'reintegro%'`
    if (FUENTE_FILTER) {
      checkParams.push(FUENTE_FILTER)
      checkFuente = `o.fuente = $${checkParams.length}`
    }
    const check = await pgClient.query(
      `SELECT
         count(*) FILTER (
           WHERE upper(trim(coalesce(c.es_responsable_financiero,''))) = 'N'
             AND nullif(trim(coalesce(c.telefono_apoder, c.telefono_apoderado, '')), '') IS NOT NULL
         ) AS con_tel,
         count(*) FILTER (
           WHERE upper(trim(coalesce(c.es_responsable_financiero,''))) = 'N'
             AND nullif(trim(coalesce(c.mail_apoder, '')), '') IS NOT NULL
         ) AS con_mail
       FROM public.mnp_cartera_oficial o
       JOIN public.mnp_mv_plan_pagos_consolidado c
         ON regexp_replace(upper(coalesce(c.rut_alumno, '')), '[.\\s-]', '', 'g')
          = regexp_replace(upper(o.rut_norm), '[.\\s-]', '', 'g')
      WHERE ${checkFuente}
        AND c.anio_matricula = $1
        AND c.periodo_matricula = $2`,
      checkParams,
    )
    console.log('post-check', check.rows[0])
  }

  await pgClient.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
