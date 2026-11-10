#!/usr/bin/env python3
"""Carga reintegros (última matrícula 2025) → cartera oficial + beca_1 forzada.

Por defecto es dry-run. Con --apply escribe en Supabase:
  - mnp_cartera_oficial (faltantes / fuente reintegro)
  - mnp_cartera_beneficios (reemplaza solo slot 1 + fuerza_aplica=true)

Instalar: python3 -m pip install -r scripts/requirements.txt
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

from openpyxl import load_workbook

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None  # type: ignore[assignment]
    RealDictCursor = None  # type: ignore[misc, assignment]

EXCEL_DEFAULT = (
    "/opt/mol-docker/docs/base alumnos/reingresos/"
    "BASE PARA REINTEGROS (2025 ULT MAT).xlsx"
)
SHEET_DEFAULT = "PARA TRABAJO REINTEGRO 2027 (2)"
PERIODO_DEFAULT = "2027-01"
FUENTE = "reintegro_2025_ult_mat"
CATALOG_CSV = os.environ.get(
    "BENEFICIOS_CATALOG_CSV",
    "/opt/mol-docker/docs/becas-beneficios/cod_beneficios_flujos_2027-01.csv",
)


def normalizar_nombre_beca(nombre: str | None) -> str:
    text = unicodedata.normalize("NFKC", nombre or "")
    return " ".join(text.strip().split()).lower()


def es_sin_beca(nombre: str | None) -> bool:
    n = normalizar_nombre_beca(nombre)
    return not n or n in {"sin beca", "-", "n/a"}


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


def parse_pct(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        text = format(value, "f")
    else:
        text = str(value).strip()
    if not text:
        return None
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
    return text or None


def get_dsn() -> str | None:
    dsn = os.environ.get("SUPABASE_PG_URL") or os.environ.get("SUPABASE_DATABASE_URL")
    if dsn:
        return dsn
    host = os.environ.get("SUPABASE_PG_HOST")
    if not host:
        return None
    port = os.environ.get("SUPABASE_PG_PORT", "5432")
    db = os.environ.get("SUPABASE_PG_DB", "postgres")
    user = os.environ.get("SUPABASE_PG_USER", "postgres")
    password = os.environ.get("SUPABASE_PG_PASSWORD", "")
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


# Nombres frecuentes del Excel de reintegros que a veces faltan en el CSV local.
FALLBACK_CODIGOS: list[tuple[str, str]] = [
    ("2047", "Beca Convenio Especial"),
]


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
    rows = cur.fetchall()
    out: list[tuple[str, str]] = []
    for row in rows:
        if isinstance(row, dict):
            out.append((str(row["codigo_beneficio"]), str(row["beneficio"])))
        else:
            out.append((str(row[0]), str(row[1])))
    return out


def load_excel_rows(path: str, sheet: str) -> list[dict[str, Any]]:
    wb = load_workbook(path, data_only=True, read_only=True)
    if sheet not in wb.sheetnames:
        raise SystemExit(f"No existe la hoja {sheet!r} en {path}")
    ws = wb[sheet]
    rows_iter = ws.iter_rows(values_only=True)
    header = [str(c).strip() if c is not None else "" for c in next(rows_iter)]
    idx = {h: i for i, h in enumerate(header)}
    required = ["CODCLI", "RUT", "DIG", "CODCARPR", "DESCRIP_BEN", "%"]
    missing = [name for name in required if name not in idx]
    if missing:
        raise SystemExit(f"Columnas faltantes en Excel: {', '.join(missing)}")

    out: list[dict[str, Any]] = []
    for row in rows_iter:
        if row is None or row[idx["CODCLI"]] is None:
            continue
        codcli = str(row[idx["CODCLI"]]).strip()
        if not codcli:
            continue
        beca1 = cell_text(row[idx["DESCRIP_BEN"]])
        sin1 = es_sin_beca(beca1)
        out.append(
            {
                "codcli_excel": codcli,
                "rut_norm": rut_norm(row[idx["RUT"]], row[idx["DIG"]]),
                "codcarpr": cell_text(row[idx["CODCARPR"]]),
                "beca_1": None if sin1 else beca1,
                "pct_1": None if sin1 else parse_pct(row[idx["%"]]),
            }
        )
    wb.close()
    return out


def enrich(rows: list[dict[str, Any]], catalogo: list[tuple[str, str]]) -> tuple[int, int]:
    matched = unmatched = 0
    for row in rows:
        row["cod_beneficio_1"] = match_cod_beneficio(row["beca_1"], catalogo)
        if row["beca_1"]:
            if row["cod_beneficio_1"]:
                matched += 1
            else:
                unmatched += 1
    return matched, unmatched


def pct_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def same_pct(a: Any, b: Any) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    try:
        return Decimal(str(a)) == Decimal(str(b))
    except Exception:
        return str(a) == str(b)


def classify_diff(existente: dict[str, Any] | None, nuevo: dict[str, Any]) -> str:
    if existente is None:
        return "nuevo"
    if (
        (existente.get("beca_1") or None) == (nuevo.get("beca_1") or None)
        and same_pct(existente.get("pct_1"), nuevo.get("pct_1"))
        and (existente.get("cod_beneficio_1") or None) == (nuevo.get("cod_beneficio_1") or None)
        and bool(existente.get("fuerza_aplica")) is True
    ):
        return "igual"
    return "cambio"


UPSERT_OFICIAL = """
INSERT INTO public.mnp_cartera_oficial (
    rut_norm, rematriculable, fuente, loaded_at, excluido_mol
) VALUES (
    %s, true, %s, now(), false
)
ON CONFLICT (rut_norm) DO UPDATE SET
    rematriculable = EXCLUDED.rematriculable,
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
    %s, %s, NULL, NULL, NULL,
    %s, NULL, true, now()
)
ON CONFLICT (periodo, codcli_excel) DO UPDATE SET
    rut_norm = EXCLUDED.rut_norm,
    codcarpr = COALESCE(EXCLUDED.codcarpr, public.mnp_cartera_beneficios.codcarpr),
    beca_1 = EXCLUDED.beca_1,
    pct_1 = EXCLUDED.pct_1,
    cod_beneficio_1 = EXCLUDED.cod_beneficio_1,
    fuerza_aplica = true,
    loaded_at = now()
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Escribe en la DB (default: dry-run)")
    parser.add_argument("--excel", default=os.environ.get("REINTEGRO_XLSX", EXCEL_DEFAULT))
    parser.add_argument("--sheet", default=os.environ.get("REINTEGRO_SHEET", SHEET_DEFAULT))
    parser.add_argument("--periodo", default=os.environ.get("CARTERA_PERIODO", PERIODO_DEFAULT))
    parser.add_argument(
        "--diff-csv",
        default="/tmp/reintegros_beca1_diff.csv",
        help="Ruta del CSV de comparación beca_1",
    )
    args = parser.parse_args()

    rows = load_excel_rows(args.excel, args.sheet)
    if not rows:
        raise SystemExit("Excel sin filas")

    catalogo = load_catalog_from_csv()
    catalog_source = "csv"
    dsn = get_dsn()
    conn = None
    cur: Any = None

    if dsn and psycopg2 is not None:
        conn = psycopg2.connect(dsn)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        db_catalog = load_catalog_from_db(cur, args.periodo)
        if db_catalog:
            catalogo = db_catalog
            catalog_source = "db"

    matched, unmatched = enrich(rows, catalogo)

    existentes: dict[str, dict[str, Any]] = {}
    oficiales_existentes: set[str] = set()
    if cur is not None:
        codclis = [r["codcli_excel"] for r in rows]
        ruts = [r["rut_norm"] for r in rows]
        cur.execute(
            """
            SELECT codcli_excel, beca_1, pct_1, cod_beneficio_1, fuerza_aplica
            FROM public.mnp_cartera_beneficios
            WHERE periodo = %s AND codcli_excel = ANY(%s)
            """,
            (args.periodo, codclis),
        )
        for row in cur.fetchall():
            existentes[str(row["codcli_excel"])] = dict(row)
        cur.execute(
            "SELECT rut_norm FROM public.mnp_cartera_oficial WHERE rut_norm = ANY(%s)",
            (ruts,),
        )
        oficiales_existentes = {str(r["rut_norm"]) for r in cur.fetchall()}

    diffs: list[dict[str, Any]] = []
    counts = {"nuevo": 0, "cambio": 0, "igual": 0}
    for row in rows:
        prev = existentes.get(row["codcli_excel"])
        kind = classify_diff(prev, row)
        counts[kind] += 1
        diffs.append(
            {
                "estado": kind,
                "codcli_excel": row["codcli_excel"],
                "rut_norm": row["rut_norm"],
                "beca_1_antes": (prev or {}).get("beca_1"),
                "pct_1_antes": pct_str((prev or {}).get("pct_1")),
                "cod_antes": (prev or {}).get("cod_beneficio_1"),
                "beca_1_nuevo": row["beca_1"],
                "pct_1_nuevo": pct_str(row["pct_1"]),
                "cod_nuevo": row["cod_beneficio_1"],
            }
        )

    diff_path = Path(args.diff_csv)
    with diff_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "estado",
                "codcli_excel",
                "rut_norm",
                "beca_1_antes",
                "pct_1_antes",
                "cod_antes",
                "beca_1_nuevo",
                "pct_1_nuevo",
                "cod_nuevo",
            ],
        )
        writer.writeheader()
        writer.writerows(diffs)

    oficial_nuevos = sum(1 for r in rows if r["rut_norm"] not in oficiales_existentes)
    oficial_ya = len(rows) - oficial_nuevos
    unmatched_names = sorted(
        {r["beca_1"] for r in rows if r["beca_1"] and not r["cod_beneficio_1"]}
    )

    print(
        f"rows={len(rows)} matched1={matched} unmatched1={unmatched} "
        f"catalog={catalog_source}({len(catalogo)})"
    )
    print(
        f"oficial_nuevos={oficial_nuevos} oficial_ya={oficial_ya} "
        f"beca1_nuevo={counts['nuevo']} beca1_cambio={counts['cambio']} beca1_igual={counts['igual']}"
    )
    print(f"diff_csv={diff_path}")
    if unmatched_names:
        print("unmatched_beca_1:")
        for name in unmatched_names:
            print(f"  - {name}")

    if not args.apply:
        print("dry-run: no se escribió en DB (pasa --apply)")
        if conn is not None:
            conn.close()
        return

    if cur is None or conn is None:
        raise SystemExit("SUPABASE_PG_URL / psycopg2 requeridos para --apply")

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
                row["cod_beneficio_1"],
            ),
        )
    cur.execute("SELECT public.refresh_fuera_cartera_oficial()")
    fuera = cur.fetchone()
    conn.commit()

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
        (args.periodo, [r["codcli_excel"] for r in rows]),
    )
    n_fuerza = cur.fetchone()["n"]
    cur.close()
    conn.close()
    print(f"applied oficial_fuente={n_fuente} fuerza_aplica={n_fuerza} refresh_fuera={fuera}")


if __name__ == "__main__":
    main()
