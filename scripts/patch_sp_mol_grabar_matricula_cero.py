#!/usr/bin/env python3
"""Permite monto_matricula = 0 en dbo.sp_mol_grabar_plan_pagos (TEST_UNIACC)."""
from __future__ import annotations

import os
import sys

import pymssql


def strip_q(value: str) -> str:
    return value.strip().strip('"').strip("'")


def main() -> int:
    server = os.environ["SQLSERVER_SERVER"]
    user = strip_q(os.environ["SQLSERVER_USERNAME"])
    password = strip_q(os.environ["SQLSERVER_PASSWORD"])
    port = int(os.environ.get("SQLSERVER_PORT", "1433"))
    database = os.environ.get("PATCH_DB", "TEST_UNIACC")

    print(f"connecting {server}:{port}/{database} as {user}")
    conn = pymssql.connect(
        server=server,
        user=user,
        password=password,
        database=database,
        port=port,
        login_timeout=60,
        timeout=120,
    )
    cur = conn.cursor()
    cur.execute("SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.sp_mol_grabar_plan_pagos'))")
    row = cur.fetchone()
    if not row or not row[0]:
        print("SP no encontrado", file=sys.stderr)
        return 1
    sql = row[0]
    print("def_len", len(sql))
    print("has_old", "mayor que cero y arancel no puede" in sql)

    sql2 = sql.replace("CREATE", "ALTER", 1)
    old_lf = (
        "IF @monto_matricula <= 0 OR @monto_arancel < 0\n"
        "        THROW 50002, 'Matrícula tiene que ser mayor que cero y arancel no puede ser negativo.', 1;"
    )
    new_lf = (
        "IF @monto_matricula < 0 OR @monto_arancel < 0\n"
        "        THROW 50002, 'Matrícula y arancel no pueden ser negativos.', 1;"
    )
    old_crlf = old_lf.replace("\n", "\r\n")
    new_crlf = new_lf.replace("\n", "\r\n")

    if old_lf in sql2:
        sql2 = sql2.replace(old_lf, new_lf)
        print("replaced LF")
    elif old_crlf in sql2:
        sql2 = sql2.replace(old_crlf, new_crlf)
        print("replaced CRLF")
    else:
        idx = sql2.find("@monto_matricula")
        print("snippet", repr(sql2[idx : idx + 220]))
        print("pattern not found", file=sys.stderr)
        return 1

    if "mayor que cero y arancel no puede" in sql2:
        print("still has old validation", file=sys.stderr)
        return 1

    cur.execute(sql2)
    conn.commit()
    print("ALTER OK")

    cur.execute("SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.sp_mol_grabar_plan_pagos'))")
    chk = cur.fetchone()[0]
    print("new_ok", "no pueden ser negativos" in chk)
    print("old_gone", "mayor que cero y arancel no puede" not in chk)
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
