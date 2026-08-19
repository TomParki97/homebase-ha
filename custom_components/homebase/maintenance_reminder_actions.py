"""Configurable Maintenance reminder actions for HomeBase."""

from copy import deepcopy
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Context, HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.script import (
    Script,
    async_validate_actions_config,
)

from .const import (
    CONF_MAINTENANCE_DUE_REMINDERS_ENABLED,
    CONF_MAINTENANCE_OVERDUE_REMINDERS_ENABLED,
    CONF_MAINTENANCE_REMINDER_ACTION,
    DEFAULT_MAINTENANCE_DUE_REMINDERS_ENABLED,
    DEFAULT_MAINTENANCE_OVERDUE_REMINDERS_ENABLED,
    DOMAIN,
    SIGNAL_MAINTENANCE_REMINDER,
)

_LOGGER = logging.getLogger(__name__)


def _reminder_enabled(
    entry: ConfigEntry,
    event_type: str,
) -> bool:
    """Return whether this Maintenance reminder action is enabled."""
    if event_type == "due":
        return entry.options.get(
            CONF_MAINTENANCE_DUE_REMINDERS_ENABLED,
            DEFAULT_MAINTENANCE_DUE_REMINDERS_ENABLED,
        )

    if event_type == "overdue":
        return entry.options.get(
            CONF_MAINTENANCE_OVERDUE_REMINDERS_ENABLED,
            DEFAULT_MAINTENANCE_OVERDUE_REMINDERS_ENABLED,
        )

    return False


def _reminder_variables(
    event_type: str,
    attributes: dict[str, Any],
) -> dict[str, Any]:
    """Build variables available to Maintenance reminder actions."""
    return {
        "homebase_reminder_type": event_type,
        "homebase_maintenance_id": attributes.get(
            "maintenance_id"
        ),
        "homebase_maintenance_name": attributes.get("name"),
        "homebase_description": attributes.get("description"),
        "homebase_area": attributes.get("area"),
        "homebase_asset": attributes.get("asset"),
        "homebase_assignee": attributes.get("assignee"),
        "homebase_status": attributes.get("status"),
        "homebase_schedule_type": attributes.get(
            "schedule_type"
        ),
        "homebase_due_at": attributes.get("due_at"),
        "homebase_interval_days": attributes.get(
            "interval_days"
        ),
    }


async def async_run_maintenance_reminder_action(
    hass: HomeAssistant,
    entry: ConfigEntry,
    event_type: str,
    attributes: dict[str, Any],
) -> None:
    """Run the configured Maintenance reminder action."""
    if not _reminder_enabled(entry, event_type):
        return

    sequence = entry.options.get(
        CONF_MAINTENANCE_REMINDER_ACTION
    )

    if not sequence:
        return

    try:
        script_sequence = cv.SCRIPT_SCHEMA(
            deepcopy(sequence)
        )

        validated_sequence = await async_validate_actions_config(
            hass,
            script_sequence,
        )

        action_script = Script(
            hass,
            validated_sequence,
            "HomeBase maintenance reminder",
            DOMAIN,
            running_description=(
                "HomeBase maintenance reminder action"
            ),
        )

        await action_script.async_run(
            _reminder_variables(
                event_type,
                attributes,
            ),
            context=Context(),
        )

    except Exception:
        _LOGGER.exception(
            "Error running HomeBase %s Maintenance reminder "
            "action for %s",
            event_type,
            attributes.get(
                "name",
                "unknown maintenance item",
            ),
        )


@callback
def async_setup_maintenance_reminder_actions(
    hass: HomeAssistant,
    entry: ConfigEntry,
):
    """Subscribe to HomeBase Maintenance reminder signals."""

    @callback
    def handle_reminder(
        event_type: str,
        attributes: dict[str, Any],
    ) -> None:
        """Schedule the configured Maintenance action."""
        hass.async_create_task(
            async_run_maintenance_reminder_action(
                hass,
                entry,
                event_type,
                attributes,
            )
        )

    return async_dispatcher_connect(
        hass,
        SIGNAL_MAINTENANCE_REMINDER,
        handle_reminder,
    )
