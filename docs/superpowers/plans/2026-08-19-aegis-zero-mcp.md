# Aegis-Zero MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Phase 2 of Aegis-Zero (The Agent-Facing MCP Server) and integrate with the live local Docker database.

**Architecture:** AI Agent → Aegis-Zero MCP Server → AegisSecurityPipeline → Live Exasol (Docker).

**Tech Stack:** Python 3, `mcp` SDK, PyExasol.

---

### Task 10: Database Schema & Live Mocking

**Files:**
- Create: `setup_demo_schema.py`

**Interfaces:**
- Connects to: `localhost:8563`
- Produces: Live `AEGIS_DEMO` schema with `CUSTOMERS`, `INVOICES`, `SALARIES`, `FEEDBACK` and test data.

- [ ] **Step 1: Write DB Setup Script**
Write a Python script that uses `pyexasol` to execute the exact schema setup SQL provided in Section 2 of the spec (creating tables and inserting the test data, including the poisoned row).
- [ ] **Step 2: Execute Setup Script**
Run the script to provision the local Docker database.

### Task 11: MCP Server Implementation

**Files:**
- Create: `aegis/mcp/__init__.py`
- Create: `aegis/mcp/server.py`
- Create: `server.py` (entrypoint)

**Interfaces:**
- Produces: `mcp.server.fastmcp.FastMCP` instance wrapping the Security Pipeline.

- [ ] **Step 1: Implement MCP Server Core**
```python
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
```
- [ ] **Step 2: Implement Entrypoint**
Write `server.py` to run the MCP server using standard IO transport.
- [ ] **Step 3: Commit**
Commit the MCP server implementation.

### Task 12: E2E Live Integration Test

**Files:**
- Create: `tests/test_end_to_end.py`

**Interfaces:**
- Consumes: Live Exasol Database
- Tests: Security Pipeline using real DB.

- [ ] **Step 1: Write E2E Tests**
Write the integration tests defined in Checkpoint 3.6 of the spec (running AST regression cases against the live DB, verifying receipts, and tainted row sanitization).
- [ ] **Step 2: Execute Tests**
Run `pytest tests/test_end_to_end.py -v`.
- [ ] **Step 3: Commit**
Commit the E2E tests.
