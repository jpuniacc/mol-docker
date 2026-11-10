#!/usr/bin/env python3
"""Carga consolidado (+progreso) para reintegros 2025→2027-1 en supabase-dev.

Fuente:
  - mnp_cartera_beneficios (fuerza_aplica) / Excel para identidad
  - mnp_datos_alumnos para demografía ya sincronizada
  - precios medianos de mnp_mv_plan_pagos_consolidado por carrera
    (+ fallback U+ para carreras sin precio en consolidado)

Por defecto dry-run. Con --apply:
  - upsert filas en mnp_mv_plan_pagos_consolidado (periodo 2027-1)
  - upsert filas en mnp_mv_alumnos_matricular_periodo
  - opcionalmente fuerza estado_academico=VIGENTE en mnp_datos_alumnos
    (necesario para login MOL; use --keep-suspendido para omitir)

Instalar: python3 -m pip install -r scripts/requirements.txt
"""
from __future__ import annotations

import argparse
import os
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, execute_batch
except ImportError:
    psycopg2 = None  # type: ignore[assignment]
    RealDictCursor = None  # type: ignore[misc, assignment]
    execute_batch = None  # type: ignore[misc, assignment]

EXCEL_DEFAULT = (
    "/opt/mol-docker/docs/base alumnos/reingresos/"
    "BASE PARA REINTEGROS (2025 ULT MAT).xlsx"
)
SHEET_DEFAULT = "PARA TRABAJO REINTEGRO 2027 (2)"
PERIODO_REMAT = "2027-1"
ANIO_MAT = 2027
PERIODO_MAT = 1

# Medianas aproximadas U+ PROD (VW_DOCPAG_MAT_ARA) para carreras sin precio en consolidado
PRECIO_FALLBACK: dict[str, tuple[Decimal, Decimal, int, int]] = {
    "ARQU1VR": (Decimal("250000"), Decimal("2786069"), 10, 11),
    "LTSO4AE": (Decimal("206415"), Decimal("1980436"), 12, 12),
}

DEFAULT_MAT = Decimal("250000")
DEFAULT_ARA = Decimal("3500000")


def pg_connect():
    host = os.environ.get("PGHOST", "127.0.0.1")
    port = int(os.environ.get("PGPORT", "54322"))
    # Prefer docker network to supabase-db when running on host with tenant issues
    dbname = os.environ.get("PGDATABASE", "postgres")
    user = os.environ.get("PGUSER", "postgres")
    password = os.environ.get("PGPASSWORD", "postgres")
    return psycopg2.connect(
        host=host, port=port, dbname=dbname, user=user, password=password
    )


def rut_norm(rut: Any, dig: Any) -> str:
    body = "".join(c for c in str(rut) if c.isdigit())
    dv = str(dig).strip().upper()
    return f"{body}-{dv}" if body else ""


def split_apoderado(nombre: str | None) -> tuple[str | None, str | None, str | None]:
    if not nombre or not str(nombre).strip():
        return None, None, None
    parts = str(nombre).strip().split()
    if len(parts) == 1:
        return parts[0], None, None
    if len(parts) == 2:
        return parts[0], parts[1], None
    return " ".join(parts[:-2]), parts[-2], parts[-1]


def load_excel_index(path: Path, sheet: str) -> dict[str, dict[str, Any]]:
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    rows = ws.iter_rows(values_only=True)
    headers = [str(h).strip() if h is not None else "" for h in next(rows)]
    idx = {h: i for i, h in enumerate(headers)}

    def cell(row: tuple[Any, ...], name: str) -> Any:
        i = idx.get(name)
        return row[i] if i is not None and i < len(row) else None

    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        codcli = cell(row, "CODCLI")
        if not codcli:
            continue
        cod = str(codcli).strip()
        ano_ult = cell(row, "ANO ULT MAT")
        per_ult = cell(row, "PERIODO MAT")
        ult = None
        if ano_ult is not None and per_ult is not None:
            ult = f"{int(ano_ult)}-{int(per_ult)}"
        out[cod] = {
            "nombre": (str(cell(row, "NOMBRE") or "")).strip(),
            "apellido_paterno": (str(cell(row, "APELLIDO PAT") or "")).strip(),
            "apellido_materno": (str(cell(row, "APELLIDO MAT") or "")).strip(),
            "rut": rut_norm(cell(row, "RUT"), cell(row, "DIG")),
            "codcarr": (str(cell(row, "CODCARPR") or "")).strip(),
            "carrera": (str(cell(row, "CARRERA") or "")).strip(),
            "estacad": (str(cell(row, "ESTACAD") or "")).strip(),
            "tipositu": cell(row, "DESCRIPCION SITU"),
            "prom": cell(row, "PROM GRAL"),
            "mail": (str(cell(row, "MAIL") or "")).strip().lower() or None,
            "jornada": (str(cell(row, "JORNADA ") or cell(row, "JORNADA") or "")).strip()
            or None,
            "ult_matricula": ult,
            "categoria": (str(cell(row, "CATEGORIA") or "")).strip() or None,
        }
    return out


def fetch_precios(cur) -> dict[str, tuple[Decimal, Decimal, int | None, int | None]]:
    cur.execute(
        """
        SELECT codigo_carrera,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY matricula_valor) AS mat,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY arancel_valor) AS ara,
               mode() WITHIN GROUP (ORDER BY matricula_n_cuotas) AS mat_c,
               mode() WITHIN GROUP (ORDER BY arancel_n_cuotas) AS ara_c
        FROM public.mnp_mv_plan_pagos_consolidado
        WHERE periodo_rematricula = %s
          AND matricula_valor IS NOT NULL
          AND arancel_valor IS NOT NULL
        GROUP BY codigo_carrera
        """,
        (PERIODO_REMAT,),
    )
    precios: dict[str, tuple[Decimal, Decimal, int | None, int | None]] = {}
    for row in cur.fetchall():
        precios[row["codigo_carrera"]] = (
            Decimal(str(row["mat"])),
            Decimal(str(row["ara"])),
            int(row["mat_c"]) if row["mat_c"] is not None else 12,
            int(row["ara_c"]) if row["ara_c"] is not None else 10,
        )
    for cod, vals in PRECIO_FALLBACK.items():
        precios.setdefault(cod, vals)
    return precios


def jornada_code(raw: str | None) -> str | None:
    if not raw:
        return None
    t = raw.strip().upper()
    if t in {"D", "V", "S", "AD", "A"}:
        return t
    mapping = {
        "DIURNO": "D",
        "VESPERTINO": "V",
        "SEMIPRESENCIAL": "S",
        "A DISTANCIA": "AD",
        "DISTANCIA": "AD",
    }
    return mapping.get(t, t[:2] if len(t) <= 2 else None)


def build_rows(
    cur,
    excel: dict[str, dict[str, Any]],
    force_vigente: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, int]]:
    cur.execute(
        """
        SELECT codcli_excel AS codcli
        FROM public.mnp_cartera_beneficios
        WHERE periodo = '2027-01' AND fuerza_aplica IS TRUE
        ORDER BY 1
        """
    )
    codclis = [r["codcli"] for r in cur.fetchall()]
    precios = fetch_precios(cur)

    cur.execute(
        """
        SELECT d.*
        FROM public.mnp_datos_alumnos d
        WHERE d.codcli = ANY(%s)
        """,
        (codclis,),
    )
    datos = {r["codcli"]: r for r in cur.fetchall()}

    stats = {
        "total": len(codclis),
        "con_datos": 0,
        "sin_datos": 0,
        "precio_fallback_global": 0,
        "precio_carrera": 0,
    }
    consolidado: list[dict[str, Any]] = []
    progreso: list[dict[str, Any]] = []

    for codcli in codclis:
        d = datos.get(codcli)
        x = excel.get(codcli, {})
        if d:
            stats["con_datos"] += 1
        else:
            stats["sin_datos"] += 1

        carrera = (d or {}).get("codigo_carrera") or x.get("codcarr") or ""
        precio = precios.get(carrera)
        if precio:
            stats["precio_carrera"] += 1
            mat_v, ara_v, mat_c, ara_c = precio
        else:
            stats["precio_fallback_global"] += 1
            mat_v, ara_v, mat_c, ara_c = DEFAULT_MAT, DEFAULT_ARA, 12, 10

        estado_real = (
            ((d or {}).get("estado_academico") or x.get("estacad") or "SUSPENDIDO")
            .strip()
            .upper()
        )
        estado = "VIGENTE" if force_vigente else estado_real

        nombre = x.get("nombre") or None
        ap_pat = x.get("apellido_paterno") or None
        ap_mat = x.get("apellido_materno") or None
        if not nombre and d and d.get("nombre_alumno"):
            parts = str(d["nombre_alumno"]).split()
            if len(parts) >= 3:
                nombre = " ".join(parts[:-2])
                ap_pat = parts[-2]
                ap_mat = parts[-1]
            else:
                nombre = d["nombre_alumno"]

        rut = (d or {}).get("rut_alumno") or x.get("rut")
        rut_ap = (d or {}).get("rut_apoderado") or rut
        nom_ap = (d or {}).get("nombre_apoderado")
        ap_nom, ap_pat_a, ap_mat_a = split_apoderado(nom_ap)

        es_rf = "sin datos"
        if rut and rut_ap:
            es_rf = "S" if rut.replace("-", "").upper() == rut_ap.replace("-", "").upper() else "N"

        prom = x.get("prom")
        try:
            prom_n = Decimal(str(prom)) if prom is not None and prom != "" else None
        except Exception:
            prom_n = None

        jornada = jornada_code((d or {}).get("jornada_carrera") or x.get("jornada"))
        ult = x.get("ult_matricula") or (f"{ANIO_MAT - 2}-2")
        email = (d or {}).get("email_personal") or x.get("mail")
        tel = (d or {}).get("telefono_actual") or (d or {}).get("telefono_proceso")

        row_c: dict[str, Any] = {
            "codcli": codcli,
            "rut_alumno": rut,
            "nombre_alumno": nombre,
            "apellido_paterno_alumno": ap_pat,
            "apellido_materno_alumno": ap_mat,
            "rut_apoderado": rut_ap,
            "nombre_apoderado": ap_nom or nom_ap,
            "apellido_paterno_apoderado": ap_pat_a,
            "apellido_materno_apoderado": ap_mat_a,
            "estado_academico": estado,
            "anio_ingreso": (d or {}).get("anio_ingreso_institucion"),
            "periodo_ingreso": 1,
            "codigo_carrera": carrera or None,
            "nombre_carrera": (d or {}).get("nombre_carrera") or x.get("carrera"),
            "codigo_plan_estudio": (d or {}).get("codigo_plan"),
            "nombre_plan_estudio": (d or {}).get("nombre_plan"),
            "direccion_alumno": (d or {}).get("direccion"),
            "comuna_alumno": (d or {}).get("comuna"),
            "ciudad_alumno": (d or {}).get("ciudad"),
            "email_personal_alumno": email,
            "telefono_alumno": tel,
            "telefono_apoderado": tel if es_rf == "S" else None,
            "discapacidad": "Ninguna",
            "ramos_aprobados": None,
            "ramos_reprobados": None,
            "ultima_matricula": ult,
            "promedio_notas_2025_2": prom_n,
            "promedio_notas_2025": prom_n,
            "matricula_concepto": "MATRICULA",
            "matricula_valor": mat_v,
            "matricula_n_cuotas": mat_c,
            "arancel_concepto": "ARANCEL",
            "arancel_valor": ara_v,
            "arancel_n_cuotas": ara_c,
            "alumno_cae": "No",
            "tiene_beneficio": "Si",
            "beneficio_ano": None,
            "beneficio_periodo": None,
            "cantidad_beneficios": 1,
            "monto_total_beneficios": 0,
            "beneficios_json": "[]",
            "anio_matricula": ANIO_MAT,
            "periodo_matricula": PERIODO_MAT,
            "ultima_situacion": str(x.get("tipositu") or estado_real),
            "periodo_rematricula": PERIODO_REMAT,
            "categoria_alumno": 1 if (x.get("categoria") or "").upper() == "ANTIGUO" else None,
            "jornada_carrera": jornada,
            "es_responsable_financiero": es_rf,
            "telefono_apoder": tel if es_rf == "S" else None,
            "mail_apoder": email if es_rf == "S" else None,
            "fuera_cartera_oficial": False,
        }
        consolidado.append(row_c)

        progreso.append(
            {
                "codcli": codcli,
                "rut": rut,
                "nombre_alumno": nombre,
                "estado_academico": estado,
                "ano_ingreso": (d or {}).get("anio_ingreso_institucion"),
                "periodo_ingreso": 1,
                "cod_carrera": carrera or None,
                "carrera": (d or {}).get("nombre_carrera") or x.get("carrera"),
                "codigo_planestudio": (d or {}).get("codigo_plan"),
                "nombre_planestudios": (d or {}).get("nombre_plan"),
                "direccion": (d or {}).get("direccion"),
                "comuna": (d or {}).get("comuna"),
                "ciudad": (d or {}).get("ciudad"),
                "mail": email,
                "telefono": tel,
                "discapacidad": "Ninguna",
                "ramos_aprobados": None,
                "ramos_reprobados": None,
                "ult_matricula": ult,
                "anio_matricula": ANIO_MAT,
                "periodo_matricula": PERIODO_MAT,
                "apellido_paterno_alumno": ap_pat,
                "apellido_materno_alumno": ap_mat,
                "rut_apoder": rut_ap,
                "nombre_apoderado": ap_nom or nom_ap,
                "apellido_paterno_apoderado": ap_pat_a,
                "apellido_materno_apoderado": ap_mat_a,
                "telefono_apoderado": tel if es_rf == "S" else None,
                "prom_2025_2": prom_n,
                "prom_2025": prom_n,
                "prom_ultimo_periodo": prom_n,
                "prom_anio": prom_n,
            }
        )

    return consolidado, progreso, stats


CONSOLIDADO_COLS = [
    "codcli",
    "rut_alumno",
    "nombre_alumno",
    "apellido_paterno_alumno",
    "apellido_materno_alumno",
    "rut_apoderado",
    "nombre_apoderado",
    "apellido_paterno_apoderado",
    "apellido_materno_apoderado",
    "estado_academico",
    "anio_ingreso",
    "periodo_ingreso",
    "codigo_carrera",
    "nombre_carrera",
    "codigo_plan_estudio",
    "nombre_plan_estudio",
    "direccion_alumno",
    "comuna_alumno",
    "ciudad_alumno",
    "email_personal_alumno",
    "telefono_alumno",
    "telefono_apoderado",
    "discapacidad",
    "ramos_aprobados",
    "ramos_reprobados",
    "ultima_matricula",
    "promedio_notas_2025_2",
    "promedio_notas_2025",
    "matricula_concepto",
    "matricula_valor",
    "matricula_n_cuotas",
    "arancel_concepto",
    "arancel_valor",
    "arancel_n_cuotas",
    "alumno_cae",
    "tiene_beneficio",
    "beneficio_ano",
    "beneficio_periodo",
    "cantidad_beneficios",
    "monto_total_beneficios",
    "beneficios_json",
    "anio_matricula",
    "periodo_matricula",
    "ultima_situacion",
    "periodo_rematricula",
    "categoria_alumno",
    "jornada_carrera",
    "es_responsable_financiero",
    "telefono_apoder",
    "mail_apoder",
    "fuera_cartera_oficial",
]

PROGRESO_COLS = [
    "codcli",
    "rut",
    "nombre_alumno",
    "estado_academico",
    "ano_ingreso",
    "periodo_ingreso",
    "cod_carrera",
    "carrera",
    "codigo_planestudio",
    "nombre_planestudios",
    "direccion",
    "comuna",
    "ciudad",
    "mail",
    "telefono",
    "discapacidad",
    "ramos_aprobados",
    "ramos_reprobados",
    "ult_matricula",
    "anio_matricula",
    "periodo_matricula",
    "apellido_paterno_alumno",
    "apellido_materno_alumno",
    "rut_apoder",
    "nombre_apoderado",
    "apellido_paterno_apoderado",
    "apellido_materno_apoderado",
    "telefono_apoderado",
    "prom_2025_2",
    "prom_2025",
    "prom_ultimo_periodo",
    "prom_anio",
]


def apply_rows(cur, consolidado: list[dict[str, Any]], progreso: list[dict[str, Any]], force_vigente: bool) -> None:
    codclis = [r["codcli"] for r in consolidado]
    cur.execute(
        """
        DELETE FROM public.mnp_mv_plan_pagos_consolidado
        WHERE codcli = ANY(%s) AND periodo_rematricula = %s
        """,
        (codclis, PERIODO_REMAT),
    )
    cur.execute(
        "DELETE FROM public.mnp_mv_alumnos_matricular_periodo WHERE codcli = ANY(%s)",
        (codclis,),
    )

    c_sql = (
        f'INSERT INTO public.mnp_mv_plan_pagos_consolidado ({", ".join(CONSOLIDADO_COLS)}) '
        f'VALUES ({", ".join(["%s"] * len(CONSOLIDADO_COLS))})'
    )
    c_vals = [tuple(r.get(col) for col in CONSOLIDADO_COLS) for r in consolidado]
    execute_batch(cur, c_sql, c_vals, page_size=200)

    p_sql = (
        f'INSERT INTO public.mnp_mv_alumnos_matricular_periodo ({", ".join(PROGRESO_COLS)}) '
        f'VALUES ({", ".join(["%s"] * len(PROGRESO_COLS))})'
    )
    p_vals = [tuple(r.get(col) for col in PROGRESO_COLS) for r in progreso]
    execute_batch(cur, p_sql, p_vals, page_size=200)

    if force_vigente:
        cur.execute(
            """
            UPDATE public.mnp_datos_alumnos
            SET estado_academico = 'VIGENTE'
            WHERE codcli = ANY(%s)
            """,
            (codclis,),
        )

    # Marcar fuera_cartera=false (ya insertados así) y refrescar por si hay otros
    try:
        cur.execute("SELECT public.refresh_fuera_cartera_oficial()")
    except Exception:
        pass


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--excel", default=EXCEL_DEFAULT)
    parser.add_argument("--sheet", default=SHEET_DEFAULT)
    parser.add_argument(
        "--keep-suspendido",
        action="store_true",
        help="No forzar VIGENTE (login MOL quedará bloqueado)",
    )
    args = parser.parse_args()

    if psycopg2 is None:
        print("Falta psycopg2", file=sys.stderr)
        return 1

    force_vigente = not args.keep_suspendido
    excel = load_excel_index(Path(args.excel), args.sheet)
    print(f"Excel index: {len(excel)} filas")

    conn = pg_connect()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            consolidado, progreso, stats = build_rows(cur, excel, force_vigente)
            print("Stats:", stats)
            print(
                f"Filas a cargar: consolidado={len(consolidado)} progreso={len(progreso)} "
                f"force_vigente={force_vigente}"
            )
            if consolidado:
                sample = consolidado[0]
                print(
                    "Sample:",
                    sample["codcli"],
                    sample["estado_academico"],
                    sample["codigo_carrera"],
                    sample["matricula_valor"],
                    sample["arancel_valor"],
                )
            if not args.apply:
                print("Dry-run OK (pasa --apply para escribir)")
                return 0
            apply_rows(cur, consolidado, progreso, force_vigente)
        conn.commit()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                WITH r AS (
                  SELECT codcli_excel AS codcli
                  FROM mnp_cartera_beneficios
                  WHERE periodo='2027-01' AND fuerza_aplica
                )
                SELECT
                  (SELECT count(*) FROM r) AS reintegro,
                  (SELECT count(*) FROM r JOIN mnp_mv_plan_pagos_consolidado c
                     ON c.codcli=r.codcli AND c.periodo_rematricula=%s) AS consolidado,
                  (SELECT count(*) FROM r JOIN mnp_mv_alumnos_matricular_periodo p
                     ON p.codcli=r.codcli) AS progreso,
                  (SELECT count(*) FROM r JOIN mnp_datos_alumnos d ON d.codcli=r.codcli
                     AND upper(btrim(d.estado_academico))='VIGENTE') AS datos_vigente
                """,
                (PERIODO_REMAT,),
            )
            print("Verificación:", dict(cur.fetchone()))
        print("Apply OK")
        return 0
    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
