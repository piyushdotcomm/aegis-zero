import json
import hashlib
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat


def to_jsonable(obj):
    """Recursively convert non-JSON-serializable types (Decimal, datetime, bytes)."""
    import decimal
    import datetime
    import math

    if isinstance(obj, dict):
        return {str(k) if not isinstance(k, str) else k: to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(v) for v in obj]
    if isinstance(obj, decimal.Decimal):
        # NaN/Infinity decimals (e.g. from DOUBLE columns) cannot be emitted
        # as JSON numbers without breaking the canonical receipt encoding.
        if obj.is_nan() or obj.is_infinite():
            return None
        return int(obj) if obj == int(obj) else float(obj)
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, bytes):
        return obj.hex()
    return obj


class CryptographicReceiptMint:
    def __init__(self):
        self.private_key = ed25519.Ed25519PrivateKey.generate()
        self.public_key = self.private_key.public_key()

    def public_key_hex(self) -> str:
        """Return the raw Ed25519 public key as a hex string."""
        return self.public_key.public_bytes(Encoding.Raw, PublicFormat.Raw).hex()

    def mint(self, payload: dict) -> dict:
        safe_payload = to_jsonable(payload)
        canonical = json.dumps(
            safe_payload,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
        signature = self.private_key.sign(canonical).hex()
        return {**safe_payload, "signature_ed25519": signature}

    def verify(self, receipt: dict) -> bool:
        if "signature_ed25519" not in receipt:
            return False
        try:
            signature = bytes.fromhex(receipt["signature_ed25519"])
        except (ValueError, TypeError):
            return False
        payload = {k: v for k, v in receipt.items() if k != "signature_ed25519"}
        canonical = json.dumps(
            payload,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
        try:
            self.public_key.verify(signature, canonical)
            return True
        except Exception:
            return False


def sha256_hex(data: str) -> str:
    """Return the SHA-256 hex digest of a UTF-8 string."""
    return hashlib.sha256(data.encode("utf-8")).hexdigest()
