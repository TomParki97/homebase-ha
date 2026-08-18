"""Service actions for HomeBase."""

from datetime import timedelta

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .models import Chore, ScheduleType, utc_now
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
        vol.Optional(
            "schedule_type",
            default=ScheduleType.ONE_TIME.value,
        ): vol.In([schedule.value for schedule in ScheduleType]),
        vol.Optional("due_at"): cv.datetime,
        vol.Optional("interval_days"): vol.All(
            vol.Coerce(int),
            vol.Range(min=1),
        ),
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

        schedule_type = ScheduleType(call.data["schedule_type"])
        interval_days = call.data.get("interval_days")
        due_at = call.data.get("due_at")

        if due_at is not None:
            due_at = dt_util.as_utc(due_at)

        if schedule_type in (
            ScheduleType.FIXED,
            ScheduleType.RELATIVE,
        ):
            if interval_days is None:
                raise ServiceValidationError(
                    "Repeat interval is required for recurring chores"
                )

            if due_at is None:
                due_at = utc_now() + timedelta(days=interval_days)

        elif interval_days is not None:
            raise ServiceValidationError(
                "Repeat interval can only be used with recurring chores"
            )

        chore = Chore(
            name=call.data["name"],
            description=call.data["description"],
            area=call.data.get("area"),
            assignee=call.data.get("assignee"),
            schedule_type=schedule_type,
            due_at=due_at,
            interval_days=interval_days,
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
