import base64
import os
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from core.admin_auth import require_admin, require_oauth_admin


class AdminTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'MORPHEUS_ADMIN_TOKEN': 'offline-test-owner-token'})
        self.env.start()
        self.addCleanup(self.env.stop)
        app = FastAPI()
        @app.api_route('/admin', methods=['GET', 'POST'], dependencies=[Depends(require_admin)])
        async def admin():
            return {'ok': True}
        @app.get('/auth/meta/callback', dependencies=[Depends(require_oauth_admin)])
        async def callback():
            return {'state_validation': 'handled by oauth_callback'}
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_anonymous_wrong_and_malformed_credentials_rejected(self):
        for header in ['', 'Bearer wrong', 'Basic !!!', 'Basic '+base64.b64encode(b'other:offline-test-owner-token').decode()]:
            response = self.client.get('/admin', headers={'authorization': header})
            self.assertEqual(response.status_code, 401)

    def test_basic_browser_and_bearer_clients_work(self):
        self.assertEqual(self.client.get('/admin', auth=('owner', 'offline-test-owner-token')).status_code, 200)
        self.assertEqual(self.client.post('/admin', headers={'authorization': 'Bearer offline-test-owner-token'}).status_code, 200)

    def test_cross_origin_authenticated_request_rejected(self):
        self.assertEqual(self.client.post('/admin', auth=('owner', 'offline-test-owner-token'), headers={'Origin': 'https://attacker.invalid'}).status_code, 403)

    def test_configured_https_origin_works_behind_tls_terminating_proxy(self):
        with patch('core.admin_auth.domain_settings', SimpleNamespace(base_url='https://morpheus.example.test')):
            # TestClient sends HTTP to the application just like the Caddy hop.
            response = self.client.post('/admin', auth=('owner', 'offline-test-owner-token'), headers={'Origin': 'https://morpheus.example.test'})
            self.assertEqual(response.status_code, 200)

    def test_forwarded_and_host_headers_cannot_authorize_foreign_origin(self):
        with patch('core.admin_auth.domain_settings', SimpleNamespace(base_url='https://morpheus.example.test')):
            response = self.client.post('/admin', auth=('owner', 'offline-test-owner-token'), headers={'Origin': 'https://attacker.invalid', 'Host': 'attacker.invalid', 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'attacker.invalid'})
            self.assertEqual(response.status_code, 403)

    def test_missing_configuration_fails_closed(self):
        with patch.dict(os.environ, {'MORPHEUS_ADMIN_TOKEN': ''}):
            self.assertEqual(self.client.get('/admin').status_code, 503)

    def test_callback_can_reach_state_validation(self):
        self.assertEqual(self.client.get('/auth/meta/callback').status_code, 200)
