"""WebSocket API for HomeBase."""

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.util import dt as dt_util

from .const import DOMAIN
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
