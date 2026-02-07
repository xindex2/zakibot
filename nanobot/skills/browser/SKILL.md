---
name: browser
description: Stealth browser with CAPTCHA solving, human-like interaction, and smart element finding.
metadata:
  version: 2.1.0
---

# Browser Skill

Stealth Chromium browser that evades bot detection and auto-solves CAPTCHAs.

## CAPTCHA Solving 🔐

The browser can automatically detect and solve CAPTCHAs using a paid solving service.

### Supported CAPTCHA types
- ✅ reCAPTCHA v2 ("I'm not a robot" checkbox)
- ✅ reCAPTCHA v3 (invisible score-based)
- ✅ hCaptcha
- ✅ Cloudflare Turnstile

### Setup
Add to your bot's `config.yaml`:
```yaml
tools:
  browser:
    captcha_provider: capsolver    # or: 2captcha, anticaptcha
    captcha_api_key: your_key_here
```

| Provider | Speed | Cost |
|----------|-------|------|
| `capsolver` | Fastest (AI) | ~$1.50/1000 |
| `2captcha` | Medium (humans) | ~$2.99/1000 |
| `anticaptcha` | Medium (humans) | ~$2.00/1000 |

### Usage
CAPTCHAs are **auto-solved on navigation** (goto). If a CAPTCHA appears later:
```
browser(action="solve_captcha")
```

### Example: Pass a CAPTCHA-protected page
```
1. browser(action="goto", url="https://protected-site.com")
   → Navigated to ... ✅ Solved recaptcha_v2 CAPTCHA via CapSolver
2. browser(action="extract")
   → (page content, now accessible)
```

## Actions Reference

### Navigation
```
browser(action="goto", url="https://example.com")  # auto-solves CAPTCHAs
browser(action="back")
browser(action="forward")
browser(action="reload")
```

### Clicking & Hovering
```
browser(action="click", selector="button.submit")
browser(action="find_text", text="Sign In")        # no selector needed
browser(action="hover", selector=".dropdown-trigger")
```

### Typing
```
browser(action="type", selector="input[name='q']", text="search query")
browser(action="type_slowly", selector="#password", text="s3cret")  # human-like
browser(action="press", key="Enter")
```

### Waiting
```
browser(action="wait", wait_for="text:Results found")
browser(action="wait", wait_for="selector:.loaded")
browser(action="wait", wait_for="url:dashboard")
browser(action="wait", wait_for="3000")              # 3 seconds
```

### Data Extraction
```
browser(action="extract")      # clean text
browser(action="content")      # raw HTML
browser(action="url")          # current URL
browser(action="screenshot")   # save screenshot
browser(action="evaluate", expression="document.title")
```

### Forms & CAPTCHAs
```
browser(action="select_option", selector="select#country", value="US")
browser(action="fill_form", fields=[{"selector": "#name", "value": "John"}])
browser(action="solve_captcha")  # detect + solve + submit
```

## Strategy Tips

1. **`find_text` > CSS selectors** — more reliable, doesn't break with layout changes
2. **`type_slowly` for logins** — keystroke analysis flags instant fills
3. **`wait` before `extract`** — dynamic pages need loading time
4. **`extract` > `content`** — raw HTML wastes context
5. **`solve_captcha` if blocked** — auto-detects the CAPTCHA type and solves it
