from mcp.server.fastmcp import FastMCP
from aegis.security.pipeline import AegisSecurityPipeline
from aegis.exasol_client.connection import get_connection
import os

mcp = FastMCP("Aegis-Zero Security Gateway")

@mcp.tool()
def execute_exasol_query(sql_query: str, tenant_id: str = None) -> dict:
    """
    Executes a SQL query against the Exasol database via the Aegis-Zero Security Gateway.
    The query is parsed, verified for safety, and sanitized for exfiltration.
    """
    dsn = os.getenv("EXA_DSN", "localhost:8563")
    user = os.getenv("EXA_USER", "sys")
    password = os.getenv("EXA_PASSWORD", "exasol")
    
    conn = get_connection(dsn, user, password)
    pipeline = AegisSecurityPipeline(conn, tenant_id=tenant_id, limit=500)
    return pipeline.execute(sql_query)
