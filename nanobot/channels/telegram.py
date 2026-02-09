"""Telegram channel implementation using python-telegram-bot."""

import asyncio
import re
from typing import Any

from loguru import logger
from telegram import Update
from telegram.ext import Application, MessageHandler, filters, ContextTypes

from nanobot.bus.events import OutboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.channels.base import BaseChannel
from nanobot.config.schema import TelegramConfig


def _markdown_to_telegram_html(text: str) -> str:
    """
    Convert markdown to Telegram-safe HTML.
    """
    if not text:
        return ""
    
    # 1. Extract and protect code blocks (preserve content from other processing)
    code_blocks: list[str] = []
    def save_code_block(m: re.Match) -> str:
        code_blocks.append(m.group(1))
        return f"\x00CB{len(code_blocks) - 1}\x00"
    
    text = re.sub(r'```[\w]*\n?([\s\S]*?)```', save_code_block, text)
    
    # 2. Extract and protect inline code
    inline_codes: list[str] = []
    def save_inline_code(m: re.Match) -> str:
        inline_codes.append(m.group(1))
        return f"\x00IC{len(inline_codes) - 1}\x00"
    
    text = re.sub(r'`([^`]+)`', save_inline_code, text)
    
    # 3. Headers # Title -> just the title text
    text = re.sub(r'^#{1,6}\s+(.+)$', r'\1', text, flags=re.MULTILINE)
    
    # 4. Blockquotes > text -> just the text (before HTML escaping)
    text = re.sub(r'^>\s*(.*)$', r'\1', text, flags=re.MULTILINE)
    
    # 5. Escape HTML special characters
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    
    # 6. Links [text](url) - must be before bold/italic to handle nested cases
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    
    # 7. Bold **text** or __text__
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'__(.+?)__', r'<b>\1</b>', text)
    
    # 8. Italic _text_ (avoid matching inside words like some_var_name)
    text = re.sub(r'(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])', r'<i>\1</i>', text)
    
    # 9. Strikethrough ~~text~~
    text = re.sub(r'~~(.+?)~~', r'<s>\1</s>', text)
    
    # 10. Bullet lists - item -> • item
    text = re.sub(r'^[-*]\s+', '• ', text, flags=re.MULTILINE)
    
    # 11. Restore inline code with HTML tags
    for i, code in enumerate(inline_codes):
        # Escape HTML in code content
        escaped = code.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        text = text.replace(f"\x00IC{i}\x00", f"<code>{escaped}</code>")
    
    # 12. Restore code blocks with HTML tags
    for i, code in enumerate(code_blocks):
        # Escape HTML in code content
        escaped = code.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        text = text.replace(f"\x00CB{i}\x00", f"<pre><code>{escaped}</code></pre>")
    
    return text


class TelegramChannel(BaseChannel):
    """
    Telegram channel using long polling.
    
    Simple and reliable - no webhook/public IP needed.
    """
    
    name = "telegram"
    
    def __init__(self, config: TelegramConfig, bus: MessageBus, workspace: Any = None, groq_api_key: str = ""):
        super().__init__(config, bus, workspace=workspace)
        self.config: TelegramConfig = config
        self.groq_api_key = groq_api_key
        self._app: Application | None = None
        self._chat_ids: dict[str, int] = {}  # Map sender_id to chat_id for replies
    
    async def start(self) -> None:
        """Start the Telegram bot with long polling."""
        if not self.config.token:
            logger.error("Telegram bot token not configured")
            return
        
        self._running = True
        
        # Build the application
        self._app = (
            Application.builder()
            .token(self.config.token)
            .build()
        )
        
        # Add message handler for text, photos, voice, documents
        self._app.add_handler(
            MessageHandler(
                (filters.TEXT | filters.PHOTO | filters.VOICE | filters.AUDIO | filters.Document.ALL) 
                & ~filters.COMMAND, 
                self._on_message
            )
        )
        
        # Add /start command handler
        from telegram.ext import CommandHandler
        self._app.add_handler(CommandHandler("start", self._on_start))
        
        logger.info("Starting Telegram bot (polling mode)...")
        
        # Initialize and start polling
        await self._app.initialize()
        await self._app.start()
        
        # Get bot info
        bot_info = await self._app.bot.get_me()
        logger.info(f"Telegram bot @{bot_info.username} connected")
        
        # Start polling (this runs until stopped)
        await self._app.updater.start_polling(
            allowed_updates=["message"],
            drop_pending_updates=True  # Ignore old messages on startup
        )
        
        # Keep running until stopped
        while self._running:
            await asyncio.sleep(1)
    
    async def stop(self) -> None:
        """Stop the Telegram bot."""
        self._running = False
        
        if self._app:
            logger.info("Stopping Telegram bot...")
            await self._app.updater.stop()
            await self._app.stop()
            await self._app.shutdown()
            self._app = None
    
    async def send(self, msg: OutboundMessage) -> None:
        """Send a message through Telegram."""
        if not self._app:
            logger.warning("Telegram bot not running")
            return
        
        try:
            # chat_id should be the Telegram chat ID (integer)
            chat_id = int(msg.chat_id)
            
            import os
            from pathlib import Path as P
            
            # File extension categories
            IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}
            AUDIO_EXTS = {'.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'}
            VIDEO_EXTS = {'.mp4', '.mov', '.webm', '.avi', '.mkv'}
            # Everything else (pdf, doc, xlsx, csv, txt, ...) -> document
            
            text_content = msg.content
            
            # 1) Detect [image: path] tags (legacy)
            image_pattern = re.compile(r'\[image:\s*([^\]]+)\]')
            image_matches = image_pattern.findall(text_content)
            text_content = image_pattern.sub('', text_content)
            
            # 1b) Detect markdown image syntax ![caption](path)
            md_image_pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
            md_image_matches = []
            for m in md_image_pattern.finditer(text_content):
                raw_path = m.group(2).strip()
                candidate_paths = [P(raw_path)]
                if self.workspace:
                    candidate_paths.append(P(self.workspace) / raw_path)
                for p in candidate_paths:
                    if p.is_file():
                        md_image_matches.append((m.group(0), str(p)))
                        break
            for (match_text, _) in md_image_matches:
                text_content = text_content.replace(match_text, '')
            
            # 2) Detect general file paths in the message text
            # Match absolute paths or relative workspace paths with file extensions
            file_pattern = re.compile(
                r'(?:`([^`]+\.\w{1,5})`'           # `filename.ext` in backticks
                r'|(/[\w./ -]+\.\w{1,5})'           # /absolute/path/to/file.ext
                r'|((?:screenshots|media|files|documents|output|generated)/[\w./ -]+\.\w{1,5}))'  # relative/path/file.ext
            )
            
            general_files = []
            for m in file_pattern.finditer(text_content):
                raw_path = m.group(1) or m.group(2) or m.group(3)
                raw_path = raw_path.strip()
                
                # Try to resolve the path
                candidate_paths = [
                    P(raw_path),                    # absolute path
                ]
                if self.workspace:
                    candidate_paths.append(P(self.workspace) / raw_path)  # relative to workspace
                    
                for p in candidate_paths:
                    if p.is_file():
                        general_files.append((m.group(0), str(p)))
                        break
            
            # Remove matched file references from text
            for (match_text, _) in general_files:
                text_content = text_content.replace(match_text, '')
            
            # Collect all files to send
            all_files = []
            for img_path in image_matches:
                img_path = img_path.strip()
                if os.path.isfile(img_path):
                    all_files.append(img_path)
                elif self.workspace and (P(self.workspace) / img_path).is_file():
                    all_files.append(str(P(self.workspace) / img_path))
            
            for (_, file_path) in md_image_matches:
                if file_path not in all_files:
                    all_files.append(file_path)
                    
            for (_, file_path) in general_files:
                if file_path not in all_files:
                    all_files.append(file_path)
                    
            # Send each file with the appropriate method
            for file_path in all_files:
                ext = P(file_path).suffix.lower()
                filename = P(file_path).name
                try:
                    if ext in IMAGE_EXTS:
                        with open(file_path, 'rb') as f:
                            await self._app.bot.send_photo(
                                chat_id=chat_id, photo=f, caption=f"📸 {filename}"
                            )
                    elif ext in AUDIO_EXTS:
                        with open(file_path, 'rb') as f:
                            await self._app.bot.send_audio(
                                chat_id=chat_id, audio=f, caption=f"🎵 {filename}",
                                title=filename
                            )
                    elif ext in VIDEO_EXTS:
                        with open(file_path, 'rb') as f:
                            await self._app.bot.send_video(
                                chat_id=chat_id, video=f, caption=f"🎬 {filename}"
                            )
                    else:
                        # PDF, DOCX, TXT, CSV, etc. -> send as document
                        with open(file_path, 'rb') as f:
                            await self._app.bot.send_document(
                                chat_id=chat_id, document=f, caption=f"📄 {filename}",
                                filename=filename
                            )
                except Exception as e:
                    logger.warning(f"Failed to send file {file_path}: {e}")
            
            # Clean up extra whitespace from removed file paths
            text_content = re.sub(r'\n{3,}', '\n\n', text_content).strip()
            
            # Send remaining text if any
            if text_content:
                html_content = _markdown_to_telegram_html(text_content)
                await self._app.bot.send_message(
                    chat_id=chat_id,
                    text=html_content,
                    parse_mode="HTML"
                )
        except ValueError:
            logger.error(f"Invalid chat_id: {msg.chat_id}")
        except Exception as e:
            # Fallback to plain text if HTML parsing fails
            logger.warning(f"HTML parse failed, falling back to plain text: {e}")
            try:
                await self._app.bot.send_message(
                    chat_id=int(msg.chat_id),
                    text=msg.content
                )
            except Exception as e2:
                logger.error(f"Error sending Telegram message: {e2}")
    
    async def _on_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /start command."""
        if not update.message or not update.effective_user:
            return
        
        user = update.effective_user
        await update.message.reply_text(
            f"👋 Hi {user.first_name}! I'm Agentchat.\n\n"
            "Send me a message and I'll respond!"
        )
    
    async def _on_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle incoming messages (text, photos, voice, documents)."""
        if not update.message or not update.effective_user:
            return
        
        message = update.message
        user = update.effective_user
        chat_id = message.chat_id
        
        # Use stable numeric ID, but keep username for allowlist compatibility
        sender_id = str(user.id)
        if user.username:
            sender_id = f"{sender_id}|{user.username}"
        
        # Store chat_id for replies
        self._chat_ids[sender_id] = chat_id
        
        # Build content from text and/or media
        content_parts = []
        media_paths = []
        
        # Text content
        if message.text:
            content_parts.append(message.text)
        if message.caption:
            content_parts.append(message.caption)
        
        # Handle media files
        media_file = None
        media_type = None
        
        if message.photo:
            media_file = message.photo[-1]  # Largest photo
            media_type = "image"
        elif message.voice:
            media_file = message.voice
            media_type = "voice"
        elif message.audio:
            media_file = message.audio
            media_type = "audio"
        elif message.document:
            media_file = message.document
            media_type = "file"
        
        # Download media if present
        if media_file and self._app:
            try:
                file = await self._app.bot.get_file(media_file.file_id)
                ext = self._get_extension(media_type, getattr(media_file, 'mime_type', None))
                
                # Save to workspace/media/
                from pathlib import Path
                media_dir = Path.home() / ".nanobot" / "media"
                media_dir.mkdir(parents=True, exist_ok=True)
                
                file_path = media_dir / f"{media_file.file_id[:16]}{ext}"
                await file.download_to_drive(str(file_path))
                
                media_paths.append(str(file_path))
                
                # Handle voice transcription
                if media_type == "voice" or media_type == "audio":
                    from nanobot.providers.transcription import GroqTranscriptionProvider
                    transcriber = GroqTranscriptionProvider(api_key=self.groq_api_key)
                    transcription = await transcriber.transcribe(file_path)
                    if transcription:
                        logger.info(f"Transcribed {media_type}: {transcription[:50]}...")
                        content_parts.append(f"[transcription: {transcription}]")
                    else:
                        content_parts.append(f"[{media_type}: {file_path}]")
                else:
                    content_parts.append(f"[{media_type}: {file_path}]")
                    
                logger.debug(f"Downloaded {media_type} to {file_path}")
            except Exception as e:
                logger.error(f"Failed to download media: {e}")
                content_parts.append(f"[{media_type}: download failed]")
        
        content = "\n".join(content_parts) if content_parts else "[empty message]"
        
        logger.debug(f"Telegram message from {sender_id}: {content[:50]}...")
        
        # Forward to the message bus
        await self._handle_message(
            sender_id=sender_id,
            chat_id=str(chat_id),
            content=content,
            media=media_paths,
            metadata={
                "message_id": message.message_id,
                "user_id": user.id,
                "username": user.username,
                "first_name": user.first_name,
                "is_group": message.chat.type != "private"
            }
        )
    
    def _get_extension(self, media_type: str, mime_type: str | None) -> str:
        """Get file extension based on media type."""
        if mime_type:
            ext_map = {
                "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif",
                "audio/ogg": ".ogg", "audio/mpeg": ".mp3", "audio/mp4": ".m4a",
            }
            if mime_type in ext_map:
                return ext_map[mime_type]
        
        type_map = {"image": ".jpg", "voice": ".ogg", "audio": ".mp3", "file": ""}
        return type_map.get(media_type, "")
