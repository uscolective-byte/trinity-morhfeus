"""Pure signature helpers. Missing credentials or signatures never authenticate."""

import base64
import hashlib
import hmac


def signature_for(secret: str, body: bytes, *, encoding: str = "hex") -> str:
    if not secret:
        raise ValueError("Webhook secret is not configured")
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    value = base64.b64encode(digest).decode("ascii") if encoding == "base64" else digest.hex()
    return "sha256=" + value


def valid_signature(secret: str, body: bytes, signature: str | None, *, encoding: str = "hex") -> bool:
    if not secret or not signature or not signature.isascii():
        return False
    return hmac.compare_digest(signature_for(secret, body, encoding=encoding), signature)
