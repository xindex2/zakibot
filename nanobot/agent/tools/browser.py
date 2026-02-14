"""Browser tools: browser_action — stealth-first, CAPTCHA-solving browser automation."""

import asyncio
import json
import os
import re
import random
import time
import base64
import httpx
from typing import Any
from pathlib import Path

from loguru import logger
from nanobot.agent.tools.base import Tool


# ---------------------------------------------------------------------------
# User-Agent rotation pool — pick a random one per browser session
# ---------------------------------------------------------------------------

UA_POOL = [
    # Chrome 131 — Windows 10
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
     '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', '"Windows"'),
    # Chrome 131 — macOS
    ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
     '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', '"macOS"'),
    # Chrome 130 — Windows 10
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
     '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="99"', '"Windows"'),
    # Chrome 130 — macOS
    ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
     '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="99"', '"macOS"'),
    # Chrome 129 — Windows 11
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
     '"Google Chrome";v="129", "Chromium";v="129", "Not_A Brand";v="24"', '"Windows"'),
    # Edge 131 — Windows
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
     '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"', '"Windows"'),
    # Chrome 131 — Linux
    ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
     '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', '"Linux"'),
    # Chrome 128 — macOS
    ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
     '"Google Chrome";v="128", "Chromium";v="128", "Not-A.Brand";v="99"', '"macOS"'),
]

# Common desktop viewport sizes — one is picked randomly per session
VIEWPORT_POOL = [
    {"width": 1920, "height": 1080},
    {"width": 1536, "height": 864},
    {"width": 1440, "height": 900},
    {"width": 1366, "height": 768},
    {"width": 1280, "height": 720},
    {"width": 1600, "height": 900},
]

# ---------------------------------------------------------------------------
# Stealth JS — injected into every new page context to mask automation signals
# ---------------------------------------------------------------------------

STEALTH_JS = """
// 1. Hide navigator.webdriver
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

// 2. Fake chrome object
if (!window.chrome) {
    window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){} };
}

// 3. Fake plugins (Chrome has at least 3)
Object.defineProperty(navigator, 'plugins', {
    get: () => {
        const fakes = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ];
        const arr = fakes.map(p => {
            const o = Object.create(Plugin.prototype);
            Object.defineProperty(o, 'name', { get: () => p.name });
            Object.defineProperty(o, 'filename', { get: () => p.filename });
            Object.defineProperty(o, 'description', { get: () => p.name });
            Object.defineProperty(o, 'length', { get: () => 1 });
            return o;
        });
        arr.length = fakes.length;
        return arr;
    }
});

// 4. Fake languages
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

// 5. Spoof WebGL renderer
const getParameterOrig = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(p) {
    if (p === 37445) return 'Intel Inc.';
    if (p === 37446) return 'Intel Iris OpenGL Engine';
    return getParameterOrig.call(this, p);
};

// 6. Fix permissions query (Playwright signature)
if (navigator.permissions) {
    const origQuery = navigator.permissions.query;
    navigator.permissions.query = (params) => {
        if (params.name === 'notifications') {
            return Promise.resolve({ state: Notification.permission });
        }
        return origQuery.call(navigator.permissions, params);
    };
}

// 7. Mock connection info
Object.defineProperty(navigator, 'connection', {
    get: () => ({ effectiveType: '4g', rtt: 50, downlink: 10, saveData: false })
});

// 8. Match screen dimensions to viewport (avoid Playwright fingerprint)
Object.defineProperty(screen, 'width', { get: () => window.innerWidth });
Object.defineProperty(screen, 'height', { get: () => window.innerHeight });
Object.defineProperty(screen, 'availWidth', { get: () => window.innerWidth });
Object.defineProperty(screen, 'availHeight', { get: () => window.innerHeight });

// 9. Spoof hardware specs (article technique #8 — deviceMemory/hardwareConcurrency)
Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });

// 10. Fake battery API (some fingerprinters check this)
if (navigator.getBattery) {
    navigator.getBattery = () => Promise.resolve({
        charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1.0,
        addEventListener: () => {}, removeEventListener: () => {}
    });
}

// 11. Prevent iframe detection (Playwright creates hidden iframes)
Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    get: function() { return window; }
});
"""

# Common cookie consent selectors to auto-dismiss
COOKIE_DISMISS_SELECTORS = [
    '[id*="cookie"] button[class*="accept"]',
    '[id*="cookie"] button[class*="agree"]',
    '[class*="cookie"] button[class*="accept"]',
    '[class*="cookie"] button[class*="agree"]',
    '[id*="consent"] button[class*="accept"]',
    'button[id*="accept-cookie"]',
    'button[id*="acceptCookie"]',
    'button[aria-label*="Accept"]',
    'button[aria-label*="accept"]',
    '#onetrust-accept-btn-handler',
    '.cc-accept',
    '.cc-dismiss',
    '[data-testid="cookie-policy-manage-dialog-btn-accept"]',
]


# ---------------------------------------------------------------------------
# CAPTCHA Solver — supports CapSolver, 2Captcha, Anti-Captcha
# ---------------------------------------------------------------------------

class CaptchaSolver:
    """
    Auto-detects and solves reCAPTCHA v2, reCAPTCHA v3, hCaptcha, and Turnstile
    using external solving services.
    
    Configured via bot config (tools.browser.captcha_provider + captcha_api_key)
    or env vars as fallback.
    """
    
    PROVIDER_MAP = {
        "capsolver": "capsolver",
        "2captcha": "twocaptcha",
        "twocaptcha": "twocaptcha",
        "anticaptcha": "anticaptcha",
        "anti-captcha": "anticaptcha",
    }
    
    def __init__(self, provider: str = "", api_key: str = ""):
        # Normalize provider name
        provider_norm = self.PROVIDER_MAP.get(provider.lower().strip(), "") if provider else ""
        
        # Set keys based on explicit config or fall back to env vars
        self.capsolver_key = (
            api_key if provider_norm == "capsolver" 
            else os.environ.get("CAPSOLVER_API_KEY", "")
        )
        self.twocaptcha_key = (
            api_key if provider_norm == "twocaptcha" 
            else os.environ.get("TWOCAPTCHA_API_KEY", "")
        )
        self.anticaptcha_key = (
            api_key if provider_norm == "anticaptcha" 
            else os.environ.get("ANTICAPTCHA_API_KEY", "")
        )
    
    @property
    def available(self) -> bool:
        return bool(self.capsolver_key or self.twocaptcha_key or self.anticaptcha_key)
    
    @property
    def provider_name(self) -> str:
        if self.capsolver_key:
            return "CapSolver"
        if self.twocaptcha_key:
            return "2Captcha"
        if self.anticaptcha_key:
            return "Anti-Captcha"
        return "none"
    
    async def detect_captcha(self, page) -> dict | None:
        """
        Detect CAPTCHA on the current page.
        Returns dict with captcha_type, sitekey, and page_url, or None.
        """
        detection_js = """
        () => {
            // reCAPTCHA v2 (iframe or div)
            const recaptchaFrame = document.querySelector('iframe[src*="recaptcha"]');
            const recaptchaDiv = document.querySelector('.g-recaptcha, [data-sitekey]');
            
            if (recaptchaDiv) {
                const sitekey = recaptchaDiv.getAttribute('data-sitekey');
                if (sitekey) {
                    // Check if it's v3 (invisible) or v2
                    const isV3 = recaptchaDiv.getAttribute('data-size') === 'invisible' 
                              || document.querySelector('script[src*="recaptcha/api.js?render="]');
                    return {
                        type: isV3 ? 'recaptcha_v3' : 'recaptcha_v2',
                        sitekey: sitekey,
                        action: recaptchaDiv.getAttribute('data-action') || 'verify'
                    };
                }
            }
            
            if (recaptchaFrame) {
                const src = recaptchaFrame.src;
                const match = src.match(/[?&]k=([^&]+)/);
                if (match) {
                    return { type: 'recaptcha_v2', sitekey: match[1] };
                }
            }
            
            // hCaptcha
            const hcaptchaFrame = document.querySelector('iframe[src*="hcaptcha"]');
            const hcaptchaDiv = document.querySelector('.h-captcha, [data-hcaptcha-sitekey]');
            
            if (hcaptchaDiv) {
                const sitekey = hcaptchaDiv.getAttribute('data-sitekey') 
                             || hcaptchaDiv.getAttribute('data-hcaptcha-sitekey');
                if (sitekey) {
                    return { type: 'hcaptcha', sitekey: sitekey };
                }
            }
            
            if (hcaptchaFrame) {
                const src = hcaptchaFrame.src;
                const match = src.match(/[?&]sitekey=([^&]+)/);
                if (match) {
                    return { type: 'hcaptcha', sitekey: match[1] };
                }
            }
            
            // Cloudflare Turnstile
            const turnstile = document.querySelector('.cf-turnstile, [data-turnstile-sitekey]');
            if (turnstile) {
                const sitekey = turnstile.getAttribute('data-sitekey') 
                             || turnstile.getAttribute('data-turnstile-sitekey');
                if (sitekey) {
                    return { type: 'turnstile', sitekey: sitekey };
                }
            }
            
            return null;
        }
        """
        try:
            result = await page.evaluate(detection_js)
            if result:
                result["page_url"] = page.url
            return result
        except Exception as e:
            logger.warning(f"CAPTCHA detection failed: {e}")
            return None
    
    async def solve(self, captcha_info: dict) -> str | None:
        """
        Solve a detected CAPTCHA using the configured provider.
        Returns the solution token, or None on failure.
        """
        captcha_type = captcha_info.get("type", "")
        sitekey = captcha_info.get("sitekey", "")
        page_url = captcha_info.get("page_url", "")
        action = captcha_info.get("action", "verify")
        
        if not sitekey or not page_url:
            return None
        
        logger.info(f"Solving {captcha_type} (sitekey={sitekey[:12]}...) via {self.provider_name}")

        if self.capsolver_key:
            return await self._solve_capsolver(captcha_type, sitekey, page_url, action)
        elif self.twocaptcha_key:
            return await self._solve_2captcha(captcha_type, sitekey, page_url, action)
        elif self.anticaptcha_key:
            return await self._solve_anticaptcha(captcha_type, sitekey, page_url, action)
        return None
    
    # ---- CapSolver ----
    async def _solve_capsolver(self, ctype: str, sitekey: str, url: str, action: str) -> str | None:
        task_type_map = {
            "recaptcha_v2": "ReCaptchaV2TaskProxyLess",
            "recaptcha_v3": "ReCaptchaV3TaskProxyLess",
            "hcaptcha": "HCaptchaTaskProxyLess",
            "turnstile": "AntiTurnstileTaskProxyLess",
        }
        task_type = task_type_map.get(ctype)
        if not task_type:
            return None
        
        task = {
            "type": task_type,
            "websiteURL": url,
            "websiteKey": sitekey,
        }
        if ctype == "recaptcha_v3":
            task["pageAction"] = action
            task["minScore"] = 0.7
        
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                # Create task
                resp = await client.post(
                    "https://api.capsolver.com/createTask",
                    json={"clientKey": self.capsolver_key, "task": task},
                )
                data = resp.json()
                
                if data.get("errorId", 0) != 0:
                    logger.error(f"CapSolver create error: {data.get('errorDescription')}")
                    return None
                
                task_id = data.get("taskId")
                if not task_id:
                    return None
                
                # Poll for result (max 120s)
                for _ in range(60):
                    await asyncio.sleep(2)
                    resp = await client.post(
                        "https://api.capsolver.com/getTaskResult",
                        json={"clientKey": self.capsolver_key, "taskId": task_id},
                    )
                    result = resp.json()
                    
                    status = result.get("status", "")
                    if status == "ready":
                        solution = result.get("solution", {})
                        token = solution.get("gRecaptchaResponse") or solution.get("token") or solution.get("text")
                        if token:
                            logger.info(f"CapSolver solved {ctype} successfully")
                            return token
                        return None
                    elif status == "failed":
                        logger.error(f"CapSolver failed: {result.get('errorDescription')}")
                        return None
                
                logger.error("CapSolver timeout")
                return None
        except Exception as e:
            logger.error(f"CapSolver error: {e}")
            return None
    
    # ---- 2Captcha ----
    async def _solve_2captcha(self, ctype: str, sitekey: str, url: str, action: str) -> str | None:
        method_map = {
            "recaptcha_v2": "userrecaptcha",
            "recaptcha_v3": "userrecaptcha",
            "hcaptcha": "hcaptcha",
            "turnstile": "turnstile",
        }
        method = method_map.get(ctype)
        if not method:
            return None
        
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                params = {
                    "key": self.twocaptcha_key,
                    "method": method,
                    "sitekey": sitekey,
                    "pageurl": url,
                    "json": 1,
                }
                if ctype == "recaptcha_v3":
                    params["version"] = "v3"
                    params["action"] = action
                    params["min_score"] = "0.7"
                
                # Submit
                resp = await client.post(
                    "https://2captcha.com/in.php",
                    data=params,
                )
                data = resp.json()
                
                if data.get("status") != 1:
                    logger.error(f"2Captcha submit error: {data.get('request')}")
                    return None
                
                task_id = data.get("request")
                
                # Poll for result (max 120s)
                for _ in range(40):
                    await asyncio.sleep(3)
                    resp = await client.get(
                        "https://2captcha.com/res.php",
                        params={
                            "key": self.twocaptcha_key,
                            "action": "get",
                            "id": task_id,
                            "json": 1,
                        },
                    )
                    result = resp.json()
                    
                    if result.get("status") == 1:
                        token = result.get("request")
                        logger.info(f"2Captcha solved {ctype} successfully")
                        return token
                    elif result.get("request") != "CAPCHA_NOT_READY":
                        logger.error(f"2Captcha error: {result.get('request')}")
                        return None
                
                logger.error("2Captcha timeout")
                return None
        except Exception as e:
            logger.error(f"2Captcha error: {e}")
            return None
    
    # ---- Anti-Captcha ----
    async def _solve_anticaptcha(self, ctype: str, sitekey: str, url: str, action: str) -> str | None:
        task_type_map = {
            "recaptcha_v2": "RecaptchaV2TaskProxyless",
            "recaptcha_v3": "RecaptchaV3TaskProxyless",
            "hcaptcha": "HCaptchaTaskProxyless",
            "turnstile": "TurnstileTaskProxyless",
        }
        task_type = task_type_map.get(ctype)
        if not task_type:
            return None
        
        task = {
            "type": task_type,
            "websiteURL": url,
            "websiteKey": sitekey,
        }
        if ctype == "recaptcha_v3":
            task["pageAction"] = action
            task["minScore"] = 0.7
        
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.anti-captcha.com/createTask",
                    json={"clientKey": self.anticaptcha_key, "task": task},
                )
                data = resp.json()
                
                if data.get("errorId", 0) != 0:
                    logger.error(f"Anti-Captcha error: {data.get('errorDescription')}")
                    return None
                
                task_id = data.get("taskId")
                
                for _ in range(40):
                    await asyncio.sleep(3)
                    resp = await client.post(
                        "https://api.anti-captcha.com/getTaskResult",
                        json={"clientKey": self.anticaptcha_key, "taskId": task_id},
                    )
                    result = resp.json()
                    
                    status = result.get("status", "")
                    if status == "ready":
                        solution = result.get("solution", {})
                        token = solution.get("gRecaptchaResponse") or solution.get("token") or solution.get("text")
                        if token:
                            logger.info(f"Anti-Captcha solved {ctype} successfully")
                            return token
                        return None
                    elif result.get("errorId", 0) != 0:
                        logger.error(f"Anti-Captcha error: {result.get('errorDescription')}")
                        return None
                
                logger.error("Anti-Captcha timeout")
                return None
        except Exception as e:
            logger.error(f"Anti-Captcha error: {e}")
            return None
    
    async def inject_token(self, page, captcha_info: dict, token: str) -> bool:
        """Inject the solved CAPTCHA token into the page and submit."""
        ctype = captcha_info.get("type", "")
        
        inject_js = """
        (token) => {
            // reCAPTCHA v2/v3
            const recaptchaTextarea = document.querySelector('#g-recaptcha-response') 
                || document.querySelector('[name="g-recaptcha-response"]')
                || document.querySelector('textarea[id*="g-recaptcha-response"]');
            if (recaptchaTextarea) {
                recaptchaTextarea.value = token;
                recaptchaTextarea.style.display = 'block';  // make visible for form submission
                recaptchaTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Also set in all iframes response textareas
            document.querySelectorAll('textarea[id*="g-recaptcha-response"]').forEach(el => {
                el.value = token;
                el.style.display = 'block';
            });
            
            // hCaptcha
            const hTextarea = document.querySelector('[name="h-captcha-response"]')
                || document.querySelector('textarea[data-hcaptcha-response]');
            if (hTextarea) {
                hTextarea.value = token;
                hTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Turnstile
            const tInput = document.querySelector('[name="cf-turnstile-response"]')
                || document.querySelector('input[name*="turnstile"]');
            if (tInput) {
                tInput.value = token;
                tInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Try to call reCAPTCHA callback
            try {
                if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
                    for (const clientId of Object.keys(window.___grecaptcha_cfg.clients)) {
                        const client = window.___grecaptcha_cfg.clients[clientId];
                        // Walk the client object to find callback
                        const findCallback = (obj, depth = 0) => {
                            if (depth > 5 || !obj) return null;
                            for (const key of Object.keys(obj)) {
                                if (typeof obj[key] === 'function' && key !== 'bind') {
                                    return obj[key];
                                }
                                if (typeof obj[key] === 'object') {
                                    const found = findCallback(obj[key], depth + 1);
                                    if (found) return found;
                                }
                            }
                            return null;
                        };
                        const cb = findCallback(client);
                        if (cb) {
                            cb(token);
                            return true;
                        }
                    }
                }
            } catch (e) {}
            
            // Try submitting the form
            try {
                const form = (recaptchaTextarea || hTextarea || tInput)?.closest('form');
                if (form) {
                    const submit = form.querySelector('[type="submit"], button:not([type="button"])');
                    if (submit) {
                        submit.click();
                        return true;
                    }
                    form.submit();
                    return true;
                }
            } catch (e) {}
            
            return true;
        }
        """
        
        try:
            result = await page.evaluate(inject_js, token)
            logger.info(f"Injected {ctype} token into page")
            return bool(result)
        except Exception as e:
            logger.error(f"Token injection failed: {e}")
            return False


class BrowserTool(Tool):
    """
    A stealth-first browser tool with CAPTCHA auto-solving.
    
    Supports:
    - Navigation with cookie banner auto-dismissal
    - Human-like interaction (click, type, type_slowly, hover)
    - Text-based element finding (no CSS selectors needed)  
    - Wait conditions (text, selector, URL, time)
    - JavaScript evaluation
    - Page content extraction (cleaned text, not raw HTML)
    - CAPTCHA auto-detection and solving (reCAPTCHA v2/v3, hCaptcha, Turnstile)
    - Screenshots
    """
    
    name = "browser"
    description = (
        "Control a stealth web browser with CAPTCHA solving. "
        "Actions: goto, click, type, type_slowly, find_text, hover, press, "
        "select_option, wait, evaluate, screenshot, extract, content, url, "
        "scroll, back, forward, reload, fill_form, solve_captcha. "
        "Use 'find_text' to click elements by visible text instead of CSS selectors. "
        "Use 'type_slowly' for sites with bot detection. "
        "Use 'solve_captcha' when a CAPTCHA blocks the page — it auto-detects and solves it. "
        "Use 'extract' to get clean readable text from pages."
    )
    parameters = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "goto", "click", "type", "type_slowly", "find_text",
                    "hover", "press", "select_option", "wait", "evaluate",
                    "screenshot", "extract", "content", "url",
                    "scroll", "back", "forward", "reload", "fill_form",
                    "solve_captcha"
                ],
                "description": "The action to perform"
            },
            "url": {"type": "string", "description": "URL for 'goto' action"},
            "selector": {"type": "string", "description": "CSS selector for element actions"},
            "text": {"type": "string", "description": "Text to type, or visible text to find (for find_text)"},
            "key": {"type": "string", "description": "Key to press for 'press' action (e.g., 'Enter')"},
            "value": {"type": "string", "description": "Value for 'select_option' action"},
            "expression": {"type": "string", "description": "JavaScript expression for 'evaluate' action"},
            "wait_for": {
                "type": "string",
                "description": "What to wait for: 'text:Hello', 'selector:.done', 'url:example.com', or milliseconds like '3000'"
            },
            "full_page": {"type": "boolean", "description": "Full page screenshot", "default": False},
            "direction": {"type": "string", "enum": ["up", "down"], "default": "down"},
            "amount": {"type": "integer", "description": "Scroll pixels", "default": 500},
            "fields": {
                "type": "array",
                "description": "For fill_form: array of {selector, value} objects",
                "items": {
                    "type": "object",
                    "properties": {
                        "selector": {"type": "string"},
                        "value": {"type": "string"}
                    }
                }
            }
        },
        "required": ["action"]
    }
    
    def __init__(self, workspace: Path | str, captcha_provider: str = "", captcha_api_key: str = "", proxy_url: str = ""):
        self.workspace = Path(workspace)
        self.browser = None
        self.context = None
        self.page = None
        self.playwright = None
        self._proxy_url = proxy_url
        self._screenshots_dir = self.workspace / "screenshots"
        self._screenshots_dir.mkdir(exist_ok=True)
        self._captcha_solver = CaptchaSolver(provider=captcha_provider, api_key=captcha_api_key)

    # ------------------------------------------------------------------
    # Browser lifecycle
    # ------------------------------------------------------------------

    async def _ensure_browser(self):
        """Lazy initialization with full stealth."""
        if self.page and not self.page.is_closed():
            return

        from playwright.async_api import async_playwright
        
        self.playwright = await async_playwright().start()
        
        # Launch with stealth flags
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-size=1920,1080',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
            ]
        )
        
        # Pick a random UA + viewport per session (article technique #2 & #7)
        ua_string, sec_ch_ua, sec_ch_platform = random.choice(UA_POOL)
        viewport = random.choice(VIEWPORT_POOL)
        
        # Pick a random timezone to match diversity
        tz = random.choice(["America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Paris"])
        
        # Build context options
        context_opts = dict(
            user_agent=ua_string,
            extra_http_headers={
                "Accept-Language": random.choice(["en-US,en;q=0.9", "en-US,en;q=0.9,fr;q=0.8", "en-GB,en;q=0.9"]),
                "Accept": (
                    "text/html,application/xhtml+xml,application/xml;q=0.9,"
                    "image/avif,image/webp,image/apng,*/*;q=0.8"
                ),
                "Sec-CH-UA": sec_ch_ua,
                "Sec-CH-UA-Mobile": "?0",
                "Sec-CH-UA-Platform": sec_ch_platform,
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-User": "?1",
                "Sec-Fetch-Dest": "document",
            },
            viewport=viewport,
            locale="en-US",
            timezone_id=tz,
            device_scale_factor=random.choice([1, 1, 1, 2]),  # Most are 1x, some Retina
            color_scheme=random.choice(["light", "light", "light", "dark"]),  # Most users use light
        )
        logger.debug(f"Session fingerprint: UA={ua_string[:50]}... viewport={viewport['width']}x{viewport['height']} tz={tz}")
        
        # Add proxy if configured
        if self._proxy_url:
            proxy_conf: dict[str, str] = {"server": self._proxy_url}
            # Parse credentials from URL like http://user:pass@host:port
            try:
                from urllib.parse import urlparse
                parsed = urlparse(self._proxy_url)
                if parsed.username:
                    proxy_conf["username"] = parsed.username
                if parsed.password:
                    proxy_conf["password"] = parsed.password
                # Rebuild server without credentials
                server = f"{parsed.scheme}://{parsed.hostname}"
                if parsed.port:
                    server += f":{parsed.port}"
                proxy_conf["server"] = server
            except Exception:
                pass  # Use raw URL as-is
            context_opts["proxy"] = proxy_conf
            logger.info(f"Browser using proxy: {proxy_conf['server']}")
        
        self.context = await self.browser.new_context(**context_opts)
        
        # Inject stealth JS into every page
        await self.context.add_init_script(STEALTH_JS)
        
        self.page = await self.context.new_page()
        
        # Apply playwright-stealth patches on top of custom stealth JS
        try:
            from playwright_stealth import stealth_async
            await stealth_async(self.page)
        except ImportError:
            logger.debug("playwright-stealth not installed, using custom stealth JS only")
        
        logger.info("Browser started with stealth configuration")

    # ------------------------------------------------------------------
    # Human-like helpers
    # ------------------------------------------------------------------

    async def _human_delay(self, min_ms: int = 50, max_ms: int = 200):
        """Add a human-like random delay."""
        delay = random.randint(min_ms, max_ms) / 1000
        await asyncio.sleep(delay)

    async def _human_mouse_move(self, target_x: float, target_y: float, steps: int = 0):
        """Move mouse along a natural Bézier curve to the target point (article technique #4)."""
        if not self.page:
            return
        try:
            # Get current mouse position (default to a random start if unknown)
            start_x = random.uniform(100, 400)
            start_y = random.uniform(100, 400)
            
            # Generate 2 random control points for a cubic Bézier curve
            cp1_x = start_x + (target_x - start_x) * random.uniform(0.2, 0.5) + random.uniform(-50, 50)
            cp1_y = start_y + (target_y - start_y) * random.uniform(0.1, 0.4) + random.uniform(-30, 30)
            cp2_x = start_x + (target_x - start_x) * random.uniform(0.5, 0.8) + random.uniform(-50, 50)
            cp2_y = start_y + (target_y - start_y) * random.uniform(0.6, 0.9) + random.uniform(-30, 30)

            num_steps = steps or random.randint(8, 18)
            for i in range(num_steps + 1):
                t = i / num_steps
                # Cubic Bézier interpolation
                x = (1-t)**3 * start_x + 3*(1-t)**2*t * cp1_x + 3*(1-t)*t**2 * cp2_x + t**3 * target_x
                y = (1-t)**3 * start_y + 3*(1-t)**2*t * cp1_y + 3*(1-t)*t**2 * cp2_y + t**3 * target_y
                await self.page.mouse.move(x, y)
                await asyncio.sleep(random.uniform(0.005, 0.025))
        except Exception:
            pass  # Fallback: Playwright will move directly on click

    async def _dismiss_cookie_banners(self):
        """Try to auto-dismiss common cookie consent popups."""
        for selector in COOKIE_DISMISS_SELECTORS:
            try:
                el = self.page.locator(selector).first
                if await el.is_visible(timeout=500):
                    await el.click(timeout=1000)
                    logger.debug(f"Dismissed cookie banner via {selector}")
                    await asyncio.sleep(0.3)
                    return
            except Exception:
                continue

    async def _auto_solve_captcha(self) -> str | None:
        """Detect and solve CAPTCHA if present. Returns status message or None."""
        if not self._captcha_solver.available:
            return None
        
        captcha_info = await self._captcha_solver.detect_captcha(self.page)
        if not captcha_info:
            return None
        
        logger.info(f"CAPTCHA detected: {captcha_info['type']}")
        token = await self._captcha_solver.solve(captcha_info)
        if not token:
            return f"⚠ CAPTCHA detected ({captcha_info['type']}) but solving failed"
        
        await self._captcha_solver.inject_token(self.page, captcha_info, token)
        # Wait for page to react
        await asyncio.sleep(2)
        try:
            await self.page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            pass
        return f"✅ Solved {captcha_info['type']} CAPTCHA via {self._captcha_solver.provider_name}"

    async def _retry_action(self, action_fn, retries: int = 1):
        """Retry an action once on failure with a short delay."""
        try:
            return await action_fn()
        except Exception as e:
            if retries > 0:
                await asyncio.sleep(0.5)
                return await self._retry_action(action_fn, retries - 1)
            raise e

    def _extract_text(self, html: str) -> str:
        """Extract clean readable text from HTML."""
        text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
        text = text.replace('&quot;', '"').replace('&#39;', "'").replace('&nbsp;', ' ')
        text = re.sub(r'\s+', ' ', text).strip()
        if len(text) > 8000:
            text = text[:8000] + "\n\n[...TRUNCATED — page too large, use 'evaluate' for specific data]"
        return text

    # ------------------------------------------------------------------
    # Main execute
    # ------------------------------------------------------------------

    async def execute(self, action: str, **kwargs: Any) -> str:
        try:
            await self._ensure_browser()
            
            # ---- Navigation ----
            if action == "goto":
                url = kwargs.get("url")
                if not url:
                    return "Error: 'url' parameter is required for 'goto' action."
                await self._human_delay(100, 300)
                # Set a realistic referer on navigation (article technique #10)
                try:
                    await self.page.goto(url, wait_until="domcontentloaded", timeout=60000,
                                          referer=random.choice(["https://www.google.com/", "https://www.google.com/search?q=", ""]))
                except Exception:
                    await self.page.goto(url, wait_until="domcontentloaded", timeout=60000)
                try:
                    await self.page.wait_for_load_state("networkidle", timeout=8000)
                except Exception:
                    pass
                # Auto-dismiss cookie banners
                await self._dismiss_cookie_banners()
                # Auto-solve CAPTCHA if present
                captcha_msg = await self._auto_solve_captcha()
                title = await self.page.title()
                result = f"Navigated to {url} — Title: \"{title}\""
                if captcha_msg:
                    result += f"\n{captcha_msg}"
                return result
            
            # ---- Solve CAPTCHA (explicit) ----
            elif action == "solve_captcha":
                if not self._captcha_solver.available:
                    return (
                        "Error: No CAPTCHA solver configured. "
                        "Set one of: CAPSOLVER_API_KEY, TWOCAPTCHA_API_KEY, or ANTICAPTCHA_API_KEY "
                        "in your environment variables."
                    )
                captcha_info = await self._captcha_solver.detect_captcha(self.page)
                if not captcha_info:
                    return "No CAPTCHA detected on this page."
                
                token = await self._captcha_solver.solve(captcha_info)
                if not token:
                    return f"Failed to solve {captcha_info['type']} CAPTCHA. The solver returned no token."
                
                await self._captcha_solver.inject_token(self.page, captcha_info, token)
                await asyncio.sleep(2)
                try:
                    await self.page.wait_for_load_state("networkidle", timeout=5000)
                except Exception:
                    pass
                title = await self.page.title()
                return (
                    f"✅ Solved {captcha_info['type']} CAPTCHA via {self._captcha_solver.provider_name}.\n"
                    f"Token injected and form submitted. Current page: \"{title}\""
                )
            
            # ---- Click ----
            elif action == "click":
                selector = kwargs.get("selector")
                if not selector:
                    return "Error: 'selector' parameter is required for 'click' action."
                await self._human_delay()
                async def do_click():
                    await self.page.wait_for_selector(selector, state="visible", timeout=10000)
                    # Move mouse naturally to the element before clicking (article technique #4)
                    try:
                        box = await self.page.locator(selector).first.bounding_box()
                        if box:
                            target_x = box["x"] + box["width"] * random.uniform(0.3, 0.7)
                            target_y = box["y"] + box["height"] * random.uniform(0.3, 0.7)
                            await self._human_mouse_move(target_x, target_y)
                    except Exception:
                        pass
                    await self.page.click(selector)
                await self._retry_action(do_click)
                return f"Clicked on '{selector}'"
            
            # ---- Find and click by visible text ----
            elif action == "find_text":
                text = kwargs.get("text")
                if not text:
                    return "Error: 'text' parameter is required for 'find_text' action."
                await self._human_delay()
                locator = self.page.get_by_text(text, exact=False).first
                try:
                    await locator.wait_for(state="visible", timeout=10000)
                    await locator.click()
                    return f"Found and clicked text: '{text}'"
                except Exception:
                    try:
                        locator = self.page.get_by_role("link", name=text).first
                        await locator.click()
                        return f"Found and clicked link: '{text}'"
                    except Exception:
                        try:
                            locator = self.page.get_by_role("button", name=text).first
                            await locator.click()
                            return f"Found and clicked button: '{text}'"
                        except Exception:
                            return f"Error: Could not find visible element with text '{text}'"
            
            # ---- Type (fast fill) ----
            elif action == "type":
                selector = kwargs.get("selector")
                text = kwargs.get("text")
                if not selector or text is None:
                    return "Error: 'selector' and 'text' parameters are required for 'type' action."
                await self._human_delay()
                await self.page.wait_for_selector(selector, state="visible", timeout=10000)
                await self.page.fill(selector, text)
                return f"Typed text into '{selector}'"
            
            # ---- Type slowly (human-like, CAPTCHA resistant) ----
            elif action == "type_slowly":
                selector = kwargs.get("selector")
                text = kwargs.get("text")
                if not selector or text is None:
                    return "Error: 'selector' and 'text' parameters are required for 'type_slowly' action."
                await self._human_delay()
                await self.page.wait_for_selector(selector, state="visible", timeout=10000)
                await self.page.click(selector)
                await self.page.evaluate(f'document.querySelector("{selector}").value = ""')
                for char in text:
                    await self.page.keyboard.type(char)
                    await asyncio.sleep(random.uniform(0.05, 0.15))
                return f"Slowly typed text into '{selector}'"
            
            # ---- Hover ----
            elif action == "hover":
                selector = kwargs.get("selector")
                if not selector:
                    return "Error: 'selector' parameter is required for 'hover' action."
                await self._human_delay()
                await self.page.wait_for_selector(selector, state="visible", timeout=10000)
                await self.page.hover(selector)
                return f"Hovered over '{selector}'"
            
            # ---- Press key ----
            elif action == "press":
                key = kwargs.get("key")
                if not key:
                    return "Error: 'key' parameter is required for 'press' action."
                await self._human_delay(30, 80)
                await self.page.keyboard.press(key)
                return f"Pressed key '{key}'"
            
            # ---- Select option ----
            elif action == "select_option":
                selector = kwargs.get("selector")
                value = kwargs.get("value")
                if not selector or not value:
                    return "Error: 'selector' and 'value' are required for 'select_option' action."
                await self._human_delay()
                await self.page.wait_for_selector(selector, state="visible", timeout=10000)
                await self.page.select_option(selector, value)
                return f"Selected '{value}' in '{selector}'"
            
            # ---- Wait ----
            elif action == "wait":
                wait_for = kwargs.get("wait_for", "2000")
                if wait_for.startswith("text:"):
                    target = wait_for[5:]
                    await self.page.get_by_text(target).first.wait_for(state="visible", timeout=15000)
                    return f"Text '{target}' is now visible"
                elif wait_for.startswith("selector:"):
                    target = wait_for[9:]
                    await self.page.wait_for_selector(target, state="visible", timeout=15000)
                    return f"Selector '{target}' is now visible"
                elif wait_for.startswith("url:"):
                    target = wait_for[4:]
                    await self.page.wait_for_url(f"**{target}**", timeout=15000)
                    return f"URL now contains '{target}'"
                else:
                    ms = int(wait_for)
                    await self.page.wait_for_timeout(min(ms, 30000))
                    return f"Waited {ms}ms"
            
            # ---- Evaluate JS ----
            elif action == "evaluate":
                expression = kwargs.get("expression")
                if not expression:
                    return "Error: 'expression' parameter is required for 'evaluate' action."
                result = await self.page.evaluate(expression)
                result_str = json.dumps(result, default=str) if result is not None else "null"
                if len(result_str) > 5000:
                    result_str = result_str[:5000] + "...[TRUNCATED]"
                return f"Result: {result_str}"
            
            # ---- Screenshot ----
            elif action == "screenshot":
                full_page = kwargs.get("full_page", False)
                ts = int(time.time())
                path = self._screenshots_dir / f"screenshot_{ts}.png"
                await self.page.screenshot(path=path, full_page=full_page)
                return f"Screenshot saved to {path}"
            
            # ---- Extract readable text ----
            elif action == "extract":
                html = await self.page.content()
                text = self._extract_text(html)
                title = await self.page.title()
                url = self.page.url
                return f"Page: {title}\nURL: {url}\n\n{text}"
            
            # ---- Raw content ----
            elif action == "content":
                content = await self.page.content()
                if len(content) > 10000:
                    content = content[:10000] + "...[TRUNCATED - use 'extract' for readable text]"
                return content
            
            # ---- Current URL ----
            elif action == "url":
                return self.page.url
            
            # ---- Navigation ----
            elif action == "back":
                await self.page.go_back()
                title = await self.page.title()
                return f"Navigated back — Title: \"{title}\""
            
            elif action == "forward":
                await self.page.go_forward()
                title = await self.page.title()
                return f"Navigated forward — Title: \"{title}\""
            
            elif action == "reload":
                await self.page.reload()
                title = await self.page.title()
                return f"Reloaded — Title: \"{title}\""
            
            # ---- Scroll ----
            elif action == "scroll":
                direction = kwargs.get("direction", "down")
                amount = kwargs.get("amount", 500)
                if direction == "down":
                    await self.page.evaluate(f"window.scrollBy(0, {amount})")
                else:
                    await self.page.evaluate(f"window.scrollBy(0, -{amount})")
                return f"Scrolled {direction} by {amount}px"
            
            # ---- Fill form (multiple fields at once) ----
            elif action == "fill_form":
                fields = kwargs.get("fields", [])
                if not fields:
                    return "Error: 'fields' parameter is required for 'fill_form' action."
                filled = 0
                for field in fields:
                    sel = field.get("selector", "")
                    val = field.get("value", "")
                    if not sel:
                        continue
                    try:
                        await self._human_delay(30, 100)
                        await self.page.wait_for_selector(sel, state="visible", timeout=5000)
                        await self.page.fill(sel, val)
                        filled += 1
                    except Exception as e:
                        logger.warning(f"Failed to fill {sel}: {e}")
                return f"Filled {filled}/{len(fields)} form fields"
            
            return f"Error: Unknown action '{action}'"
            
        except Exception as e:
            current_url = self.page.url if self.page and not self.page.is_closed() else "unknown"
            logger.error(f"Browser error at {current_url}: {e}")
            return f"Error ({current_url}): {str(e)}"

    async def close(self):
        """Close the browser instance."""
        try:
            if self.page and not self.page.is_closed():
                await self.page.close()
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
        except Exception as e:
            logger.warning(f"Browser close error: {e}")
        finally:
            self.page = None
            self.context = None
            self.browser = None
            self.playwright = None
