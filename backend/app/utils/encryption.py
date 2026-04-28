"""Fernet encryption helpers for storing sensitive credentials at rest."""

import json
from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _get_fernet() -> Fernet:
    key = getattr(settings, "tracking_encryption_key", "") or ""
    if not key:
        raise ValueError("TRACKING_ENCRYPTION_KEY is not set")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_credentials(credentials: dict) -> str:
    """Encrypt a credentials dict to a Fernet ciphertext string."""
    f = _get_fernet()
    plaintext = json.dumps(credentials).encode("utf-8")
    return f.encrypt(plaintext).decode("utf-8")


def decrypt_credentials(ciphertext: str) -> dict:
    """Decrypt a Fernet ciphertext string back to a credentials dict."""
    f = _get_fernet()
    try:
        plaintext = f.decrypt(ciphertext.encode("utf-8"))
        return json.loads(plaintext.decode("utf-8"))
    except (InvalidToken, json.JSONDecodeError):
        return {}
