# aegis/security/pipeline.py
from aegis.core.config import SecurityPolicy
from aegis.ast_kernel.invariants import ASTInvariantKernel
from aegis.scanners.taint_shield import RowTaintShield
from aegis.provenance.signer import CryptographicReceiptMint

class AegisSecurityPipeline:
    def __init__(self, connection, tenant_id=None, limit=None):
        self.connection = connection
        self.kernel = ASTInvariantKernel(tenant_id=tenant_id, limit=limit)
        self.shield = RowTaintShield()
        self.mint = CryptographicReceiptMint()
        
    def execute(self, query: str) -> dict:
        safe_query = self.kernel.transform(query)
        # execute via connection (fetch_dict is assumed)
        stmt = self.connection.execute(safe_query)
        results = stmt.fetchall()
        sanitized_results, tainted_count = self.shield.scan_and_sanitize(results)
        payload = {
            "query": safe_query,
            "results": sanitized_results,
            "tainted_rows": tainted_count
        }
        return self.mint.mint(payload)
