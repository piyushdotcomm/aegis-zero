import pytest
from aegis.ast_kernel.invariants import ASTInvariantKernel

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
