"""Persistent Maintenance storage for HomeBase."""

from collections.abc import Callable
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import (
    MAINTENANCE_STORAGE_KEY,
    MAINTENANCE_STORAGE_VERSION,
)
from .maintenance_models import MaintenanceItem


class MaintenanceStorage:
    """Manage persistent HomeBase maintenance data."""

    def __init__(
        self,
        hass: HomeAssistant,
    ) -> None:
        """Initialize Maintenance storage."""
        self._store = Store[dict[str, Any]](
            hass,
            MAINTENANCE_STORAGE_VERSION,
            MAINTENANCE_STORAGE_KEY,
        )

        self._items: dict[
            str,
            MaintenanceItem,
        ] = {}

        self._listeners: set[
            Callable[[], None]
        ] = set()

    @property
    def items(self) -> list[MaintenanceItem]:
        """Return all maintenance items."""
        return list(self._items.values())

    @callback
    def async_add_listener(
        self,
        listener: Callable[[], None],
    ) -> Callable[[], None]:
        """Subscribe to Maintenance storage changes."""
        self._listeners.add(listener)

        @callback
        def remove_listener() -> None:
            """Remove the listener."""
            self._listeners.discard(listener)

        return remove_listener

    @callback
    def _async_notify_listeners(self) -> None:
        """Notify listeners of Maintenance changes."""
        for listener in tuple(self._listeners):
            listener()

    async def async_load(self) -> None:
        """Load Maintenance items."""
        data = await self._store.async_load()

        if data is None:
            return

        self._items.clear()

        for stored_item in data.get(
            "maintenance",
            [],
        ):
            item = MaintenanceItem.from_dict(
                stored_item
            )
            self._items[item.maintenance_id] = item

    async def async_save(self) -> None:
        """Save Maintenance items."""
        await self._store.async_save(
            {
                "maintenance": [
                    item.to_dict()
                    for item in self._items.values()
                ]
            }
        )

        self._async_notify_listeners()

    def get_item(
        self,
        maintenance_id: str,
    ) -> MaintenanceItem | None:
        """Return a maintenance item by ID."""
        return self._items.get(maintenance_id)

    async def async_add_item(
        self,
        item: MaintenanceItem,
    ) -> None:
        """Add a maintenance item."""
        self._items[item.maintenance_id] = item
        await self.async_save()

    async def async_complete_item(
        self,
        maintenance_id: str,
        completed_by: str | None = None,
        note: str = "",
    ) -> bool:
        """Complete a maintenance item."""
        item = self.get_item(maintenance_id)

        if item is None:
            return False

        item.complete(
            completed_by=completed_by,
            note=note,
        )

        await self.async_save()
        return True

    async def async_remove_item(
        self,
        maintenance_id: str,
    ) -> bool:
        """Remove a maintenance item."""
        if maintenance_id not in self._items:
            return False

        del self._items[maintenance_id]

        await self.async_save()
        return True
