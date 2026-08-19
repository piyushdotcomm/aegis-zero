# tests/test_config.py
from aegis.core.config import SecurityPolicy

def test_security_policy_defaults():
    policy = SecurityPolicy()
    assert policy.max_row_limit == 500
    assert "tenant_alpha" in policy.allowed_tenants
    assert "customers" in policy.protected_tables
    assert "exa_all_" in policy.blocked_keywords
