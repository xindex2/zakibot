"""Agent loop: the core processing engine."""

import asyncio
import json
import os
from pathlib import Path
from typing import Any

from loguru import logger

from nanobot.bus.events import InboundMessage, OutboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.providers.base import LLMProvider
from nanobot.agent.context import ContextBuilder
from nanobot.agent.tools.registry import ToolRegistry
from nanobot.agent.tools.filesystem import ReadFileTool, WriteFileTool, EditFileTool, ListDirTool
from nanobot.agent.tools.shell import ExecTool
from nanobot.agent.tools.web import WebSearchTool, WebFetchTool
from nanobot.agent.tools.browser import BrowserTool
from nanobot.agent.tools.message import MessageTool
from nanobot.agent.tools.spawn import SpawnTool
from nanobot.agent.tools.cron import CronTool
from nanobot.agent.subagent import SubagentManager
from nanobot.session.manager import SessionManager


class AgentLoop:
    """
    The agent loop is the core processing engine.
    
    It:
    1. Receives messages from the bus
    2. Builds context with history, memory, skills
    3. Calls the LLM
    4. Executes tool calls
    5. Sends responses back
    """
    
    def __init__(
        self,
        bus: MessageBus,
        provider: LLMProvider,
        workspace: Path,
        model: str | None = None,
        max_iterations: int = 20,
        brave_api_key: str | None = None,
        exec_config: "ExecToolConfig | None" = None,
        browser_config: "BrowserConfig | None" = None,
        cron_service: "CronService | None" = None,
        restrict_to_workspace: bool = False,
        plan: str = "free",
        timezone: str = "UTC",
    ):
        from nanobot.config.schema import ExecToolConfig, BrowserConfig
        from nanobot.cron.service import CronService
        self.bus = bus
        self.provider = provider
        self.workspace = workspace
        self.model = model or provider.get_default_model()
        self.max_iterations = max_iterations
        self.exec_config = exec_config or ExecToolConfig()
        self.browser_config = browser_config or BrowserConfig()
        self.cron_service = cron_service
        self.restrict_to_workspace = restrict_to_workspace
        self.plan = plan
        self.timezone = timezone
        self.message_count = 0
        
        # Load workspace .env (user-placed API keys like BRAVE_API_KEY)
        # override=False means platform-injected env vars take precedence
        workspace_env = workspace / ".env"
        if workspace_env.is_file():
            try:
                from dotenv import load_dotenv
                load_dotenv(workspace_env, override=False)
                logger.info(f"Loaded workspace .env ({workspace_env})")
            except ImportError:
                # Fallback: parse simple KEY=VALUE lines manually
                import os as _os
                for line in workspace_env.read_text().splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, val = line.partition("=")
                        key, val = key.strip(), val.strip().strip("'\"")
                        _os.environ.setdefault(key, val)
                logger.info(f"Loaded workspace .env (fallback parser)")
        
        # Merge workspace .env brave key if not already set
        if not brave_api_key:
            import os as _os
            brave_api_key = _os.environ.get("BRAVE_API_KEY") or None
        self.brave_api_key = brave_api_key
        
        self.context = ContextBuilder(workspace, timezone=timezone)
        self.sessions = SessionManager(workspace)
        self.tools = ToolRegistry()
        self.subagents = SubagentManager(
            provider=provider,
            workspace=workspace,
            bus=bus,
            model=self.model,
            brave_api_key=brave_api_key,
            exec_config=self.exec_config,
            restrict_to_workspace=restrict_to_workspace,
        )
        
        self._running = False
        self._register_default_tools()
    
    def _register_default_tools(self) -> None:
        """Register the default set of tools."""
        # File tools (restrict to workspace if configured)
        allowed_dir = self.workspace if self.restrict_to_workspace else None
        self.tools.register(ReadFileTool(allowed_dir=allowed_dir))
        self.tools.register(WriteFileTool(allowed_dir=allowed_dir))
        self.tools.register(EditFileTool(allowed_dir=allowed_dir))
        self.tools.register(ListDirTool(allowed_dir=allowed_dir))
        
        # Shell tool
        if self.exec_config.enabled:
            self.tools.register(ExecTool(
                working_dir=str(self.workspace),
                timeout=self.exec_config.timeout,
                restrict_to_workspace=self.restrict_to_workspace,
            ))
        
        # Web tools
        self.tools.register(WebSearchTool(api_key=self.brave_api_key))
        self.tools.register(WebFetchTool())
        
        if self.browser_config.enabled:
            self.tools.register(BrowserTool(
                workspace=self.workspace,
                captcha_provider=self.browser_config.captcha_provider,
                captcha_api_key=self.browser_config.captcha_api_key,
                proxy_url=self.browser_config.proxy_url,
            ))
        
        # Message tool
        message_tool = MessageTool(send_callback=self.bus.publish_outbound)
        self.tools.register(message_tool)
        
        # Spawn tool (for subagents)
        spawn_tool = SpawnTool(manager=self.subagents)
        self.tools.register(spawn_tool)
        
        # Cron tool (for scheduling)
        if self.cron_service:
            self.tools.register(CronTool(self.cron_service))
    
    async def run(self) -> None:
        """Run the agent loop, processing messages from the bus."""
        self._running = True
        logger.info("Agent loop started")
        
        while self._running:
            try:
                # Wait for next message
                msg = await asyncio.wait_for(
                    self.bus.consume_inbound(),
                    timeout=1.0
                )
                
                # Process it
                try:
                    response = await self._process_message(msg)
                    if response:
                        await self.bus.publish_outbound(response)
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    # Send error response
                    await self.bus.publish_outbound(OutboundMessage(
                        channel=msg.channel,
                        chat_id=msg.chat_id,
                        content=f"Sorry, I encountered an error: {str(e)}"
                    ))
            except asyncio.TimeoutError:
                continue
    
    def stop(self) -> None:
        """Stop the agent loop."""
        self._running = False
        logger.info("Agent loop stopping")
    
    async def _process_message(self, msg: InboundMessage) -> OutboundMessage | None:
        """
        Process a single inbound message.
        
        Args:
            msg: The inbound message to process.
        
        Returns:
            The response message, or None if no response needed.
        """
        # Handle system messages (subagent announces)
        # The chat_id contains the original "channel:chat_id" to route back to
        if msg.channel == "system":
            return await self._process_system_message(msg)
        
        logger.info(f"Processing message from {msg.channel}:{msg.sender_id}")
        
        # Free Tier: bot is active but only sends the upgrade teaser (no AI replies)
        is_internal = msg.channel == "system" or msg.metadata.get("internal", False)
        if not is_internal and self.plan == "free":
            return OutboundMessage(
                channel=msg.channel,
                chat_id=msg.chat_id,
                content=(
                    "🚧 *Free trial is currently paused due to high demand.*\n\n"
                    "Activate a plan to get **$10 in free credits** "
                    "and unlock unlimited AI messages + 24/7 hosting.\n\n"
                    "👉 Upgrade here: https://myclaw.host/billing"
                )
            )

        
        # Platform credit pre-check: block messages when credits are exhausted
        if not is_internal:
            platform_url = os.environ.get("PLATFORM_URL")
            credit_user_id = os.environ.get("CREDIT_USER_ID")
            if platform_url and credit_user_id:
                try:
                    import urllib.request
                    req = urllib.request.Request(
                        f"{platform_url}/api/internal/credit-check/{credit_user_id}",
                        headers={"Accept": "application/json"}
                    )
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        data = json.loads(resp.read())
                        if not data.get("ok", True):
                            logger.warning(f"Credits exhausted for user {credit_user_id}")
                            return OutboundMessage(
                                channel=msg.channel,
                                chat_id=msg.chat_id,
                                content="⚠️ Your credits have been used up. Please top up your account to continue chatting: https://myclaw.host/topup"
                            )
                except Exception as e:
                    # Fail-closed: if the check fails, block the message to protect credits
                    logger.warning(f"Credit check failed (blocking message): {e}")
                    return OutboundMessage(
                        channel=msg.channel,
                        chat_id=msg.chat_id,
                        content="⚠️ Unable to verify your credit balance. Please try again in a moment."
                    )
        
        if not is_internal:
            self.message_count += 1
        
        # Get or create session
        session = self.sessions.get_or_create(msg.session_key)
        
        # Update tool contexts
        message_tool = self.tools.get("message")
        if isinstance(message_tool, MessageTool):
            message_tool.set_context(msg.channel, msg.chat_id)
        
        spawn_tool = self.tools.get("spawn")
        if isinstance(spawn_tool, SpawnTool):
            spawn_tool.set_context(msg.channel, msg.chat_id)
        
        cron_tool = self.tools.get("cron")
        if isinstance(cron_tool, CronTool):
            cron_tool.set_context(msg.channel, msg.chat_id)
        
        # Build initial messages (use get_history for LLM-formatted messages)
        messages = self.context.build_messages(
            history=session.get_history(),
            current_message=msg.content,
            media=msg.media if msg.media else None,
            channel=msg.channel,
            chat_id=msg.chat_id,
        )
        
        # Agent loop
        iteration = 0
        final_content = None
        total_prompt_tokens = 0
        total_completion_tokens = 0
        
        while iteration < self.max_iterations:
            iteration += 1
            
            # Call LLM
            response = await self.provider.chat(
                messages=messages,
                tools=self.tools.get_definitions(),
                model=self.model
            )
            
            # Accumulate token usage
            if response.usage:
                total_prompt_tokens += response.usage.get('prompt_tokens', 0)
                total_completion_tokens += response.usage.get('completion_tokens', 0)
            
            # Handle tool calls
            if response.has_tool_calls:
                # Add assistant message with tool calls
                tool_call_dicts = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.arguments)  # Must be JSON string
                        }
                    }
                    for tc in response.tool_calls
                ]
                messages = self.context.add_assistant_message(
                    messages, response.content, tool_call_dicts
                )
                
                # Execute tools
                sequential_failures = 0
                for tool_call in response.tool_calls:
                    args_str = json.dumps(tool_call.arguments)
                    logger.debug(f"Executing tool: {tool_call.name} with arguments: {args_str}")
                    
                    try:
                        result = await self.tools.execute(tool_call.name, tool_call.arguments)
                        
                        # Check for error signature in result
                        if isinstance(result, str) and result.startswith("Error:"):
                            sequential_failures += 1
                            logger.warning(f"Tool {tool_call.name} failed ({sequential_failures}/{self.browser_config.max_tool_retries})")
                        else:
                            sequential_failures = 0
                            
                    except Exception as e:
                        result = f"Error: Tool execution crashed: {str(e)}"
                        sequential_failures += 1
                        logger.error(f"Tool {tool_call.name} crashed: {e}")

                    messages = self.context.add_tool_result(
                        messages, tool_call.id, tool_call.name, result
                    )
                    
                    # Stop if we hit too many failures in a row within this turn
                    # This prevents the LLM from trying the same failing thing 20 times
                    max_fails = self.browser_config.max_tool_retries
                    if sequential_failures >= max_fails:
                        final_content = f"I've encountered repeated errors while trying to complete your request. The last error was: {result}. Please double-check the requirements or provide more details so I can assist better."
                        break
                
                if final_content:
                    break
            else:
                # No tool calls, we're done
                final_content = response.content
                break
        
        if final_content is None:
            final_content = "I've completed processing but have no response to give."
        
        # Save to session
        session.add_message("user", msg.content)
        session.add_message("assistant", final_content)
        self.sessions.save(session)
        
        # Emit usage report for platform credits tracking
        if total_prompt_tokens > 0 or total_completion_tokens > 0:
            usage_data = json.dumps({
                "prompt_tokens": total_prompt_tokens,
                "completion_tokens": total_completion_tokens,
                "model": self.model
            })
            print(f"[USAGE] {usage_data}", flush=True)
        
        return OutboundMessage(
            channel=msg.channel,
            chat_id=msg.chat_id,
            content=final_content
        )
    
    async def _process_system_message(self, msg: InboundMessage) -> OutboundMessage | None:
        """
        Process a system message (e.g., subagent announce).
        
        The chat_id field contains "original_channel:original_chat_id" to route
        the response back to the correct destination.
        """
        logger.info(f"Processing system message from {msg.sender_id}")
        
        # Parse origin from chat_id (format: "channel:chat_id")
        if ":" in msg.chat_id:
            parts = msg.chat_id.split(":", 1)
            origin_channel = parts[0]
            origin_chat_id = parts[1]
        else:
            # Fallback
            origin_channel = "cli"
            origin_chat_id = msg.chat_id
        
        # Use the origin session for context
        session_key = f"{origin_channel}:{origin_chat_id}"
        session = self.sessions.get_or_create(session_key)
        
        # Update tool contexts
        message_tool = self.tools.get("message")
        if isinstance(message_tool, MessageTool):
            message_tool.set_context(origin_channel, origin_chat_id)
        
        spawn_tool = self.tools.get("spawn")
        if isinstance(spawn_tool, SpawnTool):
            spawn_tool.set_context(origin_channel, origin_chat_id)
        
        cron_tool = self.tools.get("cron")
        if isinstance(cron_tool, CronTool):
            cron_tool.set_context(origin_channel, origin_chat_id)
        
        # Build messages with the announce content
        messages = self.context.build_messages(
            history=session.get_history(),
            current_message=msg.content,
            channel=origin_channel,
            chat_id=origin_chat_id,
        )
        
        # Agent loop (limited for announce handling)
        iteration = 0
        final_content = None
        
        while iteration < self.max_iterations:
            iteration += 1
            
            response = await self.provider.chat(
                messages=messages,
                tools=self.tools.get_definitions(),
                model=self.model
            )
            
            if response.has_tool_calls:
                tool_call_dicts = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.arguments)
                        }
                    }
                    for tc in response.tool_calls
                ]
                messages = self.context.add_assistant_message(
                    messages, response.content, tool_call_dicts
                )
                
                for tool_call in response.tool_calls:
                    args_str = json.dumps(tool_call.arguments)
                    logger.debug(f"Executing tool: {tool_call.name} with arguments: {args_str}")
                    result = await self.tools.execute(tool_call.name, tool_call.arguments)
                    messages = self.context.add_tool_result(
                        messages, tool_call.id, tool_call.name, result
                    )
            else:
                final_content = response.content
                break
        
        if final_content is None:
            final_content = "Background task completed."
        
        # Save to session (mark as system message in history)
        session.add_message("user", f"[System: {msg.sender_id}] {msg.content}")
        session.add_message("assistant", final_content)
        self.sessions.save(session)
        
        return OutboundMessage(
            channel=origin_channel,
            chat_id=origin_chat_id,
            content=final_content
        )
    
    async def process_direct(
        self,
        content: str,
        session_key: str = "cli:direct",
        channel: str = "cli",
        chat_id: str = "direct",
        internal: bool = False,
    ) -> str:
        """
        Process a message directly (for CLI, cron, or heartbeat usage).
        
        Args:
            content: The message content.
            session_key: Session identifier.
            channel: Source channel (for context).
            chat_id: Source chat ID (for context).
            internal: If True, exempt from rate limits (for cron/heartbeat).
        
        Returns:
            The agent's response.
        """
        msg = InboundMessage(
            channel=channel,
            sender_id="cron" if internal else "user",
            chat_id=chat_id,
            content=content,
            metadata={"internal": internal, "session_key_override": session_key},
        )
        
        response = await self._process_message(msg)
        return response.content if response else ""
