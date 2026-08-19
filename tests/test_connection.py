# tests/test_connection.py
from unittest.mock import patch
from aegis.exasol_client.connection import get_connection

@patch('pyexasol.connect')
def test_get_connection(mock_connect):
    get_connection("localhost:8563", "user", "pass", "MYSCHEMA")
    mock_connect.assert_called_once_with(
        dsn="localhost:8563",
        user="user",
        password="pass",
        schema="MYSCHEMA",
        compression=True,
        fetch_dict=True
    )
