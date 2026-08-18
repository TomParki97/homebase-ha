"""WebSocket API for HomeBase."""

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .models import ScheduleType, datetime_from_storage
from .storage import HomeBaseStorage


def _get_storage(hass: HomeAssistant) -> HomeBaseStorage | None:
    """Return the active HomeBase storage instance."""
    entries = hass.config_entries.async_entries(DOMAIN)

    if not entries:
        return None

    return entries[0].runtime_data


@websocket_api.websocket_command(
    {
        vol.Required("type"): "homebase/chores/list",
    }
)
@callback
def websocket_list_chores(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Return all HomeBase chores."""
    storage = _get_storage(hass)

    if storage is None:
        connection.send_error(
            msg["id"],
            "homebase_not_configured",
            "HomeBase is not configured",
        )
        return

    now = dt_util.now()
    chores = []

    for chore in storage.chores:
        data = chore.to_dict()
        data["status"] = chore.status_at(now).value
        chores.append(data)

    connection.send_result(
        msg["id"],
        {
            "chores": chores,
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "homebase/chores/set_paused",
        vol.Required("chore_id"): str,
        vol.Required("paused"): bool,
    }
)
@websocket_api.async_response
async def websocket_set_chore_paused(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Pause or resume a HomeBase chore."""
    storage = _get_storage(hass)

    if storage is None:
        connection.send_error(
            msg["id"],
            "homebase_not_configured",
            "HomeBase is not configured",
        )
        return

    chore = storage.get_chore(msg["chore_id"])

    if chore is None:
        connection.send_error(
            msg["id"],
            "chore_not_found",
            "HomeBase chore was not found",
        )
        return

    chore.paused = msg["paused"]
    await storage.async_save()

    data = chore.to_dict()
    data["status"] = chore.status_at(dt_util.now()).value

    connection.send_result(
        msg["id"],
        {
            "chore": data,
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "homebase/chores/update",
        vol.Required("chore_id"): str,
        vol.Optional("name"): str,
        vol.Optional("description"): str,
        vol.Optional("area"): vol.Any(str, None),
        vol.Optional("assignee"): vol.Any(str, None),
        vol.Optional("schedule_type"): vol.In(
            ["one_time", "fixed", "relative"]
        ),
        vol.Optional("due_at"): vol.Any(str, None),
        vol.Optional("interval_days"): vol.Any(
            vol.Coerce(int),
            None,
        ),
    }
)
@websocket_api.async_response
async def websocket_update_chore(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Update a HomeBase chore."""
    storage = _get_storage(hass)

    if storage is None:
        connection.send_error(
            msg["id"],
            "homebase_not_configured",
            "HomeBase is not configured",
        )
        return

    chore = storage.get_chore(msg["chore_id"])

    if chore is None:
        connection.send_error(
            msg["id"],
            "chore_not_found",
            "HomeBase chore was not found",
        )
        return

    name = msg.get("name", chore.name).strip()

    if not name:
        connection.send_error(
            msg["id"],
            "invalid_name",
            "Chore name cannot be empty",
        )
        return

    description = msg.get(
        "description",
        chore.description,
    ).strip()

    area = msg.get("area", chore.area)
    if isinstance(area, str):
        area = area.strip() or None

    assignee = msg.get("assignee", chore.assignee)
    if isinstance(assignee, str):
        assignee = assignee.strip() or None

    schedule_type = ScheduleType(
        msg.get(
            "schedule_type",
            chore.schedule_type.value,
        )
    )

    interval_days = msg.get(
        "interval_days",
        chore.interval_days,
    )

    if (
        interval_days is not None
        and interval_days < 1
    ):
        connection.send_error(
            msg["id"],
            "invalid_interval",
            "Repeat interval must be at least 1 day",
        )
        return

    if (
        schedule_type
        in {
            ScheduleType.FIXED,
            ScheduleType.RELATIVE,
        }
        and interval_days is None
    ):
        connection.send_error(
            msg["id"],
            "missing_interval",
            "Recurring chores require a repeat interval",
        )
        return

    if schedule_type == ScheduleType.ONE_TIME:
        interval_days = None

    due_at = chore.due_at

    if "due_at" in msg:
        try:
            due_at = datetime_from_storage(
                msg["due_at"]
            )
        except (TypeError, ValueError):
            connection.send_error(
                msg["id"],
                "invalid_due_at",
                "Due date is invalid",
            )
            return

    chore.name = name
    chore.description = description
    chore.area = area
    chore.assignee = assignee
    chore.schedule_type = schedule_type
    chore.due_at = due_at
    chore.interval_days = interval_days

    await storage.async_save()

    data = chore.to_dict()
    data["status"] = chore.status_at(
        dt_util.now()
    ).value

    connection.send_result(
        msg["id"],
        {
            "chore": data,
        },
    )


def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Register the HomeBase WebSocket API."""
    websocket_api.async_register_command(
        hass,
        websocket_list_chores,
    )
    websocket_api.async_register_command(
        hass,
        websocket_set_chore_paused,
    )
    websocket_api.async_register_command(
        hass,
        websocket_update_chore,
    )
