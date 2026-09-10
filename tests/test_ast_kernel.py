import pytest
from aegis.ast_kernel.invariants import ASTInvariantKernel, AegisBlockError

DEMO_PROTECTED = {"customers", "invoices", "salaries", "feedback"}


# ──────────────────────────────────────────────
# Legacy tests (backward-compatible)
# ──────────────────────────────────────────────

def test_ast_kernel_read_only():
    kernel = ASTInvariantKernel()

    with pytest.raises(ValueError, match="Query is not read-only"):
        kernel.transform("DROP TABLE my_table")

    with pytest.raises(ValueError, match="Query is not read-only"):
        kernel.transform("UPDATE users SET name = 'admin'")

    with pytest.raises(ValueError, match="Query is not read-only"):
        kernel.transform("DELETE FROM users")


def test_ast_kernel_tenant_isolation():
    kernel = ASTInvariantKernel(tenant_id="tenant_123")

    query = "SELECT * FROM data_table"
    transformed = kernel.transform(query)
    assert "tenant_id = 'tenant_123'" in transformed.lower()

    query_with_where = "SELECT * FROM data_table WHERE id = 1"
    transformed2 = kernel.transform(query_with_where)
    assert "tenant_id = 'tenant_123'" in transformed2.lower()
    assert "id = 1" in transformed2.lower()


def test_ast_kernel_blast_radius():
    kernel = ASTInvariantKernel(limit=100)

    query = "SELECT * FROM my_table"
    transformed = kernel.transform(query)
    assert "limit 100" in transformed.lower()


def test_ast_kernel_combined():
    kernel = ASTInvariantKernel(tenant_id="t1", limit=50)
    query = "SELECT name FROM users"
    transformed = kernel.transform(query)
    assert "tenant_id = 't1'" in transformed.lower()
    assert "limit 50" in transformed.lower()


# ──────────────────────────────────────────────
# Structured error codes
# ──────────────────────────────────────────────

def test_block_error_has_code():
    kernel = ASTInvariantKernel()

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("DROP TABLE my_table")
    assert exc_info.value.code == "MUTATION_BLOCKED"
    assert exc_info.value.hint != ""


def test_catalog_snooping_code():
    kernel = ASTInvariantKernel()

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("SELECT * FROM EXA_ALL_USERS")
    assert exc_info.value.code == "CATALOG_SNOOPING_BLOCKED"


# ──────────────────────────────────────────────
# Multi-statement attacks
# ──────────────────────────────────────────────

def test_multi_statement_blocked():
    kernel = ASTInvariantKernel()

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("SELECT 1; DROP TABLE CUSTOMERS")
    assert exc_info.value.code == "MULTI_STATEMENT_BLOCKED"


def test_multi_statement_semicolon_select():
    kernel = ASTInvariantKernel()

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("SELECT 1; SELECT 2")
    assert exc_info.value.code == "MULTI_STATEMENT_BLOCKED"


# ──────────────────────────────────────────────
# SET operations (UNION, INTERSECT, EXCEPT)
# ──────────────────────────────────────────────

def test_union_blocked():
    kernel = ASTInvariantKernel(tenant_id="tenant_alpha")

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform(
            "SELECT * FROM CUSTOMERS UNION ALL SELECT * FROM INVOICES WHERE tenant_id = 'tenant_alpha'"
        )
    assert exc_info.value.code == "SET_OPERATION_BLOCKED"


def test_union_simple():
    kernel = ASTInvariantKernel()

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("SELECT 1 UNION SELECT 2")
    assert exc_info.value.code == "SET_OPERATION_BLOCKED"


# ──────────────────────────────────────────────
# Cross-tenant literal detection
# ──────────────────────────────────────────────

def test_cross_tenant_explicit():
    kernel = ASTInvariantKernel(tenant_id="tenant_alpha")

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("SELECT * FROM INVOICES WHERE tenant_id = 'tenant_beta'")
    assert exc_info.value.code == "TENANT_ISOLATION_BREACH"


def test_cross_tenant_with_alias():
    kernel = ASTInvariantKernel(tenant_id="tenant_alpha")

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("SELECT * FROM INVOICES i WHERE i.tenant_id = 'tenant_beta'")
    assert exc_info.value.code == "TENANT_ISOLATION_BREACH"


def test_cross_tenant_neq():
    kernel = ASTInvariantKernel(tenant_id="tenant_alpha")

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("SELECT * FROM INVOICES WHERE tenant_id != 'tenant_alpha'")
    assert exc_info.value.code == "TENANT_ISOLATION_BREACH"


# ──────────────────────────────────────────────
# OR-predicate policy on protected tables
# ──────────────────────────────────────────────

def test_or_predicate_on_protected_table():
    kernel = ASTInvariantKernel(
        tenant_id="tenant_alpha",
        protected_tables=DEMO_PROTECTED,
    )

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform(
            "SELECT * FROM INVOICES WHERE tenant_id = 'tenant_alpha' OR 1=1"
        )
    assert exc_info.value.code == "OR_PREDICATE_BLOCKED"


def test_or_with_tautology():
    kernel = ASTInvariantKernel(
        tenant_id="tenant_alpha",
        protected_tables=DEMO_PROTECTED,
    )

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("SELECT * FROM INVOICES WHERE 1=1 OR tenant_id = 'tenant_beta'")
    # May be cross-tenant or OR — either is a valid block
    assert exc_info.value.code in ("TENANT_ISOLATION_BREACH", "OR_PREDICATE_BLOCKED")


# ──────────────────────────────────────────────
# Nested scope / subquery / CTE attacks
# ──────────────────────────────────────────────

def test_subquery_protected_table_blocked():
    kernel = ASTInvariantKernel(
        tenant_id="tenant_alpha",
        protected_tables=DEMO_PROTECTED,
    )

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("SELECT * FROM (SELECT * FROM INVOICES) q")
    assert exc_info.value.code == "NESTED_SCOPE_UNPROVEN"


def test_cte_protected_table_blocked():
    kernel = ASTInvariantKernel(
        tenant_id="tenant_alpha",
        protected_tables=DEMO_PROTECTED,
    )

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform(
            "WITH x AS (SELECT * FROM INVOICES) SELECT * FROM x"
        )
    assert exc_info.value.code == "NESTED_SCOPE_UNPROVEN"


# ──────────────────────────────────────────────
# Catalog snooping variations
# ──────────────────────────────────────────────

def test_catalog_exa_dba():
    kernel = ASTInvariantKernel()

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("SELECT * FROM EXA_DBA_USERS")
    assert exc_info.value.code == "CATALOG_SNOOPING_BLOCKED"


def test_catalog_information_schema():
    kernel = ASTInvariantKernel()

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("SELECT * FROM information_schema.tables")
    assert exc_info.value.code == "CATALOG_SNOOPING_BLOCKED"


# ──────────────────────────────────────────────
# LIMIT clamping
# ──────────────────────────────────────────────

def test_limit_clamp_adds_default():
    kernel = ASTInvariantKernel(limit=500)
    result = kernel.transform("SELECT * FROM my_table")
    assert "limit 500" in result.lower()


def test_limit_clamp_preserves_smaller():
    kernel = ASTInvariantKernel(limit=500)
    result = kernel.transform("SELECT * FROM my_table LIMIT 10")
    assert "limit 10" in result.lower()
    assert "limit 500" not in result.lower()


def test_limit_clamp_reduces_larger():
    kernel = ASTInvariantKernel(limit=500)
    result = kernel.transform("SELECT * FROM my_table LIMIT 99999")
    assert "limit 500" in result.lower()


# ──────────────────────────────────────────────
# Valid queries pass correctly
# ──────────────────────────────────────────────

def test_safe_query_with_tenant():
    kernel = ASTInvariantKernel(tenant_id="tenant_alpha", limit=500)
    result = kernel.transform("SELECT * FROM CUSTOMERS WHERE tenant_id = 'tenant_alpha'")
    assert "tenant_id = 'tenant_alpha'" in result.lower()
    assert "limit" in result.lower()


def test_comment_trick_handled():
    kernel = ASTInvariantKernel(tenant_id="tenant_alpha", limit=500)
    result = kernel.transform(
        "SELECT * FROM CUSTOMERS /* comment */ WHERE tenant_id = 'tenant_alpha'"
    )
    assert "tenant_id = 'tenant_alpha'" in result.lower()


def test_safe_query_nonprotected():
    """Query against a non-protected table should pass without tenant issues."""
    kernel = ASTInvariantKernel(
        tenant_id="tenant_alpha",
        protected_tables=DEMO_PROTECTED,
        limit=500,
    )
    result = kernel.transform("SELECT 1")
    assert "limit 500" in result.lower()


def test_empty_query_blocked():
    kernel = ASTInvariantKernel()

    with pytest.raises(AegisBlockError) as exc_info:
        kernel.transform("")
    assert exc_info.value.code in ("EMPTY_QUERY", "UNPARSEABLE_SQL")


# ----------------------------------------------------------------------
# Regression tests for the security audit fixes
# ----------------------------------------------------------------------

def test_tenant_id_injection_is_neutralized():
    """A hostile tenant_id string must never break out of the SQL literal.

    The clamp previously interpolated tenant_id via f-string, so
    "x' OR '1'='1" rewrote the query into a tenant-isolation-breaking
    OR tautology. The literal must now be built through the AST.
    """
    kernel = ASTInvariantKernel(
        tenant_id="tenant_alpha' OR '1'='1",
        limit=500,
        protected_tables={"customers"},
    )
    rewritten = kernel.transform("SELECT name FROM customers")
    # The attacker string must stay INSIDE one escaped literal and must not
    # create any OR predicate in the parsed AST.
    import sqlglot

    ast = sqlglot.parse_one(rewritten)
    ors = list(ast.find_all(sqlglot.exp.Or))
    assert len(ors) == 0
    # The tenant predicate must be a single EQ comparing against one literal
    eqs = [
        eq
        for eq in ast.find_all(sqlglot.exp.EQ)
        if any(col.name.lower() == "tenant_id" for col in eq.find_all(sqlglot.exp.Column))
    ]
    assert len(eqs) == 1
    literals = eqs[0].find_all(sqlglot.exp.Literal)
    tenant_lits = [l for l in literals if l.is_string and "OR" in l.this.upper()]
    assert len(tenant_lits) == 1  # intact inside the escaped literal, not split out


def test_tenant_id_injection_join_clamp():
    """Same injection attempt through the aliased join clamp path."""
    kernel = ASTInvariantKernel(
        tenant_id="t' OR '1'='1",
        limit=500,
        protected_tables={"customers", "invoices"},
    )
    rewritten = kernel.transform(
        "SELECT c.name FROM customers c JOIN invoices i ON c.customer_id = i.customer_id"
    )
    import sqlglot

    ast = sqlglot.parse_one(rewritten)
    assert len(list(ast.find_all(sqlglot.exp.Or))) == 0
    assert rewritten.count("tenant_id") == 2


def test_or_in_join_on_clause_blocked():
    """OR predicates inside JOIN ... ON must not bypass the no-OR policy
    on protected tables (previously only the top-level WHERE was scanned)."""
    kernel = ASTInvariantKernel(
        tenant_id="tenant_alpha",
        limit=500,
        protected_tables={"customers", "invoices"},
    )
    with pytest.raises(ValueError) as exc_info:
        kernel.transform(
            "SELECT c.* FROM customers c JOIN invoices i "
            "ON c.tenant_id = i.tenant_id OR 1 = 1"
        )
    assert exc_info.value.code == "OR_PREDICATE_BLOCKED"
