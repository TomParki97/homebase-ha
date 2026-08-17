"""Config flow for HomeBase."""

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN


class HomeBaseConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for HomeBase."""

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial setup step."""
        if user_input is not None:
            return self.async_create_entry(title="HomeBase", data={})

        return self.async_show_form(step_id="user")
