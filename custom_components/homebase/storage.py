"""Persistent storage for HomeBase."""

from collections.abc import Callable
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION
from .models import Chore


class HomeBaseStorage:
    """Manage persistent HomeBase chore data."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize HomeBase storage."""
        self._store = Store[dict[str, Any]](
            hass,
            STORAGE_VERSION,
            STORAGE_KEY,
        )
        self._chores: dict[str, Chore] = {}
        self._listeners: set[Callable[[], None]] = set()

    @property
    def chores(self) -> list[Chore]:
        """Return all chores."""
        return list(self._chores.values())

    @callback
    def async_add_listener(
        self,
        listener: Callable[[], None],
    ) -> Callable[[], None]:
        """Subscribe to HomeBase storage changes."""
        self._listeners.add(listener)

        @callback
        def remove_listener() -> None:
            """Remove a HomeBase storage listener."""
            self._listeners.discard(listener)

        return remove_listener

    @callback
    def _async_notify_listeners(self) -> None:
        """Notify listeners that HomeBase data changed."""
        for listener in tuple(self._listeners):
            listener()

    async def async_load(self) -> None:
        """Load chores from Home Assistant storage."""
        data = await self._store.async_load()

        if data is None:
            return

        self._chores.clear()

        for stored_chore in data.get("chores", []):
            chore = Chore.from_dict(stored_chore)
            self._chores[chore.chore_id] = chore

    async def async_save(self) -> None:
        """Save all chores to Home Assistant storage."""
        await self._store.async_save(
            {
                "chores": [
                    chore.to_dict()
                    for chore in self._chores.values()
                ]
            }
        )

        self._async_notify_listeners()

    def get_chore(self, chore_id: str) -> Chore | None:
        """Return a chore by ID."""
        return self._chores.get(chore_id)

    async def async_add_chore(self, chore: Chore) -> None:
        """Add a chore and save it."""
        self._chores[chore.chore_id] = chore
        await self.async_save()

    async def async_complete_chore(
        self,
        chore_id: str,
        completed_by: str | None = None,
        note: str = "",
    ) -> bool:
        """Complete a chore and save the change."""
        chore = self.get_chore(chore_id)

        if chore is None:
            return False

        chore.complete(
            completed_by=completed_by,
            note=note,
        )

        await self.async_save()
        return True

    async def async_remove_chore(self, chore_id: str) -> bool:
        """Remove a chore and save the change."""
        if chore_id not in self._chores:
            return False

        del self._chores[chore_id]
        await self.async_save()
        return True
