"""Offline regression tests; run without database or scheduler startup."""
import ast
import asyncio
import base64
import hmac
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from fastapi import HTTPException
from core.webhook_security import signature_for, valid_signature


def endpoints():
    tree = ast.parse((ROOT / 'interfaces/webhooks.py').read_text(encoding='utf-8'))
    functions = [n for n in tree.body if isinstance(n, ast.AsyncFunctionDef)]
    for function in functions:
        function.decorator_list = []
        for arg in function.args.args:
            arg.annotation = None
        function.args.defaults = [ast.Constant(None) for _ in function.args.defaults]
        function.returns = None
    scope = dict(HTTPException=HTTPException, hmac=hmac, json=json,
                 signature_for=signature_for, valid_signature=valid_signature,
                 META_APP_SECRET='meta-test', META_VERIFY_TOKEN='verify-test', X_CONSUMER_SECRET='x-test')
    exec(compile(ast.fix_missing_locations(ast.Module(body=functions, type_ignores=[])), '<handlers>', 'exec'), scope)
    return scope


class Request:
    def __init__(self, headers=None):
        self.headers = headers or {}
    async def body(self):
        return b'{}'


class SecurityTests(unittest.TestCase):
    def test_signatures_known_vectors_and_tampering(self):
        for encoding in ('hex', 'base64'):
            raw = hmac.digest(b'secret', b'body', 'sha256')
            expected = 'sha256=' + (raw.hex() if encoding == 'hex' else base64.b64encode(raw).decode())
            self.assertEqual(signature_for('secret', b'body', encoding=encoding), expected)
            self.assertTrue(valid_signature('secret', b'body', expected, encoding=encoding))
            for secret, body, signature in [('', b'body', expected), ('secret', b'changed', expected), ('secret', b'body', None), ('secret', b'body', 'sha256=bad'), ('secret', b'body', '\u00e9')]:
                self.assertFalse(valid_signature(secret, body, signature, encoding=encoding))

    def test_both_endpoints_reject_before_database_and_accept_signed_body(self):
        for handler, secret_name, header, encoding in [('meta_webhook_event', 'META_APP_SECRET', 'X-Hub-Signature-256', 'hex'), ('x_webhook_events', 'X_CONSUMER_SECRET', 'x-twitter-webhooks-signature', 'base64')]:
            for secret, signature, status in [('', None, 503), ('test', None, 401), ('test', 'sha256=bad', 401)]:
                scope = endpoints()
                scope[secret_name] = secret
                with self.assertRaises(HTTPException) as error:
                    asyncio.run(scope[handler](Request({header: signature}), None, None))
                self.assertEqual(error.exception.status_code, status)
            scope = endpoints()
            signature = signature_for(scope[secret_name], b'{}', encoding=encoding)
            self.assertEqual(asyncio.run(scope[handler](Request({header: signature}), None, None)), {'status': 'received'})

    def test_crc_uses_base64_and_requires_secret(self):
        scope = endpoints()
        expected = 'sha256=' + base64.b64encode(hmac.digest(b'x-test', b'challenge', 'sha256')).decode()
        self.assertEqual(asyncio.run(scope['x_crc_challenge']('challenge'))['response_token'], expected)
        scope['X_CONSUMER_SECRET'] = ''
        with self.assertRaises(HTTPException) as error:
            asyncio.run(scope['x_crc_challenge']('challenge'))
        self.assertEqual(error.exception.status_code, 503)

    def test_meta_verification_requires_secret_and_matching_token(self):
        scope = endpoints()
        with self.assertRaises(HTTPException):
            asyncio.run(scope['meta_webhook_verification']('subscribe', 'challenge', 'wrong'))
        scope['META_VERIFY_TOKEN'] = ''
        with self.assertRaises(HTTPException) as error:
            asyncio.run(scope['meta_webhook_verification']('subscribe', 'challenge', ''))
        self.assertEqual(error.exception.status_code, 503)

    def test_vault_missing_key_fails_and_configured_key_roundtrips(self):
        source = (ROOT / 'core/security.py').read_text(encoding='utf-8')
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                exec(compile(source, '<vault>', 'exec'), {})
        scope = {}
        with patch.dict(os.environ, {'MORPHEUS_VAULT_KEY': 'offline-test-only'}, clear=True):
            exec(compile(source, '<vault>', 'exec'), scope)
            encrypted = scope['vault'].encrypt('oauth-test-value')
            self.assertNotEqual(encrypted, 'oauth-test-value')
            self.assertEqual(scope['vault'].decrypt(encrypted), 'oauth-test-value')
