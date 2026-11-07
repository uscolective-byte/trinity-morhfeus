"""
Admin Dashboard Interface
Visual control panel for Morpheus on aura.dev.
"""

import datetime
from html import escape
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from infrastructure.database import get_db
from domain.models import SocialAccount, PostRecord, SocialInteractionRecord, ShortenedLink
from domain.schemas import PostCreateSchema
from core.config import domain_settings, domain_manager
from infrastructure.ai.engine import ai_engine
from core.admin_auth import require_admin

router = APIRouter(tags=["Admin Control Center"], dependencies=[Depends(require_admin)])


@router.get("/dashboard", response_class=HTMLResponse)
async def serve_dashboard(request: Request, db: AsyncSession = Depends(get_db)):
    acc_res = await db.execute(select(SocialAccount))
    accounts = {a.platform: a for a in acc_res.scalars().all()}

    post_res = await db.execute(select(PostRecord).order_by(desc(PostRecord.created_at)).limit(10))
    posts = post_res.scalars().all()

    inter_res = await db.execute(select(SocialInteractionRecord).order_by(desc(SocialInteractionRecord.created_at)).limit(10))
    interactions = inter_res.scalars().all()

    platforms = [
        {"id": "meta", "name": "Meta (Facebook & IG)", "icon": "fa-brands fa-meta"},
        {"id": "x", "name": "X / Twitter v2", "icon": "fa-brands fa-x-twitter"},
        {"id": "linkedin", "name": "LinkedIn", "icon": "fa-brands fa-linkedin"},
        {"id": "youtube", "name": "YouTube", "icon": "fa-brands fa-youtube"},
        {"id": "tiktok", "name": "TikTok", "icon": "fa-brands fa-tiktok"},
    ]

    platform_cards_html = ""
    for p in platforms:
        acc = accounts.get(p["id"])
        connected = acc and acc.status == "active"
        status_badge = '<span class="badge badge-success">✓ Pripojené (Autopilot)</span>' if connected else '<span class="badge badge-idle">Odpojené</span>'
        action_btn = f'<a href="/api/v1/auth/{p["id"]}/authorize" class="btn btn-connect"><i class="{p["icon"]}"></i> Autorizovať 1-Klikom</a>' if not connected else f'<button onclick="disconnectPlatform(\'{p["id"]}\')" class="btn btn-danger">Odpojiť</button>'

        platform_cards_html += f"""
        <div class="card platform-card">
            <div class="card-header">
                <div><i class="{p['icon']} p-icon"></i> <strong>{p['name']}</strong></div>
                {status_badge}
            </div>
            <div class="card-body">
                <p class="account-name">{escape((acc.display_name or acc.username or '') if acc else 'Žiaden účet nie je autorizovaný')}</p>
                <div class="permissions-tag">Práva: Read, Write, Edit, Admin</div>
            </div>
            <div class="card-footer">
                {action_btn}
            </div>
        </div>
        """

    posts_html = ""
    for post in posts:
        status_color = "#10b981" if post.status == "published" else "#f59e0b" if post.status == "scheduled" else "#ef4444"
        posts_html += f"""
        <tr>
            <td><strong>{escape(post.platform.upper())}</strong></td>
            <td>{escape(post.content_text[:80])}...</td>
            <td><span style="color: {status_color}; font-weight:600;">{escape(post.status.upper())}</span></td>
            <td>{post.scheduled_for.strftime('%d.%m %H:%M') if post.scheduled_for else '-'}</td>
        </tr>
        """

    interactions_html = ""
    for it in interactions:
        interactions_html += f"""
        <tr>
            <td><span class="badge badge-subtle">{escape(it.platform.upper())}</span></td>
            <td>{escape(it.interaction_type.upper())}</td>
            <td>{escape(it.sender_username or it.sender_id or '')}</td>
            <td>{escape(it.message_content[:60])}...</td>
            <td><strong>{escape(it.sentiment.upper() if it.sentiment else 'ANALYZING')}</strong></td>
            <td><span class="badge badge-info">{escape(it.status.upper())}</span></td>
        </tr>
        """

    return f"""<!DOCTYPE html>
<html lang="sk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Morpheus AI - Social Command Hub | Trinity</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {{
            --bg: #090d16;
            --surface: #111827;
            --border: #1f2937;
            --primary: #2563eb;
            --primary-hover: #1d4ed8;
            --text: #f1f5f9;
            --muted: #94a3b8;
            --accent: #0ea5e9;
        }}
        * {{ box-sizing: border-box; }}
        body {{
            margin: 0;
            background: var(--bg);
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 24px;
        }}
        header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 30px;
        }}
        .brand {{
            display: flex;
            align-items: center;
            gap: 14px;
        }}
        .brand-logo {{
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #0ea5e9, #2563eb);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }}
        .brand-title {{ font-size: 20px; font-weight: 700; }}
        .domain-tag {{
            background: rgba(14, 165, 233, 0.15);
            color: #38bdf8;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 13px;
        }}
        .grid-platforms {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .card {{
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 20px;
        }}
        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
        }}
        .p-icon {{ font-size: 20px; color: #38bdf8; margin-right: 6px; }}
        .badge {{
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }}
        .badge-success {{ background: rgba(16, 185, 129, 0.15); color: #10b981; }}
        .badge-idle {{ background: rgba(148, 163, 184, 0.15); color: var(--muted); }}
        .badge-info {{ background: rgba(14, 165, 233, 0.15); color: #38bdf8; }}
        .badge-subtle {{ background: #1e293b; color: #94a3b8; }}
        .account-name {{ font-size: 15px; color: #fff; margin: 4px 0 10px 0; }}
        .permissions-tag {{ font-size: 11px; color: var(--muted); }}
        .btn {{
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            border: none;
            transition: 0.2s;
        }}
        .btn-connect {{ background: var(--primary); color: #fff; width: 100%; justify-content: center; }}
        .btn-connect:hover {{ background: var(--primary-hover); }}
        .btn-danger {{ background: #ef4444; color: #fff; }}
        .table {{
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 14px;
        }}
        .table th, .table td {{
            padding: 12px;
            border-bottom: 1px solid var(--border);
        }}
        .table th {{ color: var(--muted); font-weight: 500; font-size: 12px; }}
        .two-cols {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }}
        @media(max-width: 900px) {{
            .two-cols {{ grid-template-columns: 1fr; }}
        }}
    </style>
</head>
<body>
    <header>
        <div class="brand">
            <div class="brand-logo"><i class="fa-solid fa-brain"></i></div>
            <div>
                <div class="brand-title">Morpheus AI Social Commander</div>
                <div style="font-size: 13px; color: var(--muted);">Autonómny administrátor pre sociálne siete Trinity</div>
            </div>
        </div>
        <div>
            <span class="domain-tag"><i class="fa-solid fa-globe"></i> Doména: {escape(domain_settings.full_host)}</span>
        </div>
    </header>

    <h2 style="font-size: 18px; margin-bottom: 16px;"><i class="fa-solid fa-plug"></i> Trvalé Prepojenie Kanálov (OAuth 2.0 Engine)</h2>
    <div class="grid-platforms">
        {platform_cards_html}
    </div>

    <div class="two-cols">
        <div class="card">
            <h3 style="font-size: 16px; margin-top: 0;"><i class="fa-solid fa-paper-plane"></i> Publikované a Plánované Príspevky</h3>
            <table class="table">
                <thead>
                    <tr><th>Platforma</th><th>Text</th><th>Stav</th><th>Čas</th></tr>
                </thead>
                <tbody>
                    {posts_html or '<tr><td colspan="4" style="color:var(--muted); text-align:center;">Žiadne príspevky v rade.</td></tr>'}
                </tbody>
            </table>
        </div>

        <div class="card">
            <h3 style="font-size: 16px; margin-top: 0;"><i class="fa-solid fa-comments"></i> Inbound Správy, Komentáre a Moderovanie</h3>
            <table class="table">
                <thead>
                    <tr><th>Platforma</th><th>Typ</th><th>Používateľ</th><th>Správa</th><th>Sentiment</th><th>Stav</th></tr>
                </thead>
                <tbody>
                    {interactions_html or '<tr><td colspan="6" style="color:var(--muted); text-align:center;">Zatiaľ bez interakcií.</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>

    <script>
        async function disconnectPlatform(platform) {{
            if (!confirm('Naozaj odpojiť platformu ' + platform + '?')) return;
            const res = await fetch('/api/v1/auth/' + platform + '/disconnect', {{ method: 'DELETE' }});
            if (res.ok) window.location.reload();
        }}
    </script>
</body>
</html>"""


@router.post("/api/v1/admin/generate-post")
async def trigger_autonomous_post_generation(
    payload: PostCreateSchema,
    db: AsyncSession = Depends(get_db)
):
    content_data = await ai_engine.generate_social_post(
        topic=payload.topic,
        platform=payload.platform,
        link=payload.target_link
    )

    scheduled_for = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=payload.schedule_minutes_from_now)

    post = PostRecord(
        id=f"post_{datetime.datetime.now(datetime.timezone.utc).timestamp()}",
        account_id=f"{payload.platform}:default",
        platform=payload.platform,
        content_text=content_data.get("content_text", ""),
        media_urls=[payload.media_url] if payload.media_url else [],
        status="scheduled" if payload.schedule_minutes_from_now > 0 else "scheduled",
        scheduled_for=scheduled_for,
        ai_generated=True,
        ai_prompt=payload.topic
    )
    db.add(post)
    await db.commit()

    return {"status": "queued", "post_id": post.id, "content": post.content_text, "scheduled_for": scheduled_for}


@router.post("/api/v1/admin/sync-dns")
async def sync_dns_endpoint():
    return await domain_manager.sync_cloudflare_dns()
