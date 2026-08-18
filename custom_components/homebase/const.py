"""Constants for HomeBase."""

DOMAIN = "homebase"

SIGNAL_CHORE_REMINDER = f"{DOMAIN}_chore_reminder"

CONF_DUE_REMINDERS_ENABLED = "due_reminders_enabled"
CONF_OVERDUE_REMINDERS_ENABLED = "overdue_reminders_enabled"
CONF_REMINDER_ACTION = "reminder_action"

DEFAULT_DUE_REMINDERS_ENABLED = True
DEFAULT_OVERDUE_REMINDERS_ENABLED = True

STORAGE_KEY = f"{DOMAIN}.chores"
STORAGE_VERSION = 1
