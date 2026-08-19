"""Service actions for HomeBase Maintenance."""

from datetime import timedelta

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .maintenance_models import (
    MaintenanceItem,
    MaintenanceScheduleType,
    utc_now,
)
from .storage import HomeBaseStorage


SERVICE_ADD_MAINTENANCE = "add_maintenance"
SERVICE_COMPLETE_MAINTENANCE = "complete_maintenance"
SERVICE_REMOVE_MAINTENANCE = "remove_maintenance"


ADD_MAINTENANCE_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("description", default=""): cv.string,
        vol.Optional("area"): cv.string,
        vol.Optional("asset"): cv.string,
        vol.Optional("assignee"): cv.string,
        vol.Optional(
            "schedule_type",
            default=MaintenanceScheduleType.ONE_TIME.value,
        ): vol.In(
            [
                schedule.value
                for schedule in MaintenanceScheduleType
            ]
        ),
        vol.Optional("due_at"): cv.datetime,
        vol.Optional("interval_days"): vol.All(
            vol.Coerce(int),
            vol.Range(min=1),
        ),
    }
)


COMPLETE_MAINTENANCE_SCHEMA = vol.Schema(
    {
        vol.Required("maintenance_id"): cv.string,
        vol.Optional("completed_by"): cv.string,
        vol.Optional("note", default=""): cv.string,
    }
)


REMOVE_MAINTENANCE_SCHEMA = vol.Schema(
    {
        vol.Required("maintenance_id"): cv.string,
    }
)


def _get_storage(
    hass: HomeAssistant,
) -> HomeBaseStorage:
    """Return the active HomeBase storage instance."""
    entries: list[ConfigEntry] = (
        hass.config_entries.async_entries(DOMAIN)
    )

    if not entries:
        raise ServiceValidationError(
            "HomeBase is not configured"
        )

    return entries[0].runtime_data


async def async_register_maintenance_services(
    hass: HomeAssistant,
) -> None:
    """Register HomeBase Maintenance service actions."""

    async def async_add_maintenance(
        call: ServiceCall,
    ) -> None:
        """Add a HomeBase maintenance item."""
        storage = _get_storage(hass).maintenance

        schedule_type = MaintenanceScheduleType(
            call.data["schedule_type"]
        )

        interval_days = call.data.get(
            "interval_days"
        )

        due_at = call.data.get("due_at")

        if due_at is not None:
            due_at = dt_util.as_utc(due_at)

        if schedule_type in (
            MaintenanceScheduleType.FIXED,
            MaintenanceScheduleType.RELATIVE,
        ):
            if interval_days is None:
                raise ServiceValidationError(
                    "Repeat interval is required "
                    "for recurring maintenance"
                )

            if due_at is None:
                due_at = (
                    utc_now()
                    + timedelta(days=interval_days)
                )

        elif interval_days is not None:
            raise ServiceValidationError(
                "Repeat interval can only be used "
                "with recurring maintenance"
            )

        item = MaintenanceItem(
            name=call.data["name"],
            description=call.data["description"],
            area=call.data.get("area"),
            asset=call.data.get("asset"),
            assignee=call.data.get("assignee"),
            schedule_type=schedule_type,
            due_at=due_at,
            interval_days=interval_days,
        )

        await storage.async_add_item(item)

    async def async_complete_maintenance(
        call: ServiceCall,
    ) -> None:
        """Complete a HomeBase maintenance item."""
        storage = _get_storage(hass).maintenance
        maintenance_id = call.data["maintenance_id"]

        completed = await storage.async_complete_item(
            maintenance_id,
            completed_by=call.data.get(
                "completed_by"
            ),
            note=call.data["note"],
        )

        if not completed:
            raise ServiceValidationError(
                "HomeBase maintenance item "
                f"'{maintenance_id}' was not found"
            )

    async def async_remove_maintenance(
        call: ServiceCall,
    ) -> None:
        """Remove a HomeBase maintenance item."""
        storage = _get_storage(hass).maintenance
        maintenance_id = call.data["maintenance_id"]

        removed = await storage.async_remove_item(
            maintenance_id
        )

        if not removed:
            raise ServiceValidationError(
                "HomeBase maintenance item "
                f"'{maintenance_id}' was not found"
            )

    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_MAINTENANCE,
        async_add_maintenance,
        schema=ADD_MAINTENANCE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_COMPLETE_MAINTENANCE,
        async_complete_maintenance,
        schema=COMPLETE_MAINTENANCE_SCHEMA,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_REMOVE_MAINTENANCE,
        async_remove_maintenance,
        schema=REMOVE_MAINTENANCE_SCHEMA,
    )
