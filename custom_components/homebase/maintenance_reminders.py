"""Maintenance reminder scheduling for HomeBase."""

from datetime import datetime
from typing import Any


from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.util import dt as dt_util

from .const import SIGNAL_MAINTENANCE_REMINDER
from .maintenance_models import (
    MaintenanceItem,
    MaintenanceStatus,
)
from .storage import HomeBaseStorage



def _event_attributes(
    item: MaintenanceItem,
    status: MaintenanceStatus,
) -> dict[str, Any]:
    """Build event attributes for a maintenance reminder."""
    return {
        "maintenance_id": item.maintenance_id,
        "name": item.name,
        "description": item.description,
        "area": item.area,
        "asset": item.asset,
        "assignee": item.assignee,
        "status": status.value,
        "schedule_type": item.schedule_type.value,
        "due_at": (
            item.due_at.isoformat()
            if item.due_at
            else None
        ),
        "interval_days": item.interval_days,
    }


async def async_check_maintenance_reminders(
    hass: HomeAssistant,
    storage: HomeBaseStorage,
    now: datetime | None = None,
) -> None:
    """Check maintenance and emit newly due reminders."""
    now = now or dt_util.now()

    pending_events: list[
        tuple[str, dict[str, Any]]
    ] = []

    changed = False

    for item in storage.maintenance.items:
        if (
            item.paused
            or item.completed
            or item.due_at is None
        ):
            continue

        status = item.status_at(now)
        occurrence = item.due_at

        if (
            status == MaintenanceStatus.DUE_TODAY
            and item.due_reminder_sent_for != occurrence
        ):
            item.due_reminder_sent_for = occurrence
            changed = True

            pending_events.append(
                (
                    "due",
                    _event_attributes(
                        item,
                        MaintenanceStatus.DUE_TODAY,
                    ),
                )
            )

        elif (
            status == MaintenanceStatus.OVERDUE
            and item.overdue_reminder_sent_for != occurrence
        ):
            item.overdue_reminder_sent_for = occurrence
            changed = True

            pending_events.append(
                (
                    "overdue",
                    _event_attributes(
                        item,
                        MaintenanceStatus.OVERDUE,
                    ),
                )
            )

    if changed:
        # Persist markers before emitting events so a restart
        # cannot cause duplicate maintenance reminders.
        await storage.maintenance.async_save()

    for event_type, attributes in pending_events:
        async_dispatcher_send(
            hass,
            SIGNAL_MAINTENANCE_REMINDER,
            event_type,
            attributes,
        )
