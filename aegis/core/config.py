from dataclasses import dataclass, field
from typing import Set

@dataclass
class SecurityPolicy:
    max_row_limit: int = 500
    allowed_tenants: Set[str] = field(default_factory=lambda: {"tenant_alpha", "tenant_beta"})
    protected_tables: Set[str] = field(
        default_factory=lambda: {"customers", "invoices", "salaries", "orders", "feedback"}
    )
    blocked_keywords: list = field(
        default_factory=lambda: ["exa_all_", "exa_dba_", "exa_ro_", "information_schema"]
    )
