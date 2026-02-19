"""Cron tool for scheduling reminders and tasks."""

import time
from typing import Any

from nanobot.agent.tools.base import Tool
from nanobot.cron.service import CronService
from nanobot.cron.types import CronSchedule


class CronTool(Tool):
    """Tool to schedule reminders and recurring tasks."""
    
    def __init__(self, cron_service: CronService):
        self._cron = cron_service
        self._channel = ""
        self._chat_id = ""
    
    def set_context(self, channel: str, chat_id: str) -> None:
        """Set the current session context for delivery."""
        self._channel = channel
        self._chat_id = chat_id
    
    @property
    def name(self) -> str:
        return "cron"
    
    @property
    def description(self) -> str:
        return (
            "Schedule tasks, reminders, and timers. "
            "Use 'in_seconds' for one-shot delayed tasks (e.g. 'do X in 2 minutes' → in_seconds=120). "
            "Use 'every_seconds' for recurring tasks (e.g. 'check X every hour' → every_seconds=3600). "
            "Use 'cron_expr' for scheduled recurring tasks (e.g. 'every day at 9am' → cron_expr='0 9 * * *'). "
            "Actions: add, list, remove."
        )
    
    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["add", "list", "remove"],
                    "description": "Action to perform"
                },
                "message": {
                    "type": "string",
                    "description": "The task/reminder message. For tasks, describe what the agent should do when the timer fires. For reminders, this is the message to deliver."
                },
                "in_seconds": {
                    "type": "integer",
                    "description": "Fire ONCE after this many seconds (one-shot timer). Use for 'do X in N minutes/hours'. The job auto-deletes after execution."
                },
                "every_seconds": {
                    "type": "integer",
                    "description": "Fire repeatedly every N seconds (recurring). Use for 'check X every N minutes'."
                },
                "cron_expr": {
                    "type": "string",
                    "description": "Cron expression like '0 9 * * *' (for scheduled recurring tasks at specific times)"
                },
                "job_id": {
                    "type": "string",
                    "description": "Job ID (for remove action)"
                }
            },
            "required": ["action"]
        }
    
    async def execute(
        self,
        action: str,
        message: str = "",
        in_seconds: int | None = None,
        every_seconds: int | None = None,
        cron_expr: str | None = None,
        job_id: str | None = None,
        **kwargs: Any
    ) -> str:
        if action == "add":
            return self._add_job(message, in_seconds, every_seconds, cron_expr)
        elif action == "list":
            return self._list_jobs()
        elif action == "remove":
            return self._remove_job(job_id)
        return f"Unknown action: {action}"
    
    def _add_job(
        self,
        message: str,
        in_seconds: int | None,
        every_seconds: int | None,
        cron_expr: str | None,
    ) -> str:
        if not message:
            return "Error: message is required for add"
        if not self._channel or not self._chat_id:
            return "Error: no session context (channel/chat_id)"
        
        # Enforce max job limit per bot
        MAX_CRON_JOBS = 10
        existing_jobs = self._cron.list_jobs(include_disabled=True)
        if len(existing_jobs) >= MAX_CRON_JOBS:
            return f"Error: maximum of {MAX_CRON_JOBS} scheduled jobs reached. Remove old jobs before adding new ones."
        
        # Build schedule
        delete_after = False
        if in_seconds:
            # One-shot timer: fire once after N seconds, then auto-delete
            at_ms = int(time.time() * 1000) + (in_seconds * 1000)
            schedule = CronSchedule(kind="at", at_ms=at_ms)
            delete_after = True
        elif every_seconds:
            schedule = CronSchedule(kind="every", every_ms=every_seconds * 1000)
        elif cron_expr:
            schedule = CronSchedule(kind="cron", expr=cron_expr)
        else:
            return "Error: one of in_seconds, every_seconds, or cron_expr is required"
        
        job = self._cron.add_job(
            name=message[:40],
            schedule=schedule,
            message=message,
            deliver=True,
            channel=self._channel,
            to=self._chat_id,
            delete_after_run=delete_after,
        )
        
        if in_seconds:
            mins = in_seconds // 60
            secs = in_seconds % 60
            time_str = f"{mins}m {secs}s" if mins else f"{secs}s"
            return f"✅ Timer set! Job '{job.name}' (id: {job.id}) will fire in {time_str}. I will execute the task and send you the result automatically."
        elif every_seconds:
            return f"✅ Recurring job '{job.name}' (id: {job.id}) - runs every {every_seconds}s"
        else:
            return f"✅ Scheduled job '{job.name}' (id: {job.id}) - cron: {cron_expr}"
    
    def _list_jobs(self) -> str:
        jobs = self._cron.list_jobs()
        if not jobs:
            return "No scheduled jobs."
        
        import time as t
        lines = []
        now_ms = int(t.time() * 1000)
        for j in jobs:
            sched_info = ""
            if j.schedule.kind == "at":
                if j.state.next_run_at_ms:
                    remaining_s = max(0, (j.state.next_run_at_ms - now_ms) // 1000)
                    sched_info = f"fires in {remaining_s}s (one-shot)"
                else:
                    sched_info = "one-shot (done)"
            elif j.schedule.kind == "every":
                sched_info = f"every {(j.schedule.every_ms or 0) // 1000}s"
            elif j.schedule.kind == "cron":
                sched_info = f"cron: {j.schedule.expr}"
            
            status = "✅" if j.enabled else "⏸️"
            lines.append(f"- {status} {j.name} (id: {j.id}, {sched_info})")
        
        return "Scheduled jobs:\n" + "\n".join(lines)
    
    def _remove_job(self, job_id: str | None) -> str:
        if not job_id:
            return "Error: job_id is required for remove"
        if self._cron.remove_job(job_id):
            return f"Removed job {job_id}"
        return f"Job {job_id} not found"
