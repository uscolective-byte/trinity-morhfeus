import ast
import asyncio
from html import escape
from pathlib import Path
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]


def handler(file, name, scope):
    tree = ast.parse((ROOT / 'interfaces' / file).read_text(encoding='utf-8'))
    function = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == name)
    function.decorator_list = []
    function.returns = None
    for arg in function.args.args:
        arg.annotation = None
    function.args.defaults = [ast.Constant(None) for _ in function.args.defaults]
    exec(compile(ast.fix_missing_locations(ast.Module(body=[function], type_ignores=[])), file, 'exec'), scope)
    return scope[name]


class HtmlTests(unittest.TestCase):
    def test_landing_page_escapes_attacker_slug(self):
        slug = '<img src=x onerror=alert(1)>'
        fn = handler('links.py', 'dynamic_landing_page', dict(escape=escape, domain_settings=SimpleNamespace(primary_domain='example.test')))
        rendered = asyncio.run(fn(slug))
        self.assertNotIn(slug, rendered)
        self.assertIn('&lt;img', rendered)

    def test_dashboard_escapes_database_content(self):
        malicious = '<img src=x onerror=alert(1)>'
        account = SimpleNamespace(platform='meta', status='active', display_name=malicious, username='user')
        post = SimpleNamespace(platform='meta', content_text=malicious, status='published', scheduled_for=None)
        interaction = SimpleNamespace(platform='meta', interaction_type='comment', sender_username=malicious, message_content=malicious, sentiment=None, status='pending')
        class Query:
            created_at = None
            def order_by(self, *_): return self
            def limit(self, *_): return self
        class Database:
            def __init__(self): self.rows = iter([[account], [post], [interaction]])
            async def execute(self, _):
                rows = next(self.rows)
                return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: rows))
        scope = dict(escape=escape, select=lambda *_: Query(), desc=lambda x: x,
                     SocialAccount=Query, PostRecord=Query, SocialInteractionRecord=Query,
                     domain_settings=SimpleNamespace(full_host='example.test'))
        rendered = asyncio.run(handler('dashboard.py', 'serve_dashboard', scope)(None, Database()))
        self.assertNotIn(malicious, rendered)
        self.assertGreaterEqual(rendered.count(escape(malicious)), 4)
