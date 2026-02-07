#!/bin/bash
echo "--- SYSTEM VERIFICATION ---"
echo "Current Directory: $(pwd)"
echo "Project Name in package.json: $(grep '"name":' platform/package.json | cut -d'"' -f4)"
echo "Playwright Stealth Version: $(./venv/bin/pip show playwright-stealth | grep Version)"

echo ""
echo "--- CODE INTEGRITY ---"
if grep -q "extreme robustness" nanobot/agent/tools/browser.py; then
    echo "✅ browser.py: Latest (v2 robustness applied)"
else
    echo "❌ browser.py: OUTDATED"
fi

if grep -q "Silently handle pkill" platform/src/lib/bot-executor.ts; then
    echo "✅ bot-executor.ts: Latest (Silent cleanup applied)"
else
    echo "❌ bot-executor.ts: OUTDATED"
fi

echo ""
echo "--- RESTART INSTRUCTIONS ---"
echo "If any files are OUTDATED, run:"
echo "git pull origin main"
echo "pm2 restart all"
