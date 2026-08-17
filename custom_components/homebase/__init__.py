"""The HomeBase integration."""

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .services import async_register_services
from .storage import HomeBaseStorage

type HomeBaseConfigEntry = ConfigEntry[HomeBaseStorage]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up HomeBase."""
    await async_register_services(hass)
    return True


async def async_setup_entry(
    hass: HomeAssistant,
    entry: HomeBaseConfigEntry,
) -> bool:
    """Set up HomeBase from a config entry."""
    storage = HomeBaseStorage(hass)
    await storage.async_load()

    entry.runtime_data = storage

    return True


async def async_unload_entry(
    hass: HomeAssistant,
    entry: HomeBaseConfigEntry,
) -> bool:
    """Unload a HomeBase config entry."""
    return True
