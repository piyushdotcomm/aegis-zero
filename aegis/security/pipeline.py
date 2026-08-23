import json
import uuid
from datetime import datetime, timezone

from aegis.core.config import SecurityPolicy
from aegis.ast_kernel.invariants import ASTInvariantKernel, AegisBlockError
from aegis.scanners.taint_shield import RowTaintShield
from aegis.provenance.signer import CryptographicReceiptMint, to_jsonable, sha256_hex


class AegisSecurityPipeline:
    def __init__(
        self,
        connection,
        tenant_id=None,
        limit=None,
        policy=None,
        mint=None,
        policy_version="1.0.0",
        schema="AEGIS_DEMO",
    ):
        self.connection = connection
        self.tenant_id = tenant_id
        self.policy_version = policy_version
        self.schema = schema

        protected = policy.protected_tables if policy else None
        blocked = policy.blocked_keywords if policy else None
        effective_limit = limit or (policy.max_row_limit if policy else None)

        self.kernel = ASTInvariantKernel(
            tenant_id=tenant_id,
            limit=effective_limit,
            protected_tables=protected,
            blocked_keywords=blocked,
        )
        self.shield = RowTaintShield()
        self.signer = mint if mint else CryptographicReceiptMint()

    def _build_receipt(self, decision, code, original_sql, rewritten_sql, row_count, tainted_rows, results_hash):
        """Build and sign a cryptographic action receipt with full metadata."""
        payload = {
            "receipt_id": str(uuid.uuid4()),
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "decision": decision,
            "code": code,
            "tenant_id": self.tenant_id,
            "policy_version": self.policy_version,
            "schema": self.schema,
            "original_sql_sha256": sha256_hex(original_sql),
            "rewritten_sql_sha256": sha256_hex(rewritten_sql) if rewritten_sql else None,
            "row_count": row_count,
            "tainted_rows": tainted_rows,
            "results_sha256": results_hash,
            "public_key_ed25519": self.signer.public_key_hex(),
        }
        return self.signer.mint(payload)

    def execute(self, query: str) -> dict:
        # --- Validate with AST kernel ---
        try:
            safe_query = self.kernel.transform(query)
        except AegisBlockError as e:
            receipt = self._build_receipt(
                decision="BREACH_BLOCKED",
                code=e.code,
                original_sql=query,
                rewritten_sql=None,
                row_count=0,
                tainted_rows=0,
                results_hash=None,
            )
            return {
                "decision": "BREACH_BLOCKED",
                "code": e.code,
                "message": str(e),
                "hint": e.hint,
                "original_sql": query,
                "rewritten_sql": None,
                "results": [],
                "row_count": 0,
                "tainted_rows": 0,
                "receipt": receipt,
            }

        # --- Execute approved query ---
        stmt = self.connection.execute(safe_query)
        raw_rows = to_jsonable(stmt.fetchall())

        # --- Sanitize returned data ---
        sanitized_rows, tainted_count = self.shield.scan_and_sanitize(raw_rows)

        results_canonical = json.dumps(
            sanitized_rows, sort_keys=True, separators=(",", ":"), ensure_ascii=False
        )
        results_hash = sha256_hex(results_canonical)

        receipt = self._build_receipt(
            decision="INVARIANT_VERIFIED",
            code="INVARIANT_VERIFIED",
            original_sql=query,
            rewritten_sql=safe_query,
            row_count=len(sanitized_rows),
            tainted_rows=tainted_count,
            results_hash=results_hash,
        )

        return {
            "decision": "INVARIANT_VERIFIED",
            "code": "INVARIANT_VERIFIED",
            "message": "Query passed all security invariants.",
            "hint": None,
            "original_sql": query,
            "rewritten_sql": safe_query,
            "results": sanitized_rows,
            "row_count": len(sanitized_rows),
            "tainted_rows": tainted_count,
            "receipt": receipt,
        }
