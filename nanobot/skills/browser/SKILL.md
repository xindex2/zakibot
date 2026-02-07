---
name: browser
description: Browser automation skill for navigating, interacting, and extracting data from websites.
metadata:
  version: 1.0.0
---

# Browser Skill

Use the `browser` tool to control a web browser. This is essential for:
- Interacting with dynamic web applications (SPAs).
- Performing complex tasks like logging in or searching within a specific site.
- Taking screenshots of web pages.
- Navigating back and forth in history.

## Example Usage

### Navigate and search
1. Call `browser(action="goto", url="https://www.google.com")`
2. Call `browser(action="type", selector="input[name='q']", text="OpenClaw")`
3. Call `browser(action="press", key="Enter")`

### Take a screenshot
Call `browser(action="screenshot", full_page=true)`

### Scroll and read
1. Call `browser(action="scroll", direction="down", amount=1000)`
2. Call `browser(action="content")` to read the current page content.
