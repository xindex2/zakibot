"""Browser tools: browser_action."""

import asyncio
import json
import os
import base64
from typing import Any, Literal
from pathlib import Path

from loguru import logger
from nanobot.agent.tools.base import Tool

class BrowserTool(Tool):
    """
    A tool to control a browser using Playwright.
    
    Supports:
    - Navigation (goto)
    - Interaction (click, type, press)
    - Observation (screenshot, content, url)
    - State (back, forward, reload)
    """
    
    name = "browser"
    description = "Control a web browser. Useful for interacting with complex websites, taking screenshots, or automating web tasks."
    parameters = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["goto", "click", "type", "press", "screenshot", "content", "url", "back", "forward", "reload", "scroll"],
                "description": "The action to perform"
            },
            "url": {"type": "string", "description": "URL for 'goto' action"},
            "selector": {"type": "string", "description": "CSS selector for 'click' or 'type' actions"},
            "text": {"type": "string", "description": "Text to type for 'type' action"},
            "key": {"type": "string", "description": "Key to press for 'press' action (e.g., 'Enter')"},
            "full_page": {"type": "boolean", "description": "Whether to take a full page screenshot", "default": False},
            "direction": {"type": "string", "enum": ["up", "down"], "description": "Scroll direction", "default": "down"},
            "amount": {"type": "integer", "description": "Amount to scroll in pixels", "default": 500}
        },
        "required": ["action"]
    }
    
    def __init__(self, workspace: Path | str):
        self.workspace = Path(workspace)
        self.browser = None
        self.context = None
        self.page = None
        self.playwright = None
        self._screenshots_dir = self.workspace / "screenshots"
        self._screenshots_dir.mkdir(exist_ok=True)

    async def _ensure_browser(self):
        """Lazy initialization of Playwright."""
        if self.page:
            return

        from playwright.async_api import async_playwright
        
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=True)
        self.context = await self.browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            # Add extra headers to appear more human
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            },
            viewport={"width": 1280, "height": 800}
        )
        self.page = await self.context.new_page()
        
        # Apply stealth patterns with extreme robustness
        try:
            import playwright_stealth
            
            # Try to find the appropriate stealth function
            stealth_func = None
            if hasattr(playwright_stealth, 'stealth_async'):
                stealth_func = playwright_stealth.stealth_async
            elif hasattr(playwright_stealth, 'stealth'):
                # Some versions/configurations might use 'stealth'
                stealth_func = playwright_stealth.stealth
            
            if stealth_func:
                # Execution might be sync or async depending on the library version
                import inspect
                if inspect.iscoroutinefunction(stealth_func):
                    await stealth_func(self.page)
                else:
                    stealth_func(self.page)
                logger.debug("Successfully applied stealth patterns.")
            else:
                logger.warning("No recognized stealth function found in playwright_stealth.")
        except ImportError:
            logger.warning("playwright_stealth library not found. Continuing without stealth.")
        except Exception as e:
            logger.warning(f"Stealth initialization failed: {e}. Continuing without stealth.")

    async def execute(self, action: str, **kwargs: Any) -> str:
        try:
            await self._ensure_browser()
            
            if action == "goto":
                url = kwargs.get("url")
                if not url:
                    return "Error: 'url' parameter is required for 'goto' action."
                # More robust navigation with fallback wait conditions
                await self.page.goto(url, wait_until="domcontentloaded", timeout=60000)
                try:
                    await self.page.wait_for_load_state("networkidle", timeout=5000)
                except:
                    pass # Network idle is optimal but domcontentloaded is often enough
                return f"Successfully navigated to {url}"
            
            elif action == "click":
                selector = kwargs.get("selector")
                if not selector:
                    return "Error: 'selector' parameter is required for 'click' action."
                await self.page.wait_for_selector(selector, state="visible", timeout=10000)
                await self.page.click(selector)
                return f"Successfully clicked on {selector}"
            
            elif action == "type":
                selector = kwargs.get("selector")
                text = kwargs.get("text")
                if not selector or text is None:
                    return "Error: 'selector' and 'text' parameters are required for 'type' action."
                await self.page.wait_for_selector(selector, state="visible", timeout=10000)
                await self.page.fill(selector, text)
                return f"Successfully typed text into {selector}"
            
            elif action == "press":
                key = kwargs.get("key")
                if not key:
                    return "Error: 'key' parameter is required for 'press' action."
                await self.page.keyboard.press(key)
                return f"Successfully pressed key {key}"
            
            elif action == "screenshot":
                full_page = kwargs.get("full_page", False)
                path = self._screenshots_dir / f"screenshot_{int(asyncio.get_event_loop().time())}.png"
                await self.page.screenshot(path=path, full_page=full_page)
                return f"Screenshot saved to {path.relative_to(self.workspace)}"
            
            elif action == "content":
                content = await self.page.content()
                return content[:10000] + ("..." if len(content) > 10000 else "")
            
            elif action == "url":
                return self.page.url
            
            elif action == "back":
                await self.page.go_back()
                return "Navigated back"
            
            elif action == "forward":
                await self.page.go_forward()
                return "Navigated forward"
            
            elif action == "reload":
                await self.page.reload()
                return "Reloaded page"
            
            elif action == "scroll":
                direction = kwargs.get("direction", "down")
                amount = kwargs.get("amount", 500)
                if direction == "down":
                    await self.page.evaluate(f"window.scrollBy(0, {amount})")
                else:
                    await self.page.evaluate(f"window.scrollBy(0, -{amount})")
                return f"Scrolled {direction} by {amount} pixels"
            
            return f"Error: Unknown action '{action}'"
            
        except Exception as e:
            current_url = self.page.url if self.page else "unknown"
            logger.error(f"Browser tool error at {current_url}: {e}")
            return f"Error ({current_url}): {str(e)}"

    async def close(self):
        """Close the browser instance."""
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        self.page = None
        self.browser = None
        self.context = None
        self.playwright = None
