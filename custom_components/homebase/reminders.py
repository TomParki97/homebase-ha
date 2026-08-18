"""Chore reminder scheduling for HomeBase."""

from datetime import datetime, timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.util import dt as dt_util

from .const import SIGNAL_CHORE_REMINDER
from .models import Chore, ChoreStatus
from .storage import HomeBaseStorage

REMINDER_CHECK_INTERVAL = timedelta(minutes=5)


def _event_attributes(
    chore: Chore,
    status: ChoreStatus,
) -> dict[str, Any]:
    """Build event attributes for a chore reminder."""
    return {
        "chore_id": chore.chore_id,
        "name": chore.name,
        "description": chore.description,
        "area": chore.area,
        "assignee": chore.assignee,
        "status": status.value,
        "schedule_type": chore.schedule_type.value,
        "due_at": (
            chore.due_at.isoformat()
            if chore.due_at
            else None
        ),
        "interval_days": chore.interval_days,
    }


async def async_check_chore_reminders(
    hass: HomeAssistant,
    storage: HomeBaseStorage,
    now: datetime | None = None,
) -> None:
    """Check chores and emit any newly due reminders."""
    now = now or dt_util.now()

    pending_events: list[
        tuple[str, dict[str, Any]]
    ] = []

    changed = False

    for chore in storage.chores:
        if (
            chore.paused
            or chore.completed
            or chore.due_at is None
        ):
            continue

        status = chore.status_at(now)
        occurrence = chore.due_at

        if (
            status == ChoreStatus.DUE_TODAY
            and chore.due_reminder_sent_for
            != occurrence
        ):
            chore.due_reminder_sent_for = occurrence
            changed = True

            pending_events.append(
                (
                    "due",
                    _event_attributes(
                        chore,
                        ChoreStatus.DUE_TODAY,
                    ),
                )
            )

        elif (
            status == ChoreStatus.OVERDUE
            and chore.overdue_reminder_sent_for
            != occurrence
        ):
            chore.overdue_reminder_sent_for = occurrence
            changed = True

            pending_events.append(
                (
                    "overdue",
                    _event_attributes(
                        chore,
                        ChoreStatus.OVERDUE,
                    ),
                )
            )

    if changed:
        # Persist reminder markers before emitting events so
        # a restart cannot cause duplicate reminders.
        await storage.async_save()

    for event_type, attributes in pending_events:
        async_dispatcher_send(
            hass,
            SIGNAL_CHORE_REMINDER,
            event_type,
            attributes,
        )
