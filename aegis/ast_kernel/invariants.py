import sqlglot
from sqlglot import exp


class AegisBlockError(ValueError):
    """Structured security rejection raised by the AST kernel.

    Subclasses ValueError so existing ``pytest.raises(ValueError)`` tests
    continue to pass without modification.
    """

    def __init__(self, code: str, message: str, hint: str = ""):
        super().__init__(message)
        self.code = code
        self.hint = hint


class ASTInvariantKernel:
    def __init__(
        self,
        tenant_id=None,
        limit=None,
        protected_tables=None,
        blocked_keywords=None,
    ):
        self.tenant_id = tenant_id
        self.limit = limit
        self.protected_tables = (
            {t.lower() for t in protected_tables} if protected_tables else None
        )
        self.blocked_keywords = [
            k.lower()
            for k in (
                blocked_keywords
                or ["exa_all_", "exa_dba_", "exa_ro_", "information_schema"]
            )
        ]

    def transform(self, query: str) -> str:
        # --- Multi-statement detection ---
        try:
            statements = [s for s in sqlglot.parse(query, read="exasol") if s is not None]
        except Exception as e:
            raise AegisBlockError(
                "UNPARSEABLE_SQL",
                f"Failed to parse query: {e}",
                "Provide a single valid SQL SELECT statement.",
            )

        if len(statements) == 0:
            raise AegisBlockError(
                "EMPTY_QUERY",
                "No SQL statement provided.",
                "Provide a single valid SQL SELECT statement.",
            )

        if len(statements) > 1:
            raise AegisBlockError(
                "MULTI_STATEMENT_BLOCKED",
                "Multiple SQL statements are not allowed.",
                "Submit a single SELECT statement per request.",
            )

        ast = statements[0]

        # --- Read-only barrier ---
        if isinstance(ast, (exp.Union, exp.Intersect, exp.Except)):
            raise AegisBlockError(
                "SET_OPERATION_BLOCKED",
                "UNION / INTERSECT / EXCEPT queries are not permitted.",
                "Use a single SELECT without set operations.",
            )

        if not isinstance(ast, exp.Select):
            raise AegisBlockError(
                "MUTATION_BLOCKED",
                "Query is not read-only. Only SELECT statements are permitted.",
                "Replace with a SELECT query.",
            )

        # --- Catalog snooping defense ---
        for table in ast.find_all(exp.Table):
            full_ref = ".".join(
                part.name.lower() for part in table.parts if part.name
            )
            table_name_lower = table.name.lower() if table.name else ""

            if table_name_lower.startswith("exa_"):
                raise AegisBlockError(
                    "CATALOG_SNOOPING_BLOCKED",
                    f"Catalog snooping detected: attempted to access system table {table.name}",
                    "Do not reference Exasol system tables (EXA_*).",
                )

            for kw in self.blocked_keywords:
                if kw in full_ref or kw in table_name_lower:
                    raise AegisBlockError(
                        "CATALOG_SNOOPING_BLOCKED",
                        f"Catalog snooping detected: reference to blocked object '{table.name}'",
                        "Do not reference system catalog objects.",
                    )

        # --- Identify protected tables in query ---
        query_tables = list(ast.find_all(exp.Table))
        protected_in_query = set()
        if self.protected_tables:
            for t in query_tables:
                if t.name and t.name.lower() in self.protected_tables:
                    protected_in_query.add(t)

        # --- Nested scope check (subqueries / CTEs) ---
        if protected_in_query:
            for t in protected_in_query:
                scope = t.find_ancestor(exp.Select)
                if scope is not None and scope is not ast:
                    raise AegisBlockError(
                        "NESTED_SCOPE_UNPROVEN",
                        f"Protected table '{t.name}' referenced inside a subquery or CTE. "
                        "Cannot prove tenant isolation in nested scopes.",
                        "Move the table reference to the top-level SELECT with an explicit tenant_id filter.",
                    )

        # --- Cross-tenant literal detection ---
        if self.tenant_id:
            for node in ast.find_all(exp.Column):
                if node.name.lower() != "tenant_id":
                    continue
                parent = node.parent
                if isinstance(parent, exp.EQ):
                    literal = parent.find(exp.Literal)
                    if literal and literal.is_string and literal.this != self.tenant_id:
                        raise AegisBlockError(
                            "TENANT_ISOLATION_BREACH",
                            f"Cross-tenant access violation: attempted to access tenant '{literal.this}'",
                            f"Use tenant_id = '{self.tenant_id}' for your session.",
                        )
                elif isinstance(parent, exp.NEQ):
                    raise AegisBlockError(
                        "TENANT_ISOLATION_BREACH",
                        "Negated tenant_id predicate detected.",
                        f"Use tenant_id = '{self.tenant_id}' instead of != comparisons.",
                    )
                elif isinstance(parent, exp.In):
                    for lit in parent.find_all(exp.Literal):
                        if lit.is_string and lit.this != self.tenant_id:
                            raise AegisBlockError(
                                "TENANT_ISOLATION_BREACH",
                                f"Cross-tenant access violation via IN clause: tenant '{lit.this}'",
                                f"Use only tenant_id = '{self.tenant_id}' for your session.",
                            )

        # --- OR-predicate policy on protected tables ---
        if protected_in_query:
            where = ast.args.get("where")
            if where is not None:
                for _ in where.find_all(exp.Or):
                    raise AegisBlockError(
                        "OR_PREDICATE_BLOCKED",
                        "OR predicates are not permitted on queries involving protected tables. "
                        "Conservative policy: prevents tenant isolation bypass via OR tautologies.",
                        "Rewrite without OR, or split into separate queries.",
                    )

        # --- Tenant isolation clamp ---
        if self.tenant_id:
            if self.protected_tables is not None and protected_in_query:
                for t in protected_in_query:
                    alias = t.alias_or_name
                    cond = exp.condition(
                        f"{alias}.tenant_id = '{self.tenant_id}'"
                    )
                    ast = ast.where(cond)
            elif self.protected_tables is None:
                cond = exp.condition(f"tenant_id = '{self.tenant_id}'")
                ast = ast.where(cond)

        # --- LIMIT clamp (min of existing and max_row_limit) ---
        if self.limit:
            existing_limit = ast.args.get("limit")
            keep_existing = False
            if isinstance(existing_limit, exp.Limit):
                lit = existing_limit.expression
                if isinstance(lit, exp.Literal) and lit.is_int:
                    existing_val = int(lit.this)
                    if existing_val <= self.limit:
                        keep_existing = True
            if not keep_existing:
                ast = ast.limit(self.limit)

        return ast.sql(dialect="exasol")
