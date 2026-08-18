"""Event entities for HomeBase."""

from typing import Any

from homeassistant.components.event import EventEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import (
    async_dispatcher_connect,
)
from homeassistant.helpers.entity_platform import (
    AddConfigEntryEntitiesCallback,
)

from .const import SIGNAL_CHORE_REMINDER


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up HomeBase event entities."""
    async_add_entities(
        [
            HomeBaseChoreReminderEvent(),
        ]
    )


class HomeBaseChoreReminderEvent(EventEntity):
    """Represent HomeBase chore reminder events."""

    _attr_name = "HomeBase Chore Reminder"
    _attr_unique_id = "homebase_chore_reminder"
    _attr_event_types = [
        "due",
        "overdue",
    ]
    _attr_should_poll = False

    async def async_added_to_hass(self) -> None:
        """Subscribe to HomeBase reminder events."""
        await super().async_added_to_hass()

        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                SIGNAL_CHORE_REMINDER,
                self._handle_reminder,
            )
        )

    @callback
    def _handle_reminder(
        self,
        event_type: str,
        event_attributes: dict[str, Any],
    ) -> None:
        """Handle a reminder from the HomeBase scheduler."""
        self._trigger_event(
            event_type,
            event_attributes,
        )
        self.async_write_ha_state()
