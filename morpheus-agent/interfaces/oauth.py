"""
OAuth 2.0 Router for Morpheus
Handles Meta, X v2 PKCE, LinkedIn, YouTube, TikTok.
"""

import os
import secrets
import hashlib
import base64
import datetime
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import domain_settings
from infrastructure.database import get_db
from domain.models import SocialAccount, OAuthTokenRecord, AuditLogRecord
from core.security import vault
from core.logging import logger
from core.admin_auth import require_oauth_admin

router = APIRouter(prefix="/api/v1/auth", tags=["OAuth 2.0 Engine"], dependencies=[Depends(require_oauth_admin)])

pkce_store: Dict[str, Dict[str, str]] = {}


def generate_pkce_pair():
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode("utf-8")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")
    return code_verifier, code_challenge


class OAuthProviderConfig:
    @staticmethod
    def get_config(platform: str) -> Dict[str, Any]:
        callbacks = domain_settings.oauth_callbacks

        if platform == "meta":
            return {
                "auth_url": "https://www.facebook.com/v20.0/dialog/oauth",
                "token_url": "https://graph.facebook.com/v20.0/oauth/access_token",
                "client_id": os.getenv("META_APP_ID", ""),
                "client_secret": os.getenv("META_APP_SECRET", ""),
                "redirect_uri": callbacks["meta"],
                "scopes": "pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages",
                "use_pkce": False
            }
        elif platform == "x":
            return {
                "auth_url": "https://twitter.com/i/oauth2/authorize",
                "token_url": "https://api.twitter.com/2/oauth2/token",
                "client_id": os.getenv("X_CLIENT_ID", ""),
                "client_secret": os.getenv("X_CLIENT_SECRET", ""),
                "redirect_uri": callbacks["x"],
                "scopes": "tweet.read tweet.write users.read offline.access dm.read dm.write",
                "use_pkce": True
            }
        elif platform == "linkedin":
            return {
                "auth_url": "https://www.linkedin.com/oauth/v2/authorization",
                "token_url": "https://www.linkedin.com/oauth/v2/accessToken",
                "client_id": os.getenv("LINKEDIN_CLIENT_ID", ""),
                "client_secret": os.getenv("LINKEDIN_CLIENT_SECRET", ""),
                "redirect_uri": callbacks["linkedin"],
                "scopes": "openid profile email w_member_social",
                "use_pkce": False
            }
        elif platform in ("youtube", "google_youtube"):
            return {
                "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
                "token_url": "https://oauth2.googleapis.com/token",
                "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
                "redirect_uri": callbacks["google_youtube"],
                "scopes": "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl",
                "use_pkce": False,
                "extra_params": {"access_type": "offline", "prompt": "consent"}
            }
        elif platform == "tiktok":
            return {
                "auth_url": "https://www.tiktok.com/v2/auth/authorize/",
                "token_url": "https://open.tiktokapis.com/v2/oauth/token/",
                "client_key": os.getenv("TIKTOK_CLIENT_KEY", ""),
                "client_secret": os.getenv("TIKTOK_CLIENT_SECRET", ""),
                "redirect_uri": callbacks["tiktok"],
                "scopes": "user.info.basic,video.publish,video.upload",
                "use_pkce": True
            }
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported social platform: {platform}")


@router.get("/{platform}/authorize")
async def start_oauth(platform: str):
    config = OAuthProviderConfig.get_config(platform)
    state = secrets.token_urlsafe(32)

    params = {
        "response_type": "code",
        "client_id": config.get("client_id") or config.get("client_key"),
        "redirect_uri": config["redirect_uri"],
        "scope": config["scopes"],
        "state": state
    }

    if config.get("extra_params"):
        params.update(config["extra_params"])

    if config["use_pkce"]:
        verifier, challenge = generate_pkce_pair()
        pkce_store[state] = {"verifier": verifier, "platform": platform}
        params["code_challenge"] = challenge
        params["code_challenge_method"] = "S256"
    else:
        pkce_store[state] = {"platform": platform}

    query_string = httpx.QueryParams(params)
    auth_redirect = f"{config['auth_url']}?{query_string}"
    return RedirectResponse(url=auth_redirect)


@router.get("/{platform}/callback")
async def oauth_callback(
    platform: str,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    if error:
        logger.warning(f"OAuth authorization rejected: {error} - {error_description}")
        raise HTTPException(status_code=400, detail=f"OAuth authorization rejected: {error} - {error_description}")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing required code or state parameter.")

    stored_state = pkce_store.pop(state, None)
    if not stored_state or stored_state.get('platform') != platform:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state parameter.")

    config = OAuthProviderConfig.get_config(platform)
    token_url = config["token_url"]
    redirect_uri = config["redirect_uri"]

    async with httpx.AsyncClient(timeout=30.0) as client:
        token_payload: Dict[str, Any] = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri
        }

        token_headers = {"Content-Type": "application/x-www-form-urlencoded"}

        if platform == "x":
            token_payload["client_id"] = config["client_id"]
            token_payload["code_verifier"] = stored_state.get("verifier", "")
            auth_str = f"{config['client_id']}:{config['client_secret']}"
            token_headers["Authorization"] = f"Basic {base64.b64encode(auth_str.encode()).decode()}"
        elif platform == "tiktok":
            token_payload["client_key"] = config["client_key"]
            token_payload["client_secret"] = config["client_secret"]
            token_payload["code_verifier"] = stored_state.get("verifier", "")
        else:
            token_payload["client_id"] = config["client_id"]
            token_payload["client_secret"] = config["client_secret"]

        resp = await client.post(token_url, data=token_payload, headers=token_headers)
        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=400, detail=f"Failed to exchange token with {platform}: {resp.text}")

        token_data = resp.json()

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in")
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=int(expires_in)) if expires_in else None

        if platform == "meta" and access_token:
            exchange_url = "https://graph.facebook.com/v20.0/oauth/access_token"
            exchange_params = {
                "grant_type": "fb_exchange_token",
                "client_id": config["client_id"],
                "client_secret": config["client_secret"],
                "fb_exchange_token": access_token
            }
            long_resp = await client.get(exchange_url, params=exchange_params)
            if long_resp.status_code == 200:
                long_data = long_resp.json()
                access_token = long_data.get("access_token", access_token)
                long_expires = long_data.get("expires_in")
                if long_expires:
                    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=int(long_expires))

        account_info = await fetch_user_profile(client, platform, access_token)
        account_id = f"{platform}:{account_info['id']}"

        stmt = select(SocialAccount).where(SocialAccount.id == account_id)
        result = await db.execute(stmt)
        account = result.scalar_one_or_none()

        if not account:
            account = SocialAccount(
                id=account_id,
                platform=platform,
                external_account_id=str(account_info["id"]),
                username=account_info.get("username"),
                display_name=account_info.get("display_name"),
                profile_picture_url=account_info.get("avatar"),
                status="active",
                autopilot_enabled=True,
                permissions_json=["read", "write", "edit", "admin"]
            )
            db.add(account)
            await db.flush()
        else:
            account.status = "active"
            account.username = account_info.get("username", account.username)
            account.display_name = account_info.get("display_name", account.display_name)
            account.profile_picture_url = account_info.get("avatar", account.profile_picture_url)

        token_stmt = select(OAuthTokenRecord).where(OAuthTokenRecord.account_id == account_id)
        token_result = await db.execute(token_stmt)
        token_record = token_result.scalar_one_or_none()

        if not token_record:
            token_record = OAuthTokenRecord(
                account_id=account_id,
                encrypted_access_token=vault.encrypt(access_token),
                encrypted_refresh_token=vault.encrypt(refresh_token) if refresh_token else None,
                token_type=token_data.get("token_type", "Bearer"),
                scopes=config["scopes"],
                expires_at=expires_at,
                is_valid=True
            )
            db.add(token_record)
        else:
            token_record.encrypted_access_token = vault.encrypt(access_token)
            if refresh_token:
                token_record.encrypted_refresh_token = vault.encrypt(refresh_token)
            token_record.expires_at = expires_at
            token_record.is_valid = True
            token_record.last_refreshed_at = datetime.datetime.now(datetime.timezone.utc)

        db.add(AuditLogRecord(
            event_type="oauth_connected",
            platform=platform,
            details={"account_id": account_id, "username": account.username, "expires_at": str(expires_at)}
        ))

        await db.commit()

    dashboard_url = f"{domain_settings.base_url}/dashboard?platform_connected={platform}"
    return RedirectResponse(url=dashboard_url)


async def fetch_user_profile(client: httpx.AsyncClient, platform: str, access_token: str) -> Dict[str, Any]:
    try:
        if platform == "meta":
            res = await client.get("https://graph.facebook.com/v20.0/me?fields=id,name,picture", headers={"Authorization": f"Bearer {access_token}"})
            data = res.json()
            return {
                "id": data.get("id"),
                "display_name": data.get("name"),
                "username": data.get("name"),
                "avatar": data.get("picture", {}).get("data", {}).get("url")
            }
        elif platform == "x":
            res = await client.get("https://api.twitter.com/2/users/me?user.fields=profile_image_url", headers={"Authorization": f"Bearer {access_token}"})
            data = res.json().get("data", {})
            return {
                "id": data.get("id"),
                "display_name": data.get("name"),
                "username": data.get("username"),
                "avatar": data.get("profile_image_url")
            }
        elif platform == "linkedin":
            res = await client.get("https://api.linkedin.com/v2/userinfo", headers={"Authorization": f"Bearer {access_token}"})
            data = res.json()
            return {
                "id": data.get("sub"),
                "display_name": data.get("name"),
                "username": data.get("email"),
                "avatar": data.get("picture")
            }
        elif platform in ("youtube", "google_youtube"):
            res = await client.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={"Authorization": f"Bearer {access_token}"})
            data = res.json()
            return {
                "id": data.get("id"),
                "display_name": data.get("name"),
                "username": data.get("email"),
                "avatar": data.get("picture")
            }
        elif platform == "tiktok":
            res = await client.post("https://open.tiktokapis.com/v2/user/info/", headers={"Authorization": f"Bearer {access_token}"}, json={"fields": ["open_id", "display_name", "avatar_url"]})
            data = res.json().get("data", {}).get("user", {})
            return {
                "id": data.get("open_id"),
                "display_name": data.get("display_name"),
                "username": data.get("display_name"),
                "avatar": data.get("avatar_url")
            }
    except Exception:
        pass

    return {"id": "unknown_" + secrets.token_hex(4), "display_name": "Connected Account", "username": None, "avatar": None}


@router.post("/{platform}/refresh")
async def refresh_oauth_token(platform: str, db: AsyncSession = Depends(get_db)):
    config = OAuthProviderConfig.get_config(platform)
    stmt = (
        select(SocialAccount, OAuthTokenRecord)
        .join(OAuthTokenRecord, SocialAccount.id == OAuthTokenRecord.account_id)
        .where(SocialAccount.platform == platform)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail=f"No connected account found for {platform}")

    account, token_record = row
    refresh_token = vault.decrypt(token_record.encrypted_refresh_token)
    if not refresh_token:
        raise HTTPException(status_code=400, detail=f"No refresh token available for {platform}. Re-authorization required.")

    async with httpx.AsyncClient(timeout=30.0) as client:
        token_payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": config.get("client_id") or config.get("client_key"),
            "client_secret": config["client_secret"]
        }
        token_headers = {"Content-Type": "application/x-www-form-urlencoded"}

        if platform == "x":
            auth_str = f"{config['client_id']}:{config['client_secret']}"
            token_headers["Authorization"] = f"Basic {base64.b64encode(auth_str.encode()).decode()}"

        resp = await client.post(config["token_url"], data=token_payload, headers=token_headers)
        if resp.status_code not in (200, 201):
            token_record.is_valid = False
            account.status = "expired"
            await db.commit()
            raise HTTPException(status_code=400, detail=f"Token refresh rejected by {platform}: {resp.text}")

        data = resp.json()
        new_access = data.get("access_token")
        new_refresh = data.get("refresh_token")
        expires_in = data.get("expires_in")
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=int(expires_in)) if expires_in else None

        token_record.encrypted_access_token = vault.encrypt(new_access)
        if new_refresh:
            token_record.encrypted_refresh_token = vault.encrypt(new_refresh)
        token_record.expires_at = expires_at
        token_record.is_valid = True
        token_record.last_refreshed_at = datetime.datetime.now(datetime.timezone.utc)
        account.status = "active"

        db.add(AuditLogRecord(
            event_type="token_refreshed",
            platform=platform,
            details={"account_id": account.id, "expires_at": str(expires_at)}
        ))
        await db.commit()

    return {"status": "success", "platform": platform, "expires_at": expires_at}


@router.get("/status")
async def get_connections_status(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(SocialAccount, OAuthTokenRecord)
        .outerjoin(OAuthTokenRecord, SocialAccount.id == OAuthTokenRecord.account_id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    connections = []
    platforms = ["meta", "x", "linkedin", "youtube", "tiktok"]
    connected_platforms = set()

    for acc, tok in rows:
        connected_platforms.add(acc.platform)
        connections.append({
            "platform": acc.platform,
            "account_id": acc.id,
            "username": acc.username,
            "display_name": acc.display_name,
            "avatar": acc.profile_picture_url,
            "status": acc.status,
            "autopilot_enabled": acc.autopilot_enabled,
            "permissions": acc.permissions_json,
            "token_valid": tok.is_valid if tok else False,
            "expires_at": tok.expires_at.isoformat() if tok and tok.expires_at else None,
            "last_refreshed_at": tok.last_refreshed_at.isoformat() if tok and tok.last_refreshed_at else None
        })

    for p in platforms:
        if p not in connected_platforms:
            connections.append({
                "platform": p,
                "account_id": None,
                "username": None,
                "display_name": None,
                "avatar": None,
                "status": "disconnected",
                "autopilot_enabled": False,
                "permissions": [],
                "token_valid": False,
                "expires_at": None,
                "last_refreshed_at": None
            })

    return {
        "domain": domain_settings.full_host,
        "base_url": domain_settings.base_url,
        "total_connected": len(connected_platforms),
        "connections": connections
    }


@router.delete("/{platform}/disconnect")
async def disconnect_platform(platform: str, db: AsyncSession = Depends(get_db)):
    stmt = select(SocialAccount).where(SocialAccount.platform == platform)
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=404, detail=f"No account found for {platform}")

    await db.delete(account)
    db.add(AuditLogRecord(
        event_type="platform_disconnected",
        platform=platform,
        details={"platform": platform}
    ))
    await db.commit()

    return {"status": "disconnected", "platform": platform}
