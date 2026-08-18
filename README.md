# HomeBase

HomeBase is a home-management platform built directly into Home Assistant.

The first HomeBase module is **Chores**, providing recurring chore management, completion history, reminders, Home Assistant To-do integration, and a dedicated HomeBase sidebar interface.

> [!WARNING]
> **HomeBase is currently in public beta.**
>
> `v0.1.0-beta.1` is the first public release. Features, storage formats, and interfaces may change before a stable `v1.0.0` release.

## Features

### Chore management

- Create chores directly from the HomeBase sidebar
- Edit existing chores
- Remove chores with confirmation
- Pause and resume chores
- Assign chores to a person
- Associate chores with an area or room
- Add descriptions and due dates

### Scheduling

HomeBase currently supports:

- **One time** — completed once and then finished
- **Fixed cycle** — repeats on a fixed schedule
- **After completion** — the next due date is calculated from when the chore was actually completed

### Completion tracking

- Full completion history
- Last-completed timestamp
- Recent activity
- Recurring completion counts
- Automatic calculation of the next occurrence

### Home Assistant integration

HomeBase adds:

- A dedicated **HomeBase** sidebar panel
- A native **HomeBase chores** To-do entity
- A **HomeBase Chore Reminder** Event entity
- Home Assistant actions for chore management

### Reminders

HomeBase can detect when chores become:

- **Due today**
- **Overdue**

Reminder occurrences are stored persistently so HomeBase does not repeatedly trigger the same reminder after every check or Home Assistant restart.

Reminder delivery is configurable through:

**Settings → Devices & services → HomeBase → Configure**

You can use normal Home Assistant actions for reminder delivery, including mobile notifications.

Available reminder-action template variables include:

```text
{{ homebase_reminder_type }}
{{ homebase_chore_id }}
{{ homebase_chore_name }}
{{ homebase_description }}
{{ homebase_area }}
{{ homebase_assignee }}
{{ homebase_status }}
{{ homebase_schedule_type }}
{{ homebase_due_at }}
{{ homebase_interval_days }}
```

## Installation

### HACS custom repository

HomeBase can be added to HACS as a custom integration repository.

1. Open **HACS** in Home Assistant.
2. Open **Custom repositories**.
3. Add the HomeBase GitHub repository:\n\n   ```text\n   https://github.com/TomParki97/homebase-ha\n   ```
4. Select **Integration** as the repository type.
5. Add the repository.
6. Find **HomeBase** in HACS and download it.
7. Restart Home Assistant.
8. Go to **Settings → Devices & services → Add Integration**.
9. Search for **HomeBase**.
10. Complete setup.

### Manual installation

1. Download this repository or the desired HomeBase release.
2. Copy:

   ```text
   custom_components/homebase
   ```

   into:

   ```text
   <your Home Assistant config>/custom_components/homebase
   ```

3. Restart Home Assistant.
4. Go to **Settings → Devices & services → Add Integration**.
5. Search for **HomeBase**.
6. Complete setup.

## Getting started

1. Open **HomeBase** from the Home Assistant sidebar.
2. Select **+ Add Chore**.
3. Enter the chore details.
4. Select a schedule type.
5. Choose the first due date.
6. For recurring chores, enter the repeat interval.
7. Save the chore.

To configure reminders:

1. Open **Settings → Devices & services**.
2. Open **HomeBase**.
3. Select **Configure**.
4. Enable or disable Due and Overdue reminders.
5. Add the Home Assistant action you want HomeBase to run.

## Chore statuses

HomeBase currently uses:

- **Upcoming**
- **Due today**
- **Overdue**
- **Paused**
- **Completed**

## Beta testing

This is the first public beta of HomeBase.

Feedback and bug reports are welcome. When reporting an issue, please include:

- Home Assistant version
- HomeBase version
- What you expected to happen
- What actually happened
- Relevant Home Assistant logs, if available
- Steps that reproduce the issue

Please use the repository's **Issues** section for bug reports and feedback.

## Roadmap

HomeBase is intended to grow into a broader home-management platform.

Potential future modules include:

- Home maintenance
- Assets
- Inventory
- Documents
- Vehicles
- Home health
- Additional household-management tools

The first public beta focuses on the Chores module.

## Updating

If HomeBase is installed through HACS, future releases can be downloaded through HACS when available.

For manual installations, replace the existing `custom_components/homebase` directory with the version from the new release and restart Home Assistant.

Because HomeBase is currently beta software, review release notes before upgrading.

## License

HomeBase is released under the MIT License. See [LICENSE](LICENSE).

## Disclaimer

HomeBase is an independent community project and is not affiliated with or endorsed by the Home Assistant project, Nabu Casa, or the Open Home Foundation.
