"""WebSocket API for HomeBase Maintenance."""

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .maintenance_models import (
    MaintenanceScheduleType,
    datetime_from_storage,
)
from .storage import HomeBaseStorage


def _get_storage(
    hass: HomeAssistant,
) -> HomeBaseStorage | None:
    """Return the active HomeBase storage instance."""
    entries = hass.config_entries.async_entries(
        DOMAIN
    )

    if not entries:
        return None

    return entries[0].runtime_data


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "homebase/maintenance/list",
    }
)
@callback
def websocket_list_maintenance(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Return all HomeBase maintenance items."""
    storage = _get_storage(hass)

    if storage is None:
        connection.send_error(
            msg["id"],
            "homebase_not_configured",
            "HomeBase is not configured",
        )
        return

    now = dt_util.now()
    items = []

    for item in storage.maintenance.items:
        data = item.to_dict()
        data["status"] = item.status_at(
            now
        ).value
        items.append(data)

    connection.send_result(
        msg["id"],
        {
            "maintenance": items,
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "homebase/maintenance/set_paused",
        vol.Required("maintenance_id"): str,
        vol.Required("paused"): bool,
    }
)
@websocket_api.async_response
async def websocket_set_maintenance_paused(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Pause or resume a maintenance item."""
    storage = _get_storage(hass)

    if storage is None:
        connection.send_error(
            msg["id"],
            "homebase_not_configured",
            "HomeBase is not configured",
        )
        return

    item = storage.maintenance.get_item(
        msg["maintenance_id"]
    )

    if item is None:
        connection.send_error(
            msg["id"],
            "maintenance_not_found",
            "HomeBase maintenance item "
            "was not found",
        )
        return

    item.paused = msg["paused"]

    await storage.maintenance.async_save()

    data = item.to_dict()
    data["status"] = item.status_at(
        dt_util.now()
    ).value

    connection.send_result(
        msg["id"],
        {
            "maintenance": data,
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "homebase/maintenance/update",
        vol.Required("maintenance_id"): str,
        vol.Optional("name"): str,
        vol.Optional("description"): str,
        vol.Optional("area"): vol.Any(
            str,
            None,
        ),
        vol.Optional("asset"): vol.Any(
            str,
            None,
        ),
        vol.Optional("assignee"): vol.Any(
            str,
            None,
        ),
        vol.Optional("schedule_type"): vol.In(
            [
                "one_time",
                "fixed",
                "relative",
            ]
        ),
        vol.Optional("due_at"): vol.Any(
            str,
            None,
        ),
        vol.Optional("interval_days"): vol.Any(
            vol.Coerce(int),
            None,
        ),
    }
)
@websocket_api.async_response
async def websocket_update_maintenance(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Update a HomeBase maintenance item."""
    storage = _get_storage(hass)

    if storage is None:
        connection.send_error(
            msg["id"],
            "homebase_not_configured",
            "HomeBase is not configured",
        )
        return

    item = storage.maintenance.get_item(
        msg["maintenance_id"]
    )

    if item is None:
        connection.send_error(
            msg["id"],
            "maintenance_not_found",
            "HomeBase maintenance item "
            "was not found",
        )
        return

    name = msg.get(
        "name",
        item.name,
    ).strip()

    if not name:
        connection.send_error(
            msg["id"],
            "invalid_name",
            "Maintenance name cannot be empty",
        )
        return

    description = msg.get(
        "description",
        item.description,
    ).strip()

    area = msg.get(
        "area",
        item.area,
    )

    if isinstance(area, str):
        area = area.strip() or None

    asset = msg.get(
        "asset",
        item.asset,
    )

    if isinstance(asset, str):
        asset = asset.strip() or None

    assignee = msg.get(
        "assignee",
        item.assignee,
    )

    if isinstance(assignee, str):
        assignee = assignee.strip() or None

    schedule_type = MaintenanceScheduleType(
        msg.get(
            "schedule_type",
            item.schedule_type.value,
        )
    )

    interval_days = msg.get(
        "interval_days",
        item.interval_days,
    )

    if (
        interval_days is not None
        and interval_days < 1
    ):
        connection.send_error(
            msg["id"],
            "invalid_interval",
            "Repeat interval must be "
            "at least 1 day",
        )
        return

    if (
        schedule_type
        in {
            MaintenanceScheduleType.FIXED,
            MaintenanceScheduleType.RELATIVE,
        }
        and interval_days is None
    ):
        connection.send_error(
            msg["id"],
            "missing_interval",
            "Recurring maintenance requires "
            "a repeat interval",
        )
        return

    if (
        schedule_type
        == MaintenanceScheduleType.ONE_TIME
    ):
        interval_days = None

    due_at = item.due_at

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

    item.name = name
    item.description = description
    item.area = area
    item.asset = asset
    item.assignee = assignee
    item.schedule_type = schedule_type
    item.due_at = due_at
    item.interval_days = interval_days

    await storage.maintenance.async_save()

    data = item.to_dict()
    data["status"] = item.status_at(
        dt_util.now()
    ).value

    connection.send_result(
        msg["id"],
        {
            "maintenance": data,
        },
    )


def async_register_maintenance_websocket_api(
    hass: HomeAssistant,
) -> None:
    """Register the Maintenance WebSocket API."""
    websocket_api.async_register_command(
        hass,
        websocket_list_maintenance,
    )

    websocket_api.async_register_command(
        hass,
        websocket_set_maintenance_paused,
    )

    websocket_api.async_register_command(
        hass,
        websocket_update_maintenance,
    )
