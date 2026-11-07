"""
Domain Links & Landing Pages Interface
aura.dev / auru.dev
"""

import secrets
import datetime
from html import escape
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from infrastructure.database import get_db
from domain.models import ShortenedLink
from domain.schemas import ShortenRequestSchema
from core.config import domain_settings
from core.admin_auth import require_admin

router = APIRouter(tags=["Domain Link & Content Router"])


@router.post("/api/v1/links/shorten", dependencies=[Depends(require_admin)])
async def create_short_link(payload: ShortenRequestSchema, db: AsyncSession = Depends(get_db)):
    code = payload.custom_code or secrets.token_urlsafe(4)[:6].lower()

    stmt = select(ShortenedLink).where(ShortenedLink.code == code)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        if payload.custom_code:
            raise HTTPException(status_code=409, detail="Custom short code already in use.")
        code = secrets.token_urlsafe(6)[:8].lower()

    link = ShortenedLink(
        code=code,
        target_url=payload.target_url,
        campaign=payload.campaign,
        clicks=0
    )
    db.add(link)
    await db.commit()

    short_url = f"{domain_settings.shortener_url_prefix}/{code}"
    return {
        "code": code,
        "target_url": payload.target_url,
        "short_url": short_url,
        "campaign": payload.campaign
    }


@router.get("/l/{code}")
async def redirect_short_link(code: str, db: AsyncSession = Depends(get_db)):
    stmt = select(ShortenedLink).where(ShortenedLink.code == code)
    res = await db.execute(stmt)
    link = res.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Short link not found.")

    link.clicks += 1
    link.last_clicked_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()

    return RedirectResponse(url=link.target_url, status_code=302)


@router.get("/p/{slug}", response_class=HTMLResponse)
async def dynamic_landing_page(slug: str):
    slug = escape(slug)
    return f"""<!DOCTYPE html>
<html lang="sk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trinity AI - {slug.capitalize()}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {{
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #090d16;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }}
        .card {{
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 16px;
            padding: 40px;
            max-width: 580px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }}
        .badge {{
            display: inline-block;
            background: rgba(14, 165, 233, 0.15);
            color: #38bdf8;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 20px;
        }}
        h1 {{
            font-size: 32px;
            margin-bottom: 16px;
            color: #fff;
        }}
        p {{
            color: #94a3b8;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
        }}
        .btn {{
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: #2563eb;
            color: #fff;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 10px;
            font-weight: 600;
            transition: 0.2s;
        }}
        .btn:hover {{
            background: #1d4ed8;
            transform: translateY(-2px);
        }}
        .footer {{
            margin-top: 30px;
            font-size: 12px;
            color: #475569;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="badge"><i class="fa-solid fa-robot"></i> Trinity Morpheus Network</div>
        <h1>Trinity AI Ecosystém</h1>
        <p>Vítajte na oficiálnej pristávacej stránke kampane <strong>{slug}</strong> spravovanej AI agentom Morpheus na doméne {domain_settings.primary_domain}.</p>
        <a href="https://{domain_settings.primary_domain}" class="btn">
            Prejsť na Hlavné Centrum Trinity <i class="fa-solid fa-arrow-right"></i>
        </a>
        <div class="footer">Hostované priamo na {domain_settings.primary_domain} &middot; SSL zabezpečené</div>
    </div>
</body>
</html>"""
