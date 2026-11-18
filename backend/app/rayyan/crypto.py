"""
Symmetric encryption for stored Gemini API keys.

The plaintext key is never written to the database, logs or API responses.
Fernet (AES-128-CBC + HMAC-SHA256) is used with a server-side key that comes
from `RAYAN_ENCRYPTION_KEY` or, when that is absent, from a generated keyfile
under `backend/secrets/` (already git-ignored). The keyfile is created with
owner-only permissions where the platform supports it.

Deployment note: back up the keyfile. Without it the stored ciphertext cannot
be recovered; the correct recovery is to delete and re-add the key.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.rayyan.config import RayyanSettings

KEY_FORMAT = re.compile(r"^[A-Za-z0-9._\-]{20,200}$")
MASK_CHAR = "\u2022"


class CipherError(Exception):
    """Raised when the encryption key is missing/invalid or decryption fails."""


class CipherConfigurationError(CipherError):
    pass


class DecryptionError(CipherError):
    pass


def validate_key_format(api_key: str) -> str | None:
    """Return a safe problem description, or None when the shape is plausible.

    This is a cheap local check before a network call; the Gemini API remains
    the authority on whether a key is valid.
    """
    key = api_key.strip()
    if not key:
        return "The API key is empty."
    if any(character.isspace() for character in key):
        return "The API key contains whitespace. Paste it without spaces."
    if not KEY_FORMAT.match(key):
        return (
            "That does not look like a Google API key. Paste the full key from "
            "Google AI Studio (letters, digits, '.', '-' and '_' only)."
        )
    return None


def mask_secret(secret: str) -> str:
    """Masked display value: a short prefix hint plus the last four characters."""
    value = secret.strip()
    if len(value) < 12:
        return MASK_CHAR * 12
    prefix = value[:4] if value.startswith("AIza") else ""
    return f"{prefix}{MASK_CHAR * 10}{value[-4:]}"


class KeyCipher:
    def __init__(self, key: bytes) -> None:
        try:
            self._fernet = Fernet(key)
        except (ValueError, TypeError) as exc:
            raise CipherConfigurationError(
                "The RAYAN encryption key is not a valid Fernet key."
            ) from exc

    @classmethod
    def from_settings(cls, settings: RayyanSettings) -> "KeyCipher":
        configured = settings.encryption_key.strip()
        if configured:
            return cls(configured.encode("utf-8"))

        path = settings.keyfile
        if path.is_file():
            stored = path.read_bytes().strip()
            if not stored:
                raise CipherConfigurationError(
                    f"The encryption keyfile {path.name} is empty."
                )
            return cls(stored)

        key = Fernet.generate_key()
        _write_keyfile(path, key)
        return cls(key)

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode("utf-8")).decode("ascii")

    def decrypt(self, token: str) -> str:
        try:
            return self._fernet.decrypt(token.encode("ascii")).decode("utf-8")
        except (InvalidToken, ValueError, TypeError) as exc:
            raise DecryptionError(
                "The stored API key could not be decrypted. Delete it and add it again."
            ) from exc


def _write_keyfile(path: Path, key: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    _restrict_directory(path.parent)
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        # Another worker won the race; use its file.
        return
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(key)
        os.chmod(path, 0o600)
    except OSError as exc:
        raise CipherConfigurationError(
            f"The encryption keyfile could not be written to {path.parent}."
        ) from exc


def _restrict_directory(path: Path) -> None:
    try:
        os.chmod(path, 0o700)
    except OSError:
        # Windows does not map POSIX modes; the file remains under backend/secrets.
        pass
