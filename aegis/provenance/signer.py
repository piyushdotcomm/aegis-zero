# aegis/provenance/signer.py
import json
from cryptography.hazmat.primitives.asymmetric import ed25519

class CryptographicReceiptMint:
    def __init__(self):
        self.private_key = ed25519.Ed25519PrivateKey.generate()
        self.public_key = self.private_key.public_key()

    def mint(self, payload: dict) -> dict:
        canonical = json.dumps(
            payload,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
        signature = self.private_key.sign(canonical).hex()
        return {**payload, "signature_ed25519": signature}

    def verify(self, receipt: dict) -> bool:
        if "signature_ed25519" not in receipt:
            return False
        signature = bytes.fromhex(receipt["signature_ed25519"])
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
