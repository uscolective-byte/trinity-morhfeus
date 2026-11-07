"""
Core Security Module
AES-256 Fernet Encryption Vault for Social OAuth Tokens and API Keys.
"""

import os
import base64
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class CryptoVault:
    def __init__(self, master_key: Optional[str] = None):
        raw_key = master_key or os.getenv("MORPHEUS_VAULT_KEY")
        if not raw_key:
            raw_key = os.getenv("TRINITY_VAULT_KEY")
        if not raw_key or not raw_key.strip():
            raise RuntimeError("Configure MORPHEUS_VAULT_KEY or TRINITY_VAULT_KEY before starting Morpheus")

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"trinity_morpheus_salt_v1",
            iterations=100_000,
        )
        derived_key = base64.urlsafe_b64encode(kdf.derive(raw_key.encode("utf-8")))
        self.fernet = Fernet(derived_key)

    def encrypt(self, plain_text: str) -> str:
        """Encrypts plain text string to base64 urlsafe token"""
        if not plain_text:
            return ""
        return self.fernet.encrypt(plain_text.encode("utf-8")).decode("utf-8")

    def decrypt(self, cipher_text: str) -> str:
        """Decrypts base64 cipher token back to plain text"""
        if not cipher_text:
            return ""
        try:
            return self.fernet.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
        except Exception:
            return ""


vault = CryptoVault()
