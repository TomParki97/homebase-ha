"""Service actions for HomeBase."""

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN
from .models import Chore
from .storage import HomeBaseStorage

SERVICE_ADD_CHORE = "add_chore"

ADD_CHORE_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("description", default=""): cv.string,
        vol.Optional("area"): cv.string,
        vol.Optional("assignee"): cv.string,
    }
)


async def async_register_services(hass: HomeAssistant) -> None:
    """Register HomeBase service actions."""

    async def async_add_chore(call: ServiceCall) -> None:
        """Add a new HomeBase chore."""
        entries: list[ConfigEntry] = hass.config_entries.async_entries(DOMAIN)

        if not entries:
            raise RuntimeError("HomeBase is not configured")

        storage: HomeBaseStorage = entries[0].runtime_data

        chore = Chore(
            name=call.data["name"],
            description=call.data["description"],
            area=call.data.get("area"),
            assignee=call.data.get("assignee"),
        )

        await storage.async_add_chore(chore)

    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_CHORE,
        async_add_chore,
        schema=ADD_CHORE_SCHEMA,
    )
