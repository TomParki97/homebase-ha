"""Configurable reminder actions for HomeBase."""

from copy import deepcopy
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.script import (
    Script,
    async_validate_actions_config,
)

from .const import (
    CONF_DUE_REMINDERS_ENABLED,
    CONF_OVERDUE_REMINDERS_ENABLED,
    CONF_REMINDER_ACTION,
    DEFAULT_DUE_REMINDERS_ENABLED,
    DEFAULT_OVERDUE_REMINDERS_ENABLED,
    DOMAIN,
    SIGNAL_CHORE_REMINDER,
)

_LOGGER = logging.getLogger(__name__)


def _reminder_enabled(
    entry: ConfigEntry,
    event_type: str,
) -> bool:
    """Return whether an action should run for this reminder type."""
    if event_type == "due":
        return entry.options.get(
            CONF_DUE_REMINDERS_ENABLED,
            DEFAULT_DUE_REMINDERS_ENABLED,
        )

    if event_type == "overdue":
        return entry.options.get(
            CONF_OVERDUE_REMINDERS_ENABLED,
            DEFAULT_OVERDUE_REMINDERS_ENABLED,
        )

    return False


def _reminder_variables(
    event_type: str,
    attributes: dict[str, Any],
) -> dict[str, Any]:
    """Build variables available to configured reminder actions."""
    return {
        "homebase_reminder_type": event_type,
        "homebase_chore_id": attributes.get("chore_id"),
        "homebase_chore_name": attributes.get("name"),
        "homebase_description": attributes.get("description"),
        "homebase_area": attributes.get("area"),
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


async def async_run_reminder_action(
    hass: HomeAssistant,
    entry: ConfigEntry,
    event_type: str,
    attributes: dict[str, Any],
) -> None:
    """Run the user-configured action for a chore reminder."""
    if not _reminder_enabled(entry, event_type):
        return

    sequence = entry.options.get(CONF_REMINDER_ACTION)

    if not sequence:
        return

    try:
        validated_sequence = await async_validate_actions_config(
            hass,
            deepcopy(sequence),
        )

        action_script = Script(
            hass,
            validated_sequence,
            "HomeBase chore reminder",
            DOMAIN,
            running_description=(
                "HomeBase chore reminder action"
            ),
        )

        await action_script.async_run(
            _reminder_variables(
                event_type,
                attributes,
            )
        )

    except Exception:
        _LOGGER.exception(
            "Error running HomeBase %s reminder action for %s",
            event_type,
            attributes.get("name", "unknown chore"),
        )


@callback
def async_setup_reminder_actions(
    hass: HomeAssistant,
    entry: ConfigEntry,
):
    """Subscribe to HomeBase chore reminder signals."""

    @callback
    def handle_reminder(
        event_type: str,
        attributes: dict[str, Any],
    ) -> None:
        """Schedule the configured reminder action."""
        hass.async_create_task(
            async_run_reminder_action(
                hass,
                entry,
                event_type,
                attributes,
            )
        )

    return async_dispatcher_connect(
        hass,
        SIGNAL_CHORE_REMINDER,
        handle_reminder,
    )
