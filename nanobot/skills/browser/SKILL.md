---
name: browser
description: Stealth browser automation with CAPTCHA resistance, human-like interaction, and smart element finding.
metadata:
  version: 2.0.0
---

# Browser Skill

Use the `browser` tool for web automation. It runs a stealth Chromium instance that evades most bot detection.

## Key Capabilities

- **Stealth mode**: Masks `navigator.webdriver`, fakes plugins, spoofs WebGL — passes most anti-bot checks
- **Human-like typing**: `type_slowly` mimics human keystroke timing for CAPTCHA-sensitive forms
- **Find by text**: `find_text` clicks elements by visible text — no CSS selectors needed
- **Cookie banner auto-dismissal**: Automatically handles consent popups on navigation
- **JS evaluation**: Run arbitrary JavaScript and get results back
- **Clean text extraction**: `extract` returns readable text, not raw HTML

## Actions Reference

### Navigation
```
browser(action="goto", url="https://example.com")
browser(action="back")
browser(action="forward")
browser(action="reload")
```

### Clicking & Hovering
```
browser(action="click", selector="button.submit")
browser(action="find_text", text="Sign In")        # ← no selector needed!
browser(action="hover", selector=".dropdown-trigger")
```

### Typing
```
browser(action="type", selector="input[name='q']", text="search query")
browser(action="type_slowly", selector="#password", text="s3cret")  # ← human-like
browser(action="press", key="Enter")
```

### Waiting
```
browser(action="wait", wait_for="text:Results found")
browser(action="wait", wait_for="selector:.loaded")
browser(action="wait", wait_for="url:dashboard")
browser(action="wait", wait_for="3000")             # ← wait 3 seconds
```

### Data Extraction  
```
browser(action="extract")      # clean readable text
browser(action="content")      # raw HTML
browser(action="url")          # current page URL
browser(action="screenshot")   # save screenshot
browser(action="evaluate", expression="document.title")
```

### Forms
```
browser(action="select_option", selector="select#country", value="US")
browser(action="fill_form", fields=[
  {"selector": "#name", "value": "John"},
  {"selector": "#email", "value": "john@example.com"}
])
```

## Strategy Tips

1. **Prefer `find_text` over CSS selectors** — it's more reliable and doesn't break when page structure changes
2. **Use `type_slowly` for login forms** — sites with keystroke analysis will flag instant fills
3. **Use `wait` before extracting** — dynamic pages need time to load content
4. **Use `extract` not `content`** — raw HTML wastes context, `extract` gives clean text
5. **Use `evaluate` for specific data** — when you need structured data from a page, run JS

## Example: Search Google and Extract Results

```
1. browser(action="goto", url="https://www.google.com")
2. browser(action="type_slowly", selector="textarea[name='q']", text="OpenClaw AI agent")
3. browser(action="press", key="Enter")
4. browser(action="wait", wait_for="selector:#search")
5. browser(action="extract")
```
