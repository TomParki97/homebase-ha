"""The HomeBase integration."""

from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.typing import ConfigType
from homeassistant.util import dt as dt_util

from .reminder_actions import async_setup_reminder_actions
from .reminders import (
    REMINDER_CHECK_INTERVAL,
    async_check_chore_reminders,
)
from .services import async_register_services
from .storage import HomeBaseStorage
from .websocket import async_register_websocket_api

type HomeBaseConfigEntry = ConfigEntry[HomeBaseStorage]

PLATFORMS: list[Platform] = [
    Platform.TODO,
    Platform.EVENT,
]

PANEL_URL = "/homebase_static"
PANEL_VERSION = "0.1.7"
PANEL_PATH = Path(__file__).parent / "frontend"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up HomeBase."""
    await async_register_services(hass)
    async_register_websocket_api(hass)

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                PANEL_URL,
                str(PANEL_PATH),
                False,
            )
        ]
    )

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path="homebase",
        webcomponent_name="homebase-panel",
        sidebar_title="HomeBase",
        sidebar_icon="mdi:home-heart",
        module_url=f"{PANEL_URL}/homebase-panel.js?v={PANEL_VERSION}",
    )

    return True


async def async_setup_entry(
    hass: HomeAssistant,
    entry: HomeBaseConfigEntry,
) -> bool:
    """Set up HomeBase from a config entry."""
    storage = HomeBaseStorage(hass)
    await storage.async_load()

    entry.runtime_data = storage

    await hass.config_entries.async_forward_entry_setups(
        entry,
        PLATFORMS,
    )

    entry.async_on_unload(
        async_setup_reminder_actions(
            hass,
            entry,
        )
    )

    async def async_check_reminders(now) -> None:
        """Run the HomeBase chore reminder check."""
        await async_check_chore_reminders(
            hass,
            storage,
            now,
        )

    entry.async_on_unload(
        async_track_time_interval(
            hass,
            async_check_reminders,
            REMINDER_CHECK_INTERVAL,
        )
    )

    await async_check_chore_reminders(
        hass,
        storage,
        dt_util.now(),
    )

    return True


async def async_unload_entry(
    hass: HomeAssistant,
    entry: HomeBaseConfigEntry,
) -> bool:
    """Unload a HomeBase config entry."""
    return await hass.config_entries.async_unload_platforms(
        entry,
        PLATFORMS,
    )
