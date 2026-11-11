#!/usr/bin/env python3
"""Aplica reingresos 2026 desde TSV → oficial + becas fuerza_aplica + VIGENTE.

Por defecto dry-run. Con --apply:
  - mnp_cartera_oficial (fuente=reintegro_2026, rematriculable=true)
  - mnp_cartera_beneficios (beca_1/%/cod desde DESCRIP_BEN, fuerza_aplica=true)
  - alta mínima en mnp_datos_alumnos si falta CODCLI
  - estado_academico=VIGENTE en datos + consolidado 2027-1 + progreso

No toca fuente reintegro_2025_ult_mat.
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
import unicodedata
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None  # type: ignore[assignment]
    RealDictCursor = None  # type: ignore[misc, assignment]

TSV_DEFAULT = (
    "/opt/mol-docker/docs/base alumnos/reingresos/reingresos_2026.tsv"
)
PERIODO_BENEF = "2027-01"
PERIODO_REMAT = "2027-1"
ANIO_MAT = 2027
PERIODO_MAT = 1
FUENTE = "reintegro_2026"
CATALOG_CSV = os.environ.get(
    "BENEFICIOS_CATALOG_CSV",
    "/opt/mol-docker/docs/becas-beneficios/cod_beneficios_flujos_2027-01.csv",
)

FALLBACK_CODIGOS: list[tuple[str, str]] = [
    ("2047", "Beca Convenio Especial"),
]


def normalizar_nombre_beca(nombre: str | None) -> str:
    text = unicodedata.normalize("NFKC", nombre or "")
    return " ".join(text.strip().split()).lower()


def es_sin_beca(nombre: str | None) -> bool:
    n = normalizar_nombre_beca(nombre)
    return not n or n in {"sin beca", "-", "n/a", "#n/d"}


def match_cod_beneficio(
    nombre_excel: str | None,
    catalogo: list[tuple[str, str]],
) -> str | None:
    if es_sin_beca(nombre_excel):
        return None
    target = normalizar_nombre_beca(nombre_excel)
    for codigo, beneficio in catalogo:
        if normalizar_nombre_beca(beneficio) == target:
            return codigo.strip() or None
    return None


def rut_norm(rut: Any, dig: Any) -> str:
    body = "".join(c for c in str(rut) if c.isdigit())
    dv = str(dig).strip().upper()
    return body + dv


def rut_display(rut: Any, dig: Any) -> str:
    body = "".join(c for c in str(rut) if c.isdigit())
    dv = str(dig).strip().upper()
    return f"{body}-{dv}" if body else ""


def parse_pct(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        text = format(value, "f")
    else:
        text = str(value).strip()
    if not text:
        return None
    text = text.replace("%", "").strip()
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        number = Decimal(text).quantize(Decimal("0.01"))
    except InvalidOperation:
        return None
    if Decimal("0") < number <= Decimal("1"):
        number = (number * Decimal("100")).quantize(Decimal("0.01"))
    return number


def cell_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.upper() in {"#N/D", "N/D", "NULL"}:
        return None
    return text


def jornada_code(raw: str | None) -> str | None:
    if not raw:
        return None
    t = raw.strip().upper()
    mapping = {
        "DIURNO": "D",
        "VESPERTINO": "V",
        "SEMIPRESENCIAL": "S",
        "A DISTANCIA": "AD",
        "DISTANCIA": "AD",
        "ADVANCE": "A",
    }
    if t in {"D", "V", "S", "AD", "A"}:
        return t
    return mapping.get(t)


def get_dsn() -> str | None:
    dsn = os.environ.get("SUPABASE_PG_URL") or os.environ.get("SUPABASE_DATABASE_URL")
    if dsn:
        return dsn
    host = os.environ.get("SUPABASE_PG_HOST") or os.environ.get("PGHOST")
    if not host:
        return None
    port = os.environ.get("SUPABASE_PG_PORT") or os.environ.get("PGPORT", "5432")
    db = os.environ.get("SUPABASE_PG_DB") or os.environ.get("PGDATABASE", "postgres")
    user = os.environ.get("SUPABASE_PG_USER") or os.environ.get("PGUSER", "postgres")
    password = (
        os.environ.get("SUPABASE_PG_PASSWORD")
        or os.environ.get("PGPASSWORD", "")
    )
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


def load_catalog_from_csv() -> list[tuple[str, str]]:
    catalog: list[tuple[str, str]] = []
    with open(CATALOG_CSV, newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        next(reader, None)
        for row in reader:
            if len(row) >= 2 and row[0].strip():
                catalog.append((row[0].strip(), row[1].strip()))
    have = {normalizar_nombre_beca(n) for _, n in catalog}
    for codigo, nombre in FALLBACK_CODIGOS:
        if normalizar_nombre_beca(nombre) not in have:
            catalog.append((codigo, nombre))
    return catalog


def load_catalog_from_db(cur: Any, periodo: str) -> list[tuple[str, str]]:
    cur.execute(
        """
        SELECT codigo_beneficio::text, beneficio
        FROM public.mnp_mv_beneficio_periodo
        WHERE periodo = %s
        ORDER BY codigo_beneficio
        """,
        (periodo,),
    )
    out: list[tuple[str, str]] = []
    for row in cur.fetchall():
        out.append((str(row["codigo_beneficio"]), str(row["beneficio"])))
    return out


def col(row: dict[str, str], *names: str) -> str | None:
    for name in names:
        if name in row:
            return cell_text(row.get(name))
        for key in row:
            if key.strip() == name.strip():
                return cell_text(row.get(key))
    return None


def load_tsv_rows(path: Path) -> list[dict[str, Any]]:
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        by_codcli: dict[str, dict[str, Any]] = {}
        for raw in reader:
            codcli = col(raw, "CODCLI")
            if not codcli:
                continue
            beca1 = col(raw, "DESCRIP_BEN")
            sin1 = es_sin_beca(beca1)
            beca2 = col(raw, "DESCRIP_BEN_2", "DESCRIP_BEN2", "BECA_2")
            sin2 = es_sin_beca(beca2)
            pct2_raw = col(raw, "%_2", "PCT_2", "BECA_2_%")
            by_codcli[codcli] = {
                "codcli_excel": codcli,
                "rut_norm": rut_norm(col(raw, "RUT"), col(raw, "DIG")),
                "rut_display": rut_display(col(raw, "RUT"), col(raw, "DIG")),
                "codcarpr": col(raw, "CODCARPR"),
                "carrera": col(raw, "CARRERA"),
                "nombre": col(raw, "NOMBRE"),
                "apellido_pat": col(raw, "APELLIDO PAT"),
                "apellido_mat": col(raw, "APELLIDO MAT"),
                "mail": col(raw, "MAIL"),
                "mail_inst": col(raw, "MAIL INST"),
                "jornada": col(raw, "JORNADA", "JORNADA "),
                "cohorte": col(raw, "COHORTE INGRESO"),
                "beca_1": None if sin1 else beca1,
                "pct_1": None if sin1 else parse_pct(col(raw, "%")),
                "beca_2": None if sin2 else beca2,
                "pct_2": None if sin2 else parse_pct(pct2_raw),
            }
    return list(by_codcli.values())


def enrich(rows: list[dict[str, Any]], catalogo: list[tuple[str, str]]) -> tuple[int, int]:
    matched = unmatched = 0
    for row in rows:
        row["cod_beneficio_1"] = match_cod_beneficio(row["beca_1"], catalogo)
        row["cod_beneficio_2"] = match_cod_beneficio(row["beca_2"], catalogo)
        if row["beca_1"]:
            if row["cod_beneficio_1"]:
                matched += 1
            else:
                unmatched += 1
    return matched, unmatched


UPSERT_OFICIAL = """
INSERT INTO public.mnp_cartera_oficial (
    rut_norm, rematriculable, fuente, loaded_at, excluido_mol
) VALUES (
    %s, true, %s, now(), false
)
ON CONFLICT (rut_norm) DO UPDATE SET
    rematriculable = true,
    fuente = EXCLUDED.fuente,
    excluido_mol = false,
    loaded_at = now()
"""

UPSERT_BENEF = """
INSERT INTO public.mnp_cartera_beneficios (
    periodo, rut_norm, codcli_excel, codcarpr,
    beca_1, pct_1, beca_2, pct_2, consolidado,
    cod_beneficio_1, cod_beneficio_2, fuerza_aplica, loaded_at
) VALUES (
    %s, %s, %s, %s,
    %s, %s, %s, %s, NULL,
    %s, %s, true, now()
)
ON CONFLICT (periodo, codcli_excel) DO UPDATE SET
    rut_norm = EXCLUDED.rut_norm,
    codcarpr = COALESCE(EXCLUDED.codcarpr, public.mnp_cartera_beneficios.codcarpr),
    beca_1 = EXCLUDED.beca_1,
    pct_1 = EXCLUDED.pct_1,
    beca_2 = EXCLUDED.beca_2,
    pct_2 = EXCLUDED.pct_2,
    cod_beneficio_1 = EXCLUDED.cod_beneficio_1,
    cod_beneficio_2 = EXCLUDED.cod_beneficio_2,
    fuerza_aplica = true,
    loaded_at = now()
"""

INSERT_DATOS = """
INSERT INTO public.mnp_datos_alumnos (
    codcli, rut_alumno, nombre_alumno, codigo_carrera, nombre_carrera,
    jornada_carrera, estado_academico, email_personal, email_institucional,
    anio_ingreso_institucion, tipo_carrera, rut_apoderado, nombre_apoderado
) VALUES (
    %s, %s, %s, %s, %s,
    %s, 'VIGENTE', %s, %s,
    %s, 'PREGRADO', %s, %s
)
"""


def nombre_completo(row: dict[str, Any]) -> str:
    parts = [row.get("nombre"), row.get("apellido_pat"), row.get("apellido_mat")]
    return " ".join(p for p in parts if p).strip()


def apply_missing_datos(cur: Any, rows: list[dict[str, Any]]) -> list[str]:
    codclis = [r["codcli_excel"] for r in rows]
    cur.execute(
        "SELECT codcli FROM public.mnp_datos_alumnos WHERE codcli = ANY(%s)",
        (codclis,),
    )
    have = {str(r["codcli"]) for r in cur.fetchall()}
    missing = [r for r in rows if r["codcli_excel"] not in have]
    created: list[str] = []
    for row in missing:
        anio = None
        if row.get("cohorte") and str(row["cohorte"]).isdigit():
            anio = int(row["cohorte"])
        cur.execute(
            INSERT_DATOS,
            (
                row["codcli_excel"],
                row["rut_display"],
                nombre_completo(row) or None,
                row.get("codcarpr"),
                row.get("carrera"),
                jornada_code(row.get("jornada")),
                row.get("mail"),
                row.get("mail_inst"),
                anio,
                row["rut_display"],
                nombre_completo(row) or None,
            ),
        )
        created.append(row["codcli_excel"])
    return created


def force_vigente(cur: Any, codclis: list[str]) -> None:
    cur.execute(
        """
        UPDATE public.mnp_datos_alumnos
        SET estado_academico = 'VIGENTE'
        WHERE codcli = ANY(%s)
        """,
        (codclis,),
    )
    cur.execute(
        """
        UPDATE public.mnp_mv_plan_pagos_consolidado
        SET estado_academico = 'VIGENTE'
        WHERE codcli = ANY(%s)
          AND periodo_rematricula = %s
        """,
        (codclis, PERIODO_REMAT),
    )
    cur.execute(
        """
        UPDATE public.mnp_mv_alumnos_matricular_periodo
        SET estado_academico = 'VIGENTE'
        WHERE codcli = ANY(%s)
          AND anio_matricula = %s
          AND periodo_matricula = %s
        """,
        (codclis, ANIO_MAT, PERIODO_MAT),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--tsv", default=os.environ.get("REINGRESOS_2026_TSV", TSV_DEFAULT))
    parser.add_argument("--periodo", default=PERIODO_BENEF)
    args = parser.parse_args()

    if psycopg2 is None:
        print("Falta psycopg2", file=sys.stderr)
        return 1

    path = Path(args.tsv)
    if not path.is_file():
        print(f"No existe TSV: {path}", file=sys.stderr)
        return 1

    rows = load_tsv_rows(path)
    if not rows:
        print("TSV sin filas", file=sys.stderr)
        return 1

    catalogo = load_catalog_from_csv()
    catalog_source = "csv"
    dsn = get_dsn()
    if not dsn:
        print("Falta SUPABASE_PG_* / PG* DSN", file=sys.stderr)
        return 1

    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            db_catalog = load_catalog_from_db(cur, args.periodo)
            if db_catalog:
                catalogo = db_catalog
                catalog_source = "db"
            matched, unmatched = enrich(rows, catalogo)
            unmatched_names = sorted(
                {r["beca_1"] for r in rows if r["beca_1"] and not r["cod_beneficio_1"]}
            )

            codclis = [r["codcli_excel"] for r in rows]
            cur.execute(
                "SELECT codcli FROM public.mnp_datos_alumnos WHERE codcli = ANY(%s)",
                (codclis,),
            )
            have_datos = {str(r["codcli"]) for r in cur.fetchall()}
            faltan_datos = [c for c in codclis if c not in have_datos]

            cur.execute(
                """
                SELECT codcli FROM public.mnp_mv_plan_pagos_consolidado
                WHERE periodo_rematricula = %s AND codcli = ANY(%s)
                """,
                (PERIODO_REMAT, codclis),
            )
            have_consol = {str(r["codcli"]) for r in cur.fetchall()}
            faltan_consol = [c for c in codclis if c not in have_consol]

            print(
                f"rows={len(rows)} matched1={matched} unmatched1={unmatched} "
                f"catalog={catalog_source}({len(catalogo)})"
            )
            print(
                f"faltan_datos={len(faltan_datos)} {faltan_datos[:10]} "
                f"faltan_consol={len(faltan_consol)} {faltan_consol[:10]}"
            )
            if unmatched_names:
                print("unmatched_beca_1:")
                for name in unmatched_names:
                    print(f"  - {name}")

            if not args.apply:
                print("dry-run: no se escribió en DB (pasa --apply)")
                return 0

            for row in rows:
                cur.execute(UPSERT_OFICIAL, (row["rut_norm"], FUENTE))
            for row in rows:
                cur.execute(
                    UPSERT_BENEF,
                    (
                        args.periodo,
                        row["rut_norm"],
                        row["codcli_excel"],
                        row["codcarpr"],
                        row["beca_1"],
                        row["pct_1"],
                        row["beca_2"],
                        row["pct_2"],
                        row["cod_beneficio_1"],
                        row["cod_beneficio_2"],
                    ),
                )
            created = apply_missing_datos(cur, rows)
            force_vigente(cur, codclis)
            try:
                cur.execute("SELECT public.refresh_fuera_cartera_oficial()")
                fuera = cur.fetchone()
            except Exception:
                fuera = None

        conn.commit()

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT count(*) AS n FROM public.mnp_cartera_oficial WHERE fuente = %s",
                (FUENTE,),
            )
            n_fuente = cur.fetchone()["n"]
            cur.execute(
                """
                SELECT count(*) AS n
                FROM public.mnp_cartera_beneficios
                WHERE periodo = %s AND fuerza_aplica IS TRUE
                  AND codcli_excel = ANY(%s)
                """,
                (args.periodo, codclis),
            )
            n_fuerza = cur.fetchone()["n"]
            cur.execute(
                """
                SELECT count(*) AS n FROM public.mnp_datos_alumnos
                WHERE codcli = ANY(%s) AND upper(btrim(estado_academico)) = 'VIGENTE'
                """,
                (codclis,),
            )
            n_vig = cur.fetchone()["n"]
            cur.execute(
                """
                SELECT beca_1, pct_1, cod_beneficio_1, fuerza_aplica
                FROM public.mnp_cartera_beneficios
                WHERE periodo = %s AND codcli_excel = '20261CDDV1DR011'
                """,
                (args.periodo,),
            )
            vanessa_b = cur.fetchone()
            cur.execute(
                """
                SELECT codcli, estado_academico, rut_alumno
                FROM public.mnp_datos_alumnos WHERE codcli = '20261CDDV1DR011'
                """
            )
            vanessa_d = cur.fetchone()

        print(
            f"applied fuente={FUENTE} n_fuente={n_fuente} fuerza_aplica={n_fuerza} "
            f"datos_vigente={n_vig} created_datos={created} refresh_fuera={fuera}"
        )
        print(f"vanessa_benef={dict(vanessa_b) if vanessa_b else None}")
        print(f"vanessa_datos={dict(vanessa_d) if vanessa_d else None}")
        if faltan_consol:
            print(
                "WARN: sin consolidado 2027-1 (no recreado aquí):",
                faltan_consol,
                file=sys.stderr,
            )
        return 0
    except Exception as exc:
        conn.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
