"""Microsoft Teams channel implementation using Bot Framework REST API."""

import asyncio
import json
import os
import re
import time
import mimetypes
from pathlib import Path
from typing import Any

import httpx
from aiohttp import web
from loguru import logger

from nanobot.bus.events import OutboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.channels.base import BaseChannel
from nanobot.config.schema import TeamsConfig


# Bot Framework endpoints
BF_AUTH_URL = "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token"
BF_API_BASE = "https://smba.trafficmanager.net/teams"


class TeamsChannel(BaseChannel):
    """Microsoft Teams channel using Bot Framework REST API."""

    name = "teams"

    def __init__(self, config: TeamsConfig, bus: MessageBus, workspace: Any = None):
        super().__init__(config, bus, workspace=workspace)
        self.config: TeamsConfig = config
        self._http: httpx.AsyncClient | None = None
        self._access_token: str | None = None
        self._token_expires_at: float = 0
        self._app: web.Application | None = None
        self._runner: web.AppRunner | None = None
        # Store conversation references for proactive messaging
        self._conversations: dict[str, dict] = {}

    async def start(self) -> None:
        """Start the Teams webhook server to receive messages from Bot Framework."""
        if not self.config.app_id or not self.config.app_password:
            logger.error("Teams app_id and app_password are required")
            return

        self._running = True
        self._http = httpx.AsyncClient(timeout=30.0)

        # Start webhook server on a dynamic port
        self._app = web.Application()
        self._app.router.add_post("/api/messages", self._handle_webhook)

        self._runner = web.AppRunner(self._app)
        await self._runner.setup()

        # Use port from env or find an available one
        port = int(os.environ.get("TEAMS_WEBHOOK_PORT", "3978"))
        site = web.TCPSite(self._runner, "0.0.0.0", port)
        try:
            await site.start()
            logger.info(f"Teams webhook server started on port {port}")
        except OSError:
            logger.error(f"Teams: port {port} already in use")
            return

        # Keep running
        while self._running:
            await asyncio.sleep(1)

    async def stop(self) -> None:
        """Stop the Teams channel."""
        self._running = False
        if self._runner:
            await self._runner.cleanup()
            self._runner = None
        if self._http:
            await self._http.aclose()
            self._http = None

    async def send(self, msg: OutboundMessage) -> None:
        """Send a message through Teams Bot Framework API."""
        if not self._http:
            logger.warning("Teams HTTP client not initialized")
            return

        try:
            token = await self._get_access_token()
            if not token:
                logger.error("Failed to get Teams access token")
                return

            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }

            # Get conversation reference
            conv_ref = self._conversations.get(msg.chat_id)
            if not conv_ref:
                logger.error(f"No conversation reference for chat_id: {msg.chat_id}")
                return

            service_url = conv_ref.get("serviceUrl", BF_API_BASE)
            conversation_id = conv_ref.get("conversationId", msg.chat_id)

            IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}
            text_content = msg.content

            # Detect [image: path] tags
            image_pattern = re.compile(r'\[image:\s*([^\]]+)\]')
            image_matches = image_pattern.findall(text_content)
            text_content = image_pattern.sub('', text_content)

            # Detect markdown image syntax ![caption](path)
            md_image_pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
            for m in md_image_pattern.finditer(text_content):
                caption = m.group(1).strip()
                raw_path = m.group(2).strip()
                if raw_path.startswith(('http://', 'https://')):
                    text_content = text_content.replace(m.group(0), f"{caption}: {raw_path}" if caption else raw_path)
                else:
                    text_content = text_content.replace(m.group(0), f"📸 {caption}" if caption else '')

            # Clean up text
            text_content = re.sub(r'\n{3,}', '\n\n', text_content).strip()

            # Send text message
            if text_content:
                url = f"{service_url}/v3/conversations/{conversation_id}/activities"

                payload = {
                    "type": "message",
                    "text": text_content,
                    "textFormat": "markdown",
                }

                if msg.reply_to:
                    payload["replyToId"] = msg.reply_to

                for attempt in range(3):
                    try:
                        resp = await self._http.post(url, headers=headers, json=payload)
                        if resp.status_code in (200, 201):
                            return
                        if resp.status_code == 429:
                            retry_after = int(resp.headers.get("Retry-After", "1"))
                            logger.warning(f"Teams rate limited, retrying in {retry_after}s")
                            await asyncio.sleep(retry_after)
                            continue
                        logger.error(f"Teams send error: {resp.status_code} {resp.text}")
                        return
                    except Exception as e:
                        if attempt == 2:
                            logger.error(f"Error sending Teams message: {e}")
                        else:
                            await asyncio.sleep(1)

            # Upload file attachments
            for img_path in image_matches:
                img_path = img_path.strip()
                file_path = None
                if os.path.isfile(img_path):
                    file_path = img_path
                elif self.workspace and (Path(self.workspace) / img_path).is_file():
                    file_path = str(Path(self.workspace) / img_path)

                if file_path:
                    await self._send_file(service_url, conversation_id, file_path, headers)

        except Exception as e:
            logger.error(f"Teams send error: {e}")

    async def _send_file(self, service_url: str, conversation_id: str, file_path: str, headers: dict) -> None:
        """Send a file attachment to Teams."""
        try:
            filename = os.path.basename(file_path)
            content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

            with open(file_path, 'rb') as f:
                import base64
                file_data = base64.b64encode(f.read()).decode('utf-8')

            url = f"{service_url}/v3/conversations/{conversation_id}/activities"
            payload = {
                "type": "message",
                "attachments": [{
                    "contentType": content_type,
                    "contentUrl": f"data:{content_type};base64,{file_data}",
                    "name": filename,
                }]
            }
            await self._http.post(url, headers=headers, json=payload)
        except Exception as e:
            logger.warning(f"Failed to send Teams file {file_path}: {e}")

    async def _get_access_token(self) -> str | None:
        """Get or refresh the Bot Framework OAuth access token."""
        if self._access_token and time.time() < self._token_expires_at - 60:
            return self._access_token

        if not self._http:
            return None

        try:
            resp = await self._http.post(
                BF_AUTH_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.config.app_id,
                    "client_secret": self.config.app_password,
                    "scope": "https://api.botframework.com/.default",
                },
            )
            data = resp.json()

            if "access_token" in data:
                self._access_token = data["access_token"]
                self._token_expires_at = time.time() + data.get("expires_in", 3600)
                logger.debug("Teams access token refreshed")
                return self._access_token

            logger.error(f"Teams auth failed: {data.get('error_description', data)}")
        except Exception as e:
            logger.error(f"Teams auth error: {e}")

        return None

    async def _handle_webhook(self, request: web.Request) -> web.Response:
        """Handle incoming webhook from Bot Framework."""
        try:
            body = await request.json()
        except Exception:
            return web.Response(status=400, text="Invalid JSON")

        activity_type = body.get("type", "")

        # Handle conversation update (bot added to chat)
        if activity_type == "conversationUpdate":
            logger.info("Teams: conversation update received")
            self._store_conversation_ref(body)
            return web.Response(status=200)

        # Handle message
        if activity_type == "message":
            await self._handle_message_activity(body)
            return web.Response(status=200)

        # Handle other activity types
        logger.debug(f"Teams: ignoring activity type '{activity_type}'")
        return web.Response(status=200)

    async def _handle_message_activity(self, activity: dict) -> None:
        """Process an incoming message activity."""
        # Store conversation reference for replies
        self._store_conversation_ref(activity)

        sender = activity.get("from", {})
        sender_id = sender.get("id", "")
        sender_name = sender.get("name", "")
        conversation = activity.get("conversation", {})
        conversation_id = conversation.get("id", "")
        text = activity.get("text", "")
        activity_id = activity.get("id", "")

        # Strip bot mention from text (Teams includes @mention in text)
        text = re.sub(r'<at>[^<]+</at>\s*', '', text).strip()

        if not sender_id or not conversation_id or not text:
            return

        if not self.is_allowed(sender_id):
            return

        logger.debug(f"Teams message from {sender_id}|{sender_name}: {text[:100]}")

        content_parts = [text] if text else []
        media_paths: list[str] = []

        # Handle attachments
        for attachment in activity.get("attachments") or []:
            content_url = attachment.get("contentUrl")
            filename = attachment.get("name", "attachment")
            if not content_url or not self._http:
                continue
            try:
                media_dir = Path.home() / ".nanobot" / "media"
                media_dir.mkdir(parents=True, exist_ok=True)
                file_path = media_dir / f"teams_{int(time.time())}_{filename.replace('/', '_')}"

                token = await self._get_access_token()
                resp = await self._http.get(
                    content_url,
                    headers={"Authorization": f"Bearer {token}"} if token else {},
                )
                resp.raise_for_status()
                file_path.write_bytes(resp.content)
                media_paths.append(str(file_path))
                content_parts.append(f"[attachment: {file_path}]")
            except Exception as e:
                logger.warning(f"Failed to download Teams attachment: {e}")
                content_parts.append(f"[attachment: {filename} - download failed]")

        await self._handle_message(
            sender_id=sender_id,
            chat_id=conversation_id,
            content="\n".join(p for p in content_parts if p) or "[empty message]",
            media=media_paths,
            metadata={
                "activity_id": activity_id,
                "reply_to": activity_id,
                "sender_name": sender_name,
            },
        )

    def _store_conversation_ref(self, activity: dict) -> None:
        """Store conversation reference for proactive messaging."""
        conversation = activity.get("conversation", {})
        conversation_id = conversation.get("id", "")
        if conversation_id:
            self._conversations[conversation_id] = {
                "conversationId": conversation_id,
                "serviceUrl": activity.get("serviceUrl", BF_API_BASE),
                "channelId": activity.get("channelId", "msteams"),
            }
