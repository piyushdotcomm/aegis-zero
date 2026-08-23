from fastmcp import FastMCP
from aegis.core.config import SecurityPolicy
from aegis.security.pipeline import AegisSecurityPipeline
from aegis.provenance.signer import CryptographicReceiptMint, to_jsonable
from aegis.exasol_client.connection import get_connection
import os

mcp = FastMCP("Aegis-Zero Security Gateway")

# Stable gateway key — persists across tool calls within a server session
_gateway_mint = CryptographicReceiptMint()
_policy = SecurityPolicy()


@mcp.tool()
def execute_exasol_query(sql_query: str, tenant_id: str = "tenant_alpha") -> dict:
    """
    Execute a SQL query against Exasol through the Aegis-Zero Security Gateway.

    The query is parsed via AST, validated for safety (read-only, tenant isolation,
    catalog protection), sanitized for prompt injection in returned data, and
    accompanied by a cryptographic action receipt.
    """
    dsn = os.getenv("EXA_DSN", "localhost:8563")
    user = os.getenv("EXA_USER", "sys")
    password = os.getenv("EXA_PASSWORD", "exasol")
    schema = os.getenv("EXA_SCHEMA", "AEGIS_DEMO")
    policy_version = os.getenv("AEGIS_POLICY_VERSION", "1.0.0")

    conn = get_connection(dsn, user, password, schema)
    try:
        pipeline = AegisSecurityPipeline(
            connection=conn,
            tenant_id=tenant_id,
            policy=_policy,
            mint=_gateway_mint,
            policy_version=policy_version,
            schema=schema,
        )
        return pipeline.execute(sql_query)
    finally:
        conn.close()


@mcp.tool()
def execute_unprotected_query(sql_query: str) -> dict:
    """
    DEMO ONLY — Execute raw SQL without Aegis-Zero security protections.

    Runs the query inside a transaction that is ALWAYS rolled back, so the demo
    database state is never permanently altered. This tool exists solely to
    demonstrate what an unprotected AI agent could do.
    """
    dsn = os.getenv("EXA_DSN", "localhost:8563")
    user = os.getenv("EXA_USER", "sys")
    password = os.getenv("EXA_PASSWORD", "exasol")
    schema = os.getenv("EXA_SCHEMA", "AEGIS_DEMO")

    conn = get_connection(dsn, user, password, schema)
    try:
        conn.set_autocommit(False)
        stmt = conn.execute(sql_query)
        rows = []
        try:
            rows = to_jsonable(stmt.fetchall())
        except Exception:
            rows = []
        row_count = len(rows)
        conn.rollback()
        return {
            "executed": True,
            "rolled_back": True,
            "sql": sql_query,
            "rows": rows,
            "row_count": row_count,
        }
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        return {
            "executed": False,
            "rolled_back": True,
            "sql": sql_query,
            "error": str(e),
            "rows": [],
            "row_count": 0,
        }
    finally:
        conn.close()
