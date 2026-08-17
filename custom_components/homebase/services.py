"""Service actions for HomeBase."""

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN
from .models import Chore
from .storage import HomeBaseStorage

SERVICE_ADD_CHORE = "add_chore"
SERVICE_COMPLETE_CHORE = "complete_chore"
SERVICE_REMOVE_CHORE = "remove_chore"

ADD_CHORE_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("description", default=""): cv.string,
        vol.Optional("area"): cv.string,
        vol.Optional("assignee"): cv.string,
    }
)

COMPLETE_CHORE_SCHEMA = vol.Schema(
    {
        vol.Required("chore_id"): cv.string,
        vol.Optional("completed_by"): cv.string,
        vol.Optional("note", default=""): cv.string,
    }
)

REMOVE_CHORE_SCHEMA = vol.Schema(
    {
        vol.Required("chore_id"): cv.string,
    }
)


def _get_storage(hass: HomeAssistant) -> HomeBaseStorage:
    """Return the active HomeBase storage instance."""
    entries: list[ConfigEntry] = hass.config_entries.async_entries(DOMAIN)

    if not entries:
        raise ServiceValidationError("HomeBase is not configured")

    return entries[0].runtime_data


async def async_register_services(hass: HomeAssistant) -> None:
    """Register HomeBase service actions."""

    async def async_add_chore(call: ServiceCall) -> None:
        """Add a new HomeBase chore."""
        storage = _get_storage(hass)

        chore = Chore(
            name=call.data["name"],
            description=call.data["description"],
            area=call.data.get("area"),
            assignee=call.data.get("assignee"),
        )

        await storage.async_add_chore(chore)

    async def async_complete_chore(call: ServiceCall) -> None:
        """Complete a HomeBase chore."""
        storage = _get_storage(hass)
        chore_id = call.data["chore_id"]

        completed = await storage.async_complete_chore(
            chore_id,
            completed_by=call.data.get("completed_by"),
            note=call.data["note"],
        )

        if not completed:
            raise ServiceValidationError(
                f"HomeBase chore '{chore_id}' was not found"
            )

    async def async_remove_chore(call: ServiceCall) -> None:
        """Remove a HomeBase chore."""
        storage = _get_storage(hass)
        chore_id = call.data["chore_id"]

        removed = await storage.async_remove_chore(chore_id)

        if not removed:
            raise ServiceValidationError(
                f"HomeBase chore '{chore_id}' was not found"
            )

    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_CHORE,
        async_add_chore,
        schema=ADD_CHORE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_COMPLETE_CHORE,
        async_complete_chore,
        schema=COMPLETE_CHORE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_REMOVE_CHORE,
        async_remove_chore,
        schema=REMOVE_CHORE_SCHEMA,
    )
