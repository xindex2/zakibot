"""Slack channel implementation using Slack Socket Mode + Web API."""

import asyncio
import json
from pathlib import Path
from typing import Any

import httpx
import websockets
from loguru import logger

from nanobot.bus.events import OutboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.channels.base import BaseChannel
from nanobot.config.schema import SlackConfig


SLACK_API_BASE = "https://slack.com/api"


class SlackChannel(BaseChannel):
    """Slack channel using Socket Mode websocket + Web API."""

    name = "slack"

    def __init__(self, config: SlackConfig, bus: MessageBus, workspace: Any = None):
        super().__init__(config, bus, workspace=workspace)
        self.config: SlackConfig = config
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._http: httpx.AsyncClient | None = None
        self._bot_user_id: str | None = None

    async def start(self) -> None:
        """Start the Slack Socket Mode connection."""
        if not self.config.bot_token or not self.config.app_token:
            logger.error("Slack bot_token and app_token are required")
            return

        self._running = True
        self._http = httpx.AsyncClient(timeout=30.0)

        # Get bot user ID to ignore own messages
        try:
            resp = await self._http.post(
                f"{SLACK_API_BASE}/auth.test",
                headers={"Authorization": f"Bearer {self.config.bot_token}"},
            )
            data = resp.json()
            if data.get("ok"):
                self._bot_user_id = data.get("user_id")
                logger.info(f"Slack bot authenticated as {data.get('user', 'unknown')}")
        except Exception as e:
            logger.error(f"Slack auth.test failed: {e}")

        while self._running:
            try:
                ws_url = await self._get_socket_url()
                if not ws_url:
                    logger.error("Failed to get Slack Socket Mode URL, retrying in 10s...")
                    await asyncio.sleep(10)
                    continue

                logger.info("Connecting to Slack Socket Mode...")
                async with websockets.connect(ws_url) as ws:
                    self._ws = ws
                    await self._socket_loop()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Slack socket error: {e}")
                if self._running:
                    logger.info("Reconnecting to Slack in 5 seconds...")
                    await asyncio.sleep(5)

    async def stop(self) -> None:
        """Stop the Slack channel."""
        self._running = False
        if self._ws:
            await self._ws.close()
            self._ws = None
        if self._http:
            await self._http.aclose()
            self._http = None

    async def send(self, msg: OutboundMessage) -> None:
        """Send a message through Slack Web API."""
        if not self._http:
            logger.warning("Slack HTTP client not initialized")
            return

        import re
        import os
        import mimetypes

        headers = {"Authorization": f"Bearer {self.config.bot_token}"}

        try:
            IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}
            text_content = msg.content

            # Detect [image: path] tags
            image_pattern = re.compile(r'\[image:\s*([^\]]+)\]')
            image_matches = image_pattern.findall(text_content)
            text_content = image_pattern.sub('', text_content)

            # Detect file paths in message
            file_pattern = re.compile(
                r'(?:`([^`]+\.\w{1,5})`'
                r'|(/[\w./ -]+\.\w{1,5})'
                r'|((?:screenshots|media|files|documents|output|generated)/[\w./ -]+\.\w{1,5}))'
            )

            general_files = []
            for m in file_pattern.finditer(text_content):
                raw_path = m.group(1) or m.group(2) or m.group(3)
                raw_path = raw_path.strip()
                candidate_paths = [Path(raw_path)]
                if self.workspace:
                    candidate_paths.append(Path(self.workspace) / raw_path)
                for p in candidate_paths:
                    if p.is_file():
                        general_files.append((m.group(0), str(p)))
                        break

            for (match_text, _) in general_files:
                text_content = text_content.replace(match_text, '')

            # Collect all files to upload
            all_files = []
            for img_path in image_matches:
                img_path = img_path.strip()
                if os.path.isfile(img_path):
                    all_files.append(img_path)
                elif self.workspace and (Path(self.workspace) / img_path).is_file():
                    all_files.append(str(Path(self.workspace) / img_path))
            for (_, file_path) in general_files:
                if file_path not in all_files:
                    all_files.append(file_path)

            # Upload files via files.upload
            for file_path in all_files:
                filename = os.path.basename(file_path)
                try:
                    with open(file_path, 'rb') as f:
                        resp = await self._http.post(
                            f"{SLACK_API_BASE}/files.upload",
                            headers=headers,
                            data={"channels": msg.chat_id, "filename": filename},
                            files={"file": (filename, f)},
                        )
                        data = resp.json()
                        if not data.get("ok"):
                            logger.warning(f"Slack file upload failed: {data.get('error')}")
                except Exception as e:
                    logger.warning(f"Failed to upload Slack file {file_path}: {e}")

            # Clean up text
            text_content = re.sub(r'\n{3,}', '\n\n', text_content).strip()

            # Send text message
            if text_content:
                payload: dict[str, Any] = {
                    "channel": msg.chat_id,
                    "text": text_content,
                }
                if msg.reply_to:
                    payload["thread_ts"] = msg.reply_to

                for attempt in range(3):
                    try:
                        resp = await self._http.post(
                            f"{SLACK_API_BASE}/chat.postMessage",
                            headers={**headers, "Content-Type": "application/json"},
                            json=payload,
                        )
                        data = resp.json()
                        if data.get("ok"):
                            return
                        if data.get("error") == "ratelimited":
                            retry_after = int(resp.headers.get("Retry-After", "1"))
                            logger.warning(f"Slack rate limited, retrying in {retry_after}s")
                            await asyncio.sleep(retry_after)
                            continue
                        logger.error(f"Slack chat.postMessage error: {data.get('error')}")
                        return
                    except Exception as e:
                        if attempt == 2:
                            logger.error(f"Error sending Slack message: {e}")
                        else:
                            await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"Slack send error: {e}")

    async def _get_socket_url(self) -> str | None:
        """Get the Socket Mode WebSocket URL."""
        if not self._http:
            return None
        try:
            resp = await self._http.post(
                f"{SLACK_API_BASE}/apps.connections.open",
                headers={"Authorization": f"Bearer {self.config.app_token}"},
            )
            data = resp.json()
            if data.get("ok"):
                return data.get("url")
            logger.error(f"Slack connections.open failed: {data.get('error')}")
        except Exception as e:
            logger.error(f"Failed to get Slack socket URL: {e}")
        return None

    async def _socket_loop(self) -> None:
        """Main Socket Mode loop: receive and handle events."""
        if not self._ws:
            return

        async for raw in self._ws:
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            # Acknowledge envelope
            envelope_id = data.get("envelope_id")
            if envelope_id:
                await self._ws.send(json.dumps({"envelope_id": envelope_id}))

            if msg_type == "hello":
                logger.info("Slack Socket Mode connected")
            elif msg_type == "disconnect":
                logger.info("Slack Socket Mode disconnect requested")
                break
            elif msg_type == "events_api":
                event = data.get("payload", {}).get("event", {})
                await self._handle_event(event)

    async def _handle_event(self, event: dict[str, Any]) -> None:
        """Handle incoming Slack events."""
        event_type = event.get("type")

        if event_type != "message":
            return

        # Ignore bot messages
        if event.get("bot_id") or event.get("subtype"):
            return
        if event.get("user") == self._bot_user_id:
            return

        sender_id = str(event.get("user", ""))
        channel_id = str(event.get("channel", ""))
        content = event.get("text") or ""
        thread_ts = event.get("thread_ts") or event.get("ts")

        if not sender_id or not channel_id:
            return

        if not self.is_allowed(sender_id):
            return

        content_parts = [content] if content else []
        media_paths: list[str] = []

        # Handle file attachments
        for file_info in event.get("files") or []:
            url = file_info.get("url_private_download") or file_info.get("url_private")
            filename = file_info.get("name") or "attachment"
            if not url or not self._http:
                continue
            try:
                media_dir = Path.home() / ".nanobot" / "media"
                media_dir.mkdir(parents=True, exist_ok=True)
                file_path = media_dir / f"{file_info.get('id', 'file')}_{filename.replace('/', '_')}"
                resp = await self._http.get(
                    url, headers={"Authorization": f"Bearer {self.config.bot_token}"}
                )
                resp.raise_for_status()
                file_path.write_bytes(resp.content)
                media_paths.append(str(file_path))
                content_parts.append(f"[attachment: {file_path}]")
            except Exception as e:
                logger.warning(f"Failed to download Slack attachment: {e}")
                content_parts.append(f"[attachment: {filename} - download failed]")

        await self._handle_message(
            sender_id=sender_id,
            chat_id=channel_id,
            content="\n".join(p for p in content_parts if p) or "[empty message]",
            media=media_paths,
            metadata={
                "message_ts": event.get("ts"),
                "thread_ts": thread_ts,
                "reply_to": thread_ts,
            },
        )
