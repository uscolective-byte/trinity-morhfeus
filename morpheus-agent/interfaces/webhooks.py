"""
Inbound Webhooks Interface
Meta, X, LinkedIn, YouTube, TikTok.
"""

import os
import hmac
import hashlib
import json
from typing import Optional
from fastapi import APIRouter, Request, Response, HTTPException, Query, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.database import get_db
from domain.models import SocialInteractionRecord
from application.scheduler import autopilot_engine
from core.logging import logger
from core.webhook_security import signature_for, valid_signature

router = APIRouter(prefix="/api/v1/webhooks", tags=["Social Webhooks Engine"])

META_VERIFY_TOKEN = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")
X_CONSUMER_SECRET = os.getenv("X_CONSUMER_SECRET", "")


@router.get("/meta")
async def meta_webhook_verification(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token")
):
    if not META_VERIFY_TOKEN:
        raise HTTPException(status_code=503, detail="Meta verification is not configured")
    if hub_mode == "subscribe" and hub_challenge and hub_verify_token and hmac.compare_digest(hub_verify_token.encode(), META_VERIFY_TOKEN.encode()):
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification token mismatch")


@router.post("/meta")
async def meta_webhook_event(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    body_bytes = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")

    if not META_APP_SECRET:
        raise HTTPException(status_code=503, detail="Meta webhook is not configured")
    if not valid_signature(META_APP_SECRET, body_bytes, signature):
        raise HTTPException(status_code=401, detail="Invalid Meta signature")

    payload = json.loads(body_bytes.decode("utf-8"))
    entries = payload.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for ch in changes:
            val = ch.get("value", {})
            if ch.get("field") == "comments":
                comment_id = val.get("comment_id")
                from_user = val.get("from", {})
                text = val.get("message", "")
                
                interaction = SocialInteractionRecord(
                    id=f"meta_comment_{comment_id}",
                    platform="meta",
                    account_id=f"meta:{entry.get('id')}",
                    interaction_type="comment",
                    sender_id=str(from_user.get("id")),
                    sender_username=from_user.get("name"),
                    message_content=text,
                    status="pending"
                )
                db.add(interaction)
                await db.commit()
                background_tasks.add_task(autopilot_engine.handle_interaction, interaction.id)

    return {"status": "received"}


@router.get("/x")
async def x_crc_challenge(crc_token: Optional[str] = None):
    if not crc_token:
        raise HTTPException(status_code=400, detail="Missing crc_token")

    if not X_CONSUMER_SECRET:
        raise HTTPException(status_code=503, detail="X webhook is not configured")
    response_token = signature_for(X_CONSUMER_SECRET, crc_token.encode("utf-8"), encoding="base64")
    return {"response_token": response_token}


@router.post("/x")
async def x_webhook_events(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    if not X_CONSUMER_SECRET:
        raise HTTPException(status_code=503, detail="X webhook is not configured")
    body_bytes = await request.body()
    if not valid_signature(X_CONSUMER_SECRET, body_bytes, request.headers.get("x-twitter-webhooks-signature"), encoding="base64"):
        raise HTTPException(status_code=401, detail="Invalid X signature")
    payload = json.loads(body_bytes)
    dm_events = payload.get("direct_message_events", [])
    for dm in dm_events:
        msg_data = dm.get("message_create", {})
        sender_id = msg_data.get("sender_id")
        text = msg_data.get("message_data", {}).get("text", "")
        
        interaction = SocialInteractionRecord(
            id=f"x_dm_{dm.get('id')}",
            platform="x",
            account_id=f"x:{payload.get('for_user_id')}",
            interaction_type="dm",
            sender_id=str(sender_id),
            message_content=text,
            status="pending"
        )
        db.add(interaction)
        await db.commit()
        background_tasks.add_task(autopilot_engine.handle_interaction, interaction.id)

    return {"status": "received"}
