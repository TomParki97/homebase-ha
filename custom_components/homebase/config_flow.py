"""Config flow for HomeBase."""

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_DUE_REMINDERS_ENABLED,
    CONF_MAINTENANCE_DUE_REMINDERS_ENABLED,
    CONF_MAINTENANCE_OVERDUE_REMINDERS_ENABLED,
    CONF_MAINTENANCE_REMINDER_ACTION,
    CONF_OVERDUE_REMINDERS_ENABLED,
    CONF_REMINDER_ACTION,
    DEFAULT_DUE_REMINDERS_ENABLED,
    DEFAULT_MAINTENANCE_DUE_REMINDERS_ENABLED,
    DEFAULT_MAINTENANCE_OVERDUE_REMINDERS_ENABLED,
    DEFAULT_OVERDUE_REMINDERS_ENABLED,
    DOMAIN,
)


class HomeBaseConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for HomeBase."""

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        """Handle the initial setup step."""
        if user_input is not None:
            return self.async_create_entry(
                title="HomeBase",
                data={},
            )

        return self.async_show_form(step_id="user")

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: ConfigEntry,
    ) -> OptionsFlow:
        """Create the HomeBase options flow."""
        return HomeBaseOptionsFlow()


class HomeBaseOptionsFlow(OptionsFlow):
    """Handle HomeBase options."""

    async def async_step_init(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        """Manage HomeBase reminder options."""
        if user_input is not None:
            return self.async_create_entry(
                data=user_input,
            )

        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_DUE_REMINDERS_ENABLED,
                    default=DEFAULT_DUE_REMINDERS_ENABLED,
                ): selector.BooleanSelector(),

                vol.Optional(
                    CONF_OVERDUE_REMINDERS_ENABLED,
                    default=DEFAULT_OVERDUE_REMINDERS_ENABLED,
                ): selector.BooleanSelector(),

                vol.Optional(
                    CONF_REMINDER_ACTION,
                ): selector.ActionSelector(),

                vol.Optional(
                    CONF_MAINTENANCE_DUE_REMINDERS_ENABLED,
                    default=(
                        DEFAULT_MAINTENANCE_DUE_REMINDERS_ENABLED
                    ),
                ): selector.BooleanSelector(),

                vol.Optional(
                    CONF_MAINTENANCE_OVERDUE_REMINDERS_ENABLED,
                    default=(
                        DEFAULT_MAINTENANCE_OVERDUE_REMINDERS_ENABLED
                    ),
                ): selector.BooleanSelector(),

                vol.Optional(
                    CONF_MAINTENANCE_REMINDER_ACTION,
                ): selector.ActionSelector(),
            }
        )

        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(
                schema,
                self.config_entry.options,
            ),
        )
