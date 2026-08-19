# tests/test_receipts.py
from aegis.provenance.signer import CryptographicReceiptMint

def test_mint_and_verify():
    mint = CryptographicReceiptMint()
    payload = {"status": "approved", "query": "SELECT 1"}
    
    receipt = mint.mint(payload)
    assert "signature_ed25519" in receipt
    assert mint.verify(receipt) is True
    
    # Tamper test
    receipt["status"] = "blocked"
    assert mint.verify(receipt) is False
