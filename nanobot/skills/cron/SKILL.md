---
name: cron
description: Schedule reminders, timers, and recurring tasks.
---

# Cron

Use the `cron` tool to schedule reminders, one-shot timers, or recurring tasks.

## Three Scheduling Modes

1. **One-shot timer** (`in_seconds`) — fire once after a delay, then auto-delete
2. **Recurring** (`every_seconds`) — fire repeatedly at a fixed interval
3. **Cron expression** (`cron_expr`) — fire on a cron schedule (e.g. daily at 9am)

## Examples

**One-shot timer** (user says "do X in 2 minutes"):
```
cron(action="add", message="Search Bing for 'nanobot' and report results", in_seconds=120)
```

**Recurring task** (user says "check X every hour"):
```
cron(action="add", message="Check HKUDS/nanobot GitHub stars and report", every_seconds=3600)
```

**Reminder** (user says "remind me in 30 minutes"):
```
cron(action="add", message="Time to take a break!", in_seconds=1800)
```

**Scheduled** (user says "every day at 8am"):
```
cron(action="add", message="Good morning! Here's your daily briefing.", cron_expr="0 8 * * *")
```

**List/remove:**
```
cron(action="list")
cron(action="remove", job_id="abc123")
```

## IMPORTANT: Always Use The Tool

When the user asks you to do something after a delay ("in X minutes", "after X hours"), 
you MUST call the `cron` tool with `in_seconds`. Do NOT just say you will do it — 
you must actually schedule it via the tool so the system fires automatically.

## CRITICAL: Never Create Cron Jobs Without Explicit User Approval

You MUST NEVER create a cron job unless the user has EXPLICITLY asked you to schedule 
a recurring task. Do NOT proactively suggest or create cron jobs on your own initiative.
If you think a cron job would be useful, you may suggest it, but WAIT for the user to 
explicitly confirm before calling the cron tool. Creating unauthorized cron jobs wastes 
API credits and is strictly prohibited.

## Time Conversion Reference

| User says | Parameter |
|-----------|-----------|
| in 2 minutes | in_seconds: 120 |
| in 1 hour | in_seconds: 3600 |
| every 20 minutes | every_seconds: 1200 |
| every hour | every_seconds: 3600 |
| every day at 8am | cron_expr: "0 8 * * *" |
| weekdays at 5pm | cron_expr: "0 17 * * 1-5" |
