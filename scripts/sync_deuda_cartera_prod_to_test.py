#!/usr/bin/env python3
"""Sincroniza tablas de deuda U+ PROD → TEST para la cartera Rematrícula 2027-1.

Cubre lo que lee ``dbo.sp_alumno_deuda_net`` (@Opcion=124, bloqueo INTERNA):

- ``MT_CTADOC``  — documentos / saldos del alumno (reemplazo completo por CODCLI)
- ``MT_CLIENT``  — ``DESBL_TOMARAMOS``, ``DEUDA_BIBLIOTECA`` (UPDATE)
- ``MT_DOCUM``   — catálogo ``PROTESTO`` / ``DOCRESPALDO`` (MERGE opcional)

Fuente de RUTs (default Excel Rematriculable):
  docs/becas-beneficios/BASE PARA PRUEBA.xlsx
  → CODCLI U+ = cuerpo RUT sin DV

Uso:
  # Dry-run (solo cuenta)
  scripts/.venv/bin/python scripts/sync_deuda_cartera_prod_to_test.py

  # Aplicar
  scripts/.venv/bin/python scripts/sync_deuda_cartera_prod_to_test.py --apply

  # Solo 50 alumnos (prueba)
  scripts/.venv/bin/python scripts/sync_deuda_cartera_prod_to_test.py --apply --limit 50

Credenciales: /opt/uniacc-api-docker/.env (DB_* y DB_*_TEST) o variables de entorno.
Cartera Supabase (opcional): SUPABASE_PG_URL + --source supabase
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Iterable, Sequence

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEFAULT_EXCEL = REPO_ROOT / "docs/becas-beneficios/BASE PARA PRUEBA.xlsx"
DEFAULT_ENV = Path("/opt/uniacc-api-docker/.env")
BATCH = 200


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        key, _, val = s.partition("=")
        key = key.strip()
        val = val.strip().strip("'").strip('"')
        os.environ.setdefault(key, val)


def require_pymssql():
    try:
        import pymssql  # noqa: F401
    except ImportError:
        print(
            "Falta pymssql. Crea el venv:\n"
            "  python3 -m venv scripts/.venv\n"
            "  scripts/.venv/bin/pip install -r scripts/requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)
    import pymssql

    return pymssql


def mssql_connect(pymssql, *, server: str, user: str, password: str, database: str, port: int):
    return pymssql.connect(
        server=server,
        user=user,
        password=password,
        database=database,
        port=port,
        login_timeout=30,
        timeout=0,
        charset="UTF-8",
    )


def chunks(items: Sequence, size: int) -> Iterable[list]:
    for i in range(0, len(items), size):
        yield list(items[i : i + size])


def sql_in_list(values: Sequence[str]) -> str:
    return ",".join("'" + v.replace("'", "''") + "'" for v in values)


def load_codcli_from_excel(path: Path, *, solo_rematriculable: bool) -> list[str]:
    from openpyxl import load_workbook

    wb = load_workbook(path, data_only=True, read_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(c).strip() if c is not None else "" for c in next(rows)]
    # COHORTE header may have trailing space in file; strip already applied
    idx = {h: i for i, h in enumerate(header)}
    for required in ("RUT", "DIG"):
        if required not in idx:
            raise SystemExit(f"Excel sin columna {required}: {path}")
    estado_key = "ESTADO NO MOVER AL 03/09"
    seen: set[str] = set()
    ordered: list[str] = []
    for row in rows:
        if row is None or row[idx["RUT"]] is None:
            continue
        if solo_rematriculable and estado_key in idx:
            estado = str(row[idx[estado_key]] or "").strip()
            if estado != "Rematriculable":
                continue
        body = "".join(c for c in str(row[idx["RUT"]]) if c.isdigit())
        if not body or body in seen:
            continue
        seen.add(body)
        ordered.append(body)
    wb.close()
    return ordered


def load_codcli_from_supabase(*, solo_rematriculable: bool) -> list[str]:
    try:
        import psycopg2
    except ImportError as e:
        raise SystemExit("psycopg2 no instalado") from e

    dsn = os.environ.get("SUPABASE_PG_URL") or os.environ.get("SUPABASE_DATABASE_URL")
    if not dsn:
        raise SystemExit("SUPABASE_PG_URL no definido para --source supabase")

    sql = "SELECT rut_norm FROM public.mnp_cartera_oficial"
    clauses: list[str] = []
    if solo_rematriculable:
        clauses.append("rematriculable = true")
    clauses.append("COALESCE(excluido_mol, false) = false")
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)

    conn = psycopg2.connect(dsn)
    try:
        cur = conn.cursor()
        cur.execute(sql)
        out: list[str] = []
        seen: set[str] = set()
        for (rut_norm,) in cur.fetchall():
            rn = str(rut_norm).strip().upper()
            # rut_norm = cuerpo + DV → CODCLI U+ = cuerpo
            body = rn[:-1] if len(rn) > 1 else rn
            body = "".join(c for c in body if c.isdigit())
            if body and body not in seen:
                seen.add(body)
                out.append(body)
        return out
    finally:
        conn.close()


def fetch_ctadoc_columns(cur) -> list[str]:
    cur.execute(
        """
        SELECT c.name
        FROM sys.columns c
        WHERE c.object_id = OBJECT_ID('dbo.MT_CTADOC')
        ORDER BY c.column_id
        """
    )
    return [r[0] for r in cur.fetchall()]


def count_ctadoc(cur, codclis: Sequence[str]) -> int:
    total = 0
    for batch in chunks(list(codclis), BATCH):
        cur.execute(
            f"SELECT COUNT(*) FROM dbo.MT_CTADOC WHERE CODCLI IN ({sql_in_list(batch)})"
        )
        total += int(cur.fetchone()[0])
    return total


def fetch_client_flags(cur, codclis: Sequence[str]) -> dict[str, tuple[object, object]]:
    out: dict[str, tuple[object, object]] = {}
    for batch in chunks(list(codclis), BATCH):
        cur.execute(
            f"""
            SELECT CODCLI, DESBL_TOMARAMOS, DEUDA_BIBLIOTECA
            FROM dbo.MT_CLIENT
            WHERE CODCLI IN ({sql_in_list(batch)})
            """
        )
        for codcli, desbl, biblio in cur.fetchall():
            out[str(codcli).strip()] = (desbl, biblio)
    return out


def sync_mt_parcaja_for_ctadoc(
    conn_test,
    cur_prod,
    cur_test,
    codclis: Sequence[str],
    *,
    apply: bool,
) -> tuple[int, int]:
    """Inserta en TEST filas MT_PARCAJA (CAJA, FECHA) referenciadas por CTADOC.Prod."""
    pairs: set[tuple[int, object]] = set()
    for batch in chunks(list(codclis), BATCH):
        cur_prod.execute(
            f"""
            SELECT DISTINCT CAJA, FECREG
            FROM dbo.MT_CTADOC
            WHERE CODCLI IN ({sql_in_list(batch)})
              AND CAJA IS NOT NULL
              AND FECREG IS NOT NULL
            """
        )
        for caja, fecreg in cur_prod.fetchall():
            pairs.add((int(caja), fecreg))

    cur_test.execute("SELECT CAJA, FECHA FROM dbo.MT_PARCAJA")
    existing = {(int(c), f) for c, f in cur_test.fetchall()}
    missing = [(c, f) for c, f in pairs if (c, f) not in existing]

    if not apply or not missing:
        return len(pairs), len(missing)

    cur_prod.execute(
        """
        SELECT c.name
        FROM sys.columns c
        WHERE c.object_id = OBJECT_ID('dbo.MT_PARCAJA')
        ORDER BY c.column_id
        """
    )
    cols = [r[0] for r in cur_prod.fetchall()]
    col_list = ", ".join(f"[{c}]" for c in cols)
    placeholders = ", ".join(["%s"] * len(cols))
    insert_sql = f"INSERT INTO dbo.MT_PARCAJA ({col_list}) VALUES ({placeholders})"

    inserted = 0
    for caja, fecreg in missing:
        cur_prod.execute(
            f"SELECT {col_list} FROM dbo.MT_PARCAJA WHERE CAJA = %s AND FECHA = %s",
            (caja, fecreg),
        )
        row = cur_prod.fetchone()
        if not row:
            continue
        try:
            cur_test.execute(insert_sql, row)
            inserted += 1
        except Exception as e:  # noqa: BLE001
            print(f"  WARN MT_PARCAJA CAJA={caja} FECHA={fecreg}: {e}", flush=True)
        if inserted % 50 == 0:
            conn_test.commit()
    conn_test.commit()
    return len(pairs), inserted


def set_ctadoc_parcaja_fk(cur_test, *, enabled: bool) -> None:
    """FK compuesta (CAJA,FECREG)->MT_PARCAJA; en TEST suele faltar historial de cajas."""
    if enabled:
        cur_test.execute(
            "ALTER TABLE dbo.MT_CTADOC WITH NOCHECK CHECK CONSTRAINT FK_MT_CTADOC_MT_PARCAJA"
        )
    else:
        cur_test.execute(
            "ALTER TABLE dbo.MT_CTADOC NOCHECK CONSTRAINT FK_MT_CTADOC_MT_PARCAJA"
        )


def sync_mt_docum(cur_prod, cur_test, *, apply: bool) -> tuple[int, int]:
    cur_prod.execute(
        """
        SELECT TIPODOC, PROTESTO, DOCRESPALDO
        FROM dbo.MT_DOCUM
        """
    )
    rows = cur_prod.fetchall()
    if not apply:
        return len(rows), 0
    updated = 0
    for tipodoc, protesto, docrespaldo in rows:
        cur_test.execute(
            """
            UPDATE dbo.MT_DOCUM
            SET PROTESTO = %s, DOCRESPALDO = %s
            WHERE TIPODOC = %s
              AND (
                    ISNULL(PROTESTO, '') <> ISNULL(%s, '')
                 OR ISNULL(DOCRESPALDO, '') <> ISNULL(%s, '')
              )
            """,
            (protesto, docrespaldo, tipodoc, protesto, docrespaldo),
        )
        updated += cur_test.rowcount
    return len(rows), updated


def delete_ctadoc_test(conn_test, cur_test, codclis: Sequence[str]) -> int:
    deleted = 0
    for batch in chunks(list(codclis), BATCH):
        cur_test.execute(
            f"DELETE FROM dbo.MT_CTADOC WHERE CODCLI IN ({sql_in_list(batch)})"
        )
        deleted += cur_test.rowcount
        conn_test.commit()
        print(f"  delete batch CODCLI={len(batch)} deleted_total={deleted}", flush=True)
    return deleted


def insert_ctadoc_from_prod(
    conn_test,
    cur_prod,
    cur_test,
    codclis: Sequence[str],
    columns: Sequence[str],
) -> int:
    col_list = ", ".join(f"[{c}]" for c in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    insert_sql = f"INSERT INTO dbo.MT_CTADOC ({col_list}) VALUES ({placeholders})"
    inserted = 0

    cur_test.execute("SET IDENTITY_INSERT dbo.MT_CTADOC ON")
    conn_test.commit()
    try:
        for batch in chunks(list(codclis), BATCH):
            cur_prod.execute(
                f"SELECT {col_list} FROM dbo.MT_CTADOC WHERE CODCLI IN ({sql_in_list(batch)})"
            )
            rows = cur_prod.fetchall()
            if not rows:
                continue
            # pymssql executemany
            cur_test.executemany(insert_sql, rows)
            inserted += len(rows)
            conn_test.commit()
            print(f"  insert batch CODCLI={len(batch)} rows={len(rows)} inserted_total={inserted}", flush=True)
    finally:
        cur_test.execute("SET IDENTITY_INSERT dbo.MT_CTADOC OFF")
        conn_test.commit()
    return inserted


def update_client_flags(
    conn_test,
    cur_test,
    flags: dict[str, tuple[object, object]],
) -> tuple[int, int]:
    updated = 0
    missing = 0
    keys = list(flags.items())
    for batch in chunks(keys, BATCH):
        for codcli, (desbl, biblio) in batch:
            cur_test.execute(
                """
                UPDATE dbo.MT_CLIENT
                SET DESBL_TOMARAMOS = %s,
                    DEUDA_BIBLIOTECA = %s
                WHERE CODCLI = %s
                """,
                (desbl, biblio, codcli),
            )
            if cur_test.rowcount:
                updated += 1
            else:
                missing += 1
        conn_test.commit()
    return updated, missing


def verify_sp(cur, rut: str, feccaja: str) -> object:
    cur.execute(
        """
        EXEC dbo.sp_alumno_deuda_net
            @RUT = %s,
            @FECCAJA = %s,
            @NoMostrar = 0,
            @Opcion = 124
        """,
        (rut, feccaja),
    )
    row = cur.fetchone()
    return row[0] if row else None


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--apply", action="store_true", help="Escribe en TEST (default: dry-run)")
    p.add_argument(
        "--source",
        choices=("excel", "supabase"),
        default="excel",
        help="Origen de la cartera (default: excel Rematriculable)",
    )
    p.add_argument("--excel", type=Path, default=DEFAULT_EXCEL)
    p.add_argument(
        "--todas",
        action="store_true",
        help="Incluye no-Rematriculable / rematriculable=false",
    )
    p.add_argument("--limit", type=int, default=0, help="Limita N CODCLI (prueba)")
    p.add_argument("--skip-docum", action="store_true", help="No sincroniza MT_DOCUM")
    p.add_argument("--skip-ctadoc", action="store_true")
    p.add_argument("--skip-client", action="store_true")
    p.add_argument(
        "--verify-rut",
        action="append",
        default=[],
        help="Tras sync, compara SP deuda Prod vs Test (CODCLI sin DV). Repetible.",
    )
    p.add_argument("--env-file", type=Path, default=DEFAULT_ENV)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    load_dotenv(args.env_file)
    pymssql = require_pymssql()

    solo = not args.todas
    if args.source == "excel":
        codclis = load_codcli_from_excel(args.excel, solo_rematriculable=solo)
        src_label = f"excel:{args.excel.name}"
    else:
        codclis = load_codcli_from_supabase(solo_rematriculable=solo)
        src_label = "supabase:mnp_cartera_oficial"

    if args.limit and args.limit > 0:
        codclis = codclis[: args.limit]

    print(f"source={src_label} codcli={len(codclis)} solo_rematriculable={solo}")
    if not codclis:
        print("Sin CODCLI; nada que hacer", file=sys.stderr)
        return 1

    prod = {
        "server": os.environ["DB_SERVER"],
        "user": os.environ["DB_USER"],
        "password": os.environ["DB_PASSWORD"],
        "database": os.environ.get("DB_DATABASE", "UNIACC"),
        "port": int(os.environ.get("DB_PORT", "1433")),
    }
    test = {
        "server": os.environ["DB_SERVER_TEST"],
        "user": os.environ.get("DB_USER_TEST", os.environ["DB_USER"]),
        "password": os.environ.get("DB_PASSWORD_TEST", os.environ["DB_PASSWORD"]),
        "database": os.environ.get("DB_DATABASE_TEST", "TEST_UNIACC"),
        "port": int(os.environ.get("DB_PORT_TEST", os.environ.get("DB_PORT", "1433"))),
    }

    conn_prod = mssql_connect(pymssql, **prod)
    conn_test = mssql_connect(pymssql, **test)
    cur_prod = conn_prod.cursor()
    cur_test = conn_test.cursor()

    try:
        n_prod = count_ctadoc(cur_prod, codclis)
        n_test_before = count_ctadoc(cur_test, codclis)
        print(f"MT_CTADOC prod={n_prod} test_before={n_test_before}")

        if not args.skip_docum:
            n_doc, n_upd = sync_mt_docum(cur_prod, cur_test, apply=args.apply)
            if args.apply:
                conn_test.commit()
            print(f"MT_DOCUM catalogo={n_doc} updated={n_upd if args.apply else '(dry-run)'}")

        flags = {} if args.skip_client else fetch_client_flags(cur_prod, codclis)
        if flags:
            print(f"MT_CLIENT flags_prod={len(flags)}")

        if not args.apply:
            print("dry-run OK — reejecuta con --apply para escribir en TEST")
        else:
            if not args.skip_ctadoc:
                # Evita FK (CAJA,FECREG)->MT_PARCAJA por historial de cajas ausente en TEST
                set_ctadoc_parcaja_fk(cur_test, enabled=False)
                conn_test.commit()
                print("FK_MT_CTADOC_MT_PARCAJA NOCHECK", flush=True)

                n_pairs, n_parcaja = sync_mt_parcaja_for_ctadoc(
                    conn_test, cur_prod, cur_test, codclis, apply=True
                )
                print(
                    f"MT_PARCAJA pairs_ref={n_pairs} inserted_missing={n_parcaja}",
                    flush=True,
                )

                deleted = delete_ctadoc_test(conn_test, cur_test, codclis)
                print(f"MT_CTADOC deleted_test={deleted}")
                cols = fetch_ctadoc_columns(cur_prod)
                inserted = insert_ctadoc_from_prod(
                    conn_test, cur_prod, cur_test, codclis, cols
                )
                print(f"MT_CTADOC inserted_test={inserted}")
                n_test_after = count_ctadoc(cur_test, codclis)
                print(f"MT_CTADOC test_after={n_test_after}")
                if n_test_after != n_prod:
                    print(
                        f"WARN: conteo Test ({n_test_after}) != Prod ({n_prod})",
                        file=sys.stderr,
                    )
                # Re-habilita la FK sin validar filas históricas ya insertadas
                set_ctadoc_parcaja_fk(cur_test, enabled=True)
                conn_test.commit()
                print("FK_MT_CTADOC_MT_PARCAJA WITH NOCHECK CHECK", flush=True)

            if flags:
                updated, missing = update_client_flags(conn_test, cur_test, flags)
                print(f"MT_CLIENT updated={updated} missing_in_test={missing}")

            print("commit TEST OK")

        if args.verify_rut:
            from datetime import date

            fec = date.today().isoformat() + "T00:00:00"
            for rut in args.verify_rut:
                body = "".join(c for c in rut if c.isdigit() or c.upper() == "K")
                # si viene con DV, quitar último char no numérico o último dígito DV
                if body[-1:].upper() == "K" or (
                    len(body) > 7 and body.isdigit() and body not in codclis
                ):
                    # rut_norm style: strip DV
                    if not body.isdigit():
                        body = body[:-1]
                    elif body not in set(codclis) and body[:-1] in set(codclis):
                        body = body[:-1]
                try:
                    d_prod = verify_sp(cur_prod, body, fec)
                except Exception as e:  # noqa: BLE001
                    d_prod = f"ERR:{e}"
                try:
                    d_test = verify_sp(cur_test, body, fec)
                except Exception as e:  # noqa: BLE001
                    d_test = f"ERR:{e}"
                print(f"verify SP @Opcion=124 CODCLI={body} PROD={d_prod} TEST={d_test}")

    except Exception:
        if args.apply:
            conn_test.rollback()
            print("rollback TEST por error", file=sys.stderr)
        raise
    finally:
        cur_prod.close()
        cur_test.close()
        conn_prod.close()
        conn_test.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
