import sqlglot
from sqlglot import exp

class ASTInvariantKernel:
    def __init__(self, tenant_id=None, limit=None):
        self.tenant_id = tenant_id
        self.limit = limit

    def transform(self, query: str) -> str:
        try:
            ast = sqlglot.parse_one(query, read="exasol")
        except Exception as e:
            raise ValueError(f"Failed to parse query: {e}")

        if not isinstance(ast, exp.Select):
            raise ValueError("Query is not read-only")

        if self.tenant_id:
            tenant_condition = exp.condition(f"tenant_id = '{self.tenant_id}'")
            ast = ast.where(tenant_condition)

        if self.limit:
            ast = ast.limit(self.limit)

        return ast.sql(dialect="exasol")
