"""HomeBase to-do list platform."""

from datetime import datetime

from homeassistant.components.todo import TodoItem, TodoListEntity
from homeassistant.components.todo.const import (
    TodoItemStatus,
    TodoListEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .models import Chore
from .storage import HomeBaseStorage


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry[HomeBaseStorage],
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the HomeBase to-do list."""
    async_add_entities([HomeBaseTodoList(entry.runtime_data)])


class HomeBaseTodoList(TodoListEntity):
    """Represent HomeBase chores as a Home Assistant to-do list."""

    _attr_has_entity_name = True
    _attr_translation_key = "chores"
    _attr_unique_id = "homebase_chores"

    _attr_supported_features = (
        TodoListEntityFeature.CREATE_TODO_ITEM
        | TodoListEntityFeature.DELETE_TODO_ITEM
        | TodoListEntityFeature.UPDATE_TODO_ITEM
        | TodoListEntityFeature.SET_DUE_DATETIME_ON_ITEM
        | TodoListEntityFeature.SET_DESCRIPTION_ON_ITEM
    )

    def __init__(self, storage: HomeBaseStorage) -> None:
        """Initialize the HomeBase to-do list."""
        self._storage = storage
        self._refresh_items()

    @callback
    def _refresh_items(self) -> None:
        """Refresh HomeBase to-do items from storage."""
        self._attr_todo_items = [
            TodoItem(
                uid=chore.chore_id,
                summary=chore.name,
                status=(
                    TodoItemStatus.COMPLETED
                    if chore.completed
                    else TodoItemStatus.NEEDS_ACTION
                ),
                due=chore.due_at,
                description=chore.description or None,
                completed=(
                    chore.last_completed_at
                    if chore.completed
                    else None
                ),
            )
            for chore in self._storage.chores
        ]

    async def async_added_to_hass(self) -> None:
        """Subscribe to HomeBase chore changes."""
        await super().async_added_to_hass()

        self.async_on_remove(
            self._storage.async_add_listener(
                self._async_handle_storage_update
            )
        )

    @callback
    def _async_handle_storage_update(self) -> None:
        """Handle a HomeBase storage update."""
        self._refresh_items()
        self.async_write_ha_state()

    async def async_create_todo_item(self, item: TodoItem) -> None:
        """Create a HomeBase chore from a to-do item."""
        if not item.summary:
            raise ServiceValidationError("Chore name is required")

        due_at = item.due if isinstance(item.due, datetime) else None

        await self._storage.async_add_chore(
            Chore(
                name=item.summary,
                description=item.description or "",
                due_at=due_at,
            )
        )

    async def async_update_todo_item(self, item: TodoItem) -> None:
        """Update a HomeBase chore from a to-do item."""
        if not item.uid:
            raise ServiceValidationError("Chore ID is required")

        chore = self._storage.get_chore(item.uid)

        if chore is None:
            raise ServiceValidationError(
                f"HomeBase chore '{item.uid}' was not found"
            )

        if item.summary:
            chore.name = item.summary

        chore.description = item.description or ""

        if item.due is None or isinstance(item.due, datetime):
            chore.due_at = item.due

        if (
            item.status == TodoItemStatus.COMPLETED
            and not chore.completed
        ):
            chore.complete()

        elif (
            item.status == TodoItemStatus.NEEDS_ACTION
            and chore.completed
        ):
            chore.completed = False

        await self._storage.async_save()

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        """Delete HomeBase chores."""
        for chore_id in uids:
            await self._storage.async_remove_chore(chore_id)
