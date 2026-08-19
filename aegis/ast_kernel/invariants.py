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
            
        # Check for Catalog Snooping (System tables)
        for table in ast.find_all(exp.Table):
            if table.name.upper().startswith("EXA_"):
                raise ValueError(f"Catalog snooping detected: attempted to access system table {table.name}")

        if self.tenant_id:
            # Check for cross-tenant attempts
            for node in ast.find_all(exp.Column):
                if node.name.lower() == "tenant_id":
                    # Find the value it's being compared to
                    parent = node.parent
                    if isinstance(parent, exp.EQ):
                        literal = parent.find(exp.Literal)
                        if literal and literal.this != self.tenant_id:
                            raise ValueError(f"Cross-tenant access violation detected: attempted to access {literal.this}")

            tenant_condition = exp.condition(f"tenant_id = '{self.tenant_id}'")
            ast = ast.where(tenant_condition)

        if self.limit:
            ast = ast.limit(self.limit)

        return ast.sql(dialect="exasol")
