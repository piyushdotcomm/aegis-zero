# tests/test_receipts.py
from aegis.provenance.signer import CryptographicReceiptMint, to_jsonable

def test_mint_and_verify():
    mint = CryptographicReceiptMint()
    payload = {"status": "approved", "query": "SELECT 1"}
    
    receipt = mint.mint(payload)
    assert "signature_ed25519" in receipt
    assert mint.verify(receipt) is True
    
    # Tamper test
    receipt["status"] = "blocked"
    assert mint.verify(receipt) is False


def test_to_jsonable_handles_nan_and_infinite_decimals():
    """Regression: Decimal('NaN') / Decimal('Infinity') (possible from DOUBLE
    columns) previously raised ValueError and crashed receipt minting."""
    import decimal

    payload = {
        "nan_value": decimal.Decimal("NaN"),
        "inf_value": decimal.Decimal("Infinity"),
        "ok_value": decimal.Decimal("42.5"),
    }
    receipt = to_jsonable(payload)
    assert receipt["nan_value"] is None
    assert receipt["inf_value"] is None
    assert receipt["ok_value"] == 42.5

    # Full mint round-trip must not raise
    mint = CryptographicReceiptMint()
    signed = mint.mint(payload)
    assert mint.verify(signed) is True


def test_to_jsonable_handles_non_string_dict_keys():
    """Regression: non-string dict keys (e.g. tuple keys from row metadata)
    previously produced a dict json.dumps could not serialize."""
    payload = {(1, 2): "v"}
    receipt = to_jsonable(payload)
    assert receipt["(1, 2)"] == "v"

    mint = CryptographicReceiptMint()
    signed = mint.mint(payload)
    assert mint.verify(signed) is True
