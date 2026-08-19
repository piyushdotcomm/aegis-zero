# aegis/exasol_client/connection.py
import pyexasol
import ssl

def get_connection(dsn: str, user: str, password: str, schema: str = "AEGIS_DEMO"):
    """Return a live PyExasol connection for the demo schema."""
    return pyexasol.connect(
        dsn=dsn,
        user=user,
        password=password,
        schema=schema,
        compression=True,
        fetch_dict=True,
        websocket_sslopt={"cert_reqs": ssl.CERT_NONE}
    )
