# HomeBase

HomeBase is a home-management platform built directly into Home Assistant.

HomeBase currently includes two modules:

- **Chores** — recurring household task management, completion history, reminders, and Home Assistant To-do integration.
- **Maintenance** — recurring home-maintenance tracking, service history, asset association, scheduling, and reminders.

Both modules are available through a dedicated HomeBase sidebar interface inside Home Assistant.

> [!WARNING]
> **HomeBase is currently in public beta.**
>
> `v0.2.0-beta.1` introduces the Maintenance module alongside Chores. Features, storage formats, and interfaces may change before a stable `v1.0.0` release.

## Features

### Chores

HomeBase Chores supports:

- Create, edit, and remove chores
- Pause and resume chores
- Assign chores to a person
- Associate chores with an area or room
- Add descriptions and due dates
- Track completion history and recent activity
- Automatically calculate recurring due dates

### Maintenance

HomeBase Maintenance supports:

- Create, edit, and remove maintenance items
- Pause and resume maintenance
- Associate maintenance with an asset
- Associate maintenance with an area or room
- Assign maintenance to a person
- Add descriptions and due dates
- Track full service history
- View recent service activity
- Track total completed services
- Automatically calculate recurring service dates
- Detect upcoming, due-today, overdue, paused, and completed maintenance

Typical uses include HVAC filters, air-conditioning service, water heaters, smoke-detector batteries, appliances, pool equipment, and other recurring home-maintenance tasks.

## Scheduling

Both Chores and Maintenance support three schedule types:

- **One time** — completed once and then finished.
- **Fixed cycle** — repeats on a fixed schedule based on the scheduled due date.
- **After completion** — the next due date is calculated from when the item was actually completed.

For example, Maintenance configured for every 90 days using **After completion** will become due 90 days after the most recent service.

## Completion and service history

Chores include:

- Completion history
- Last-completed timestamp
- Completion counts
- Recent activity

Maintenance includes:

- Full service history
- Last-serviced timestamp
- Total service count
- Recent service activity
- Automatic calculation of the next occurrence

Recurring items remain active after completion and automatically receive their next due date.

## Status tracking

HomeBase currently uses:

- **Upcoming**
- **Due today**
- **Overdue**
- **Paused**
- **Completed**

Paused items are excluded from reminder processing until resumed.

## Home Assistant integration

HomeBase currently adds:

- A dedicated **HomeBase** sidebar panel
- **Chores** and **Maintenance** tabs
- A native **HomeBase chores** To-do entity
- A **HomeBase Chore Reminder** Event entity
- A **HomeBase Maintenance Reminder** Event entity
- Home Assistant actions for Chore management
- Home Assistant actions for Maintenance management
- Configurable Home Assistant reminder actions

HomeBase appears under:

**Settings → Devices & services → Integrations → HomeBase**

## Reminders

HomeBase can detect when Chores and Maintenance become:

- **Due today**
- **Overdue**

Chore and Maintenance reminders are configured independently.

Reminder occurrences are stored persistently so HomeBase does not repeatedly trigger the same reminder during every scheduler check or after a Home Assistant restart.

Configure reminders from:

**Settings → Devices & services → Integrations → HomeBase → Configure**

Reminder actions can use normal Home Assistant actions, including mobile notifications, scripts, TTS, lights, and other services.

### Chore reminder variables

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

### Maintenance reminder variables

```text
{{ homebase_reminder_type }}
{{ homebase_maintenance_id }}
{{ homebase_maintenance_name }}
{{ homebase_description }}
{{ homebase_area }}
{{ homebase_asset }}
{{ homebase_assignee }}
{{ homebase_status }}
{{ homebase_schedule_type }}
{{ homebase_due_at }}
{{ homebase_interval_days }}
```

## Installation

### HACS custom repository

HomeBase can be installed through HACS as a custom integration repository.

1. Open **HACS** in Home Assistant.
2. Open **Custom repositories**.
3. Add:

   ```text
   https://github.com/TomParki97/homebase-ha
   ```

4. Select **Integration** as the repository type.
5. Add the repository.
6. Find **HomeBase** in HACS.
7. Download the desired HomeBase release.
8. Restart Home Assistant.
9. Go to **Settings → Devices & services → Add Integration**.
10. Search for **HomeBase**.
11. Complete setup.

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

### Add a Chore

1. Open **HomeBase** from the Home Assistant sidebar.
2. Select the **Chores** tab.
3. Select **+ Add Chore**.
4. Enter the chore details.
5. Choose a schedule type.
6. Choose the first due date.
7. For recurring chores, enter the repeat interval.
8. Save the chore.

### Add Maintenance

1. Open **HomeBase** from the Home Assistant sidebar.
2. Select the **Maintenance** tab.
3. Select **+ Add Maintenance**.
4. Enter the maintenance details.
5. Optionally add an asset, area, and assignee.
6. Choose a schedule type.
7. Choose the first due date.
8. For recurring maintenance, enter the repeat interval.
9. Save the maintenance item.

### Configure reminders

1. Open **Settings → Devices & services → Integrations**.
2. Open **HomeBase**.
3. Select **Configure**.
4. Enable or disable Chore due and overdue reminders.
5. Configure the Chore reminder action.
6. Enable or disable Maintenance due and overdue reminders.
7. Configure the Maintenance reminder action.
8. Submit the options.

## Home Assistant actions

HomeBase exposes Home Assistant actions for managing HomeBase data.

These include Chore and Maintenance actions such as adding, completing, and removing items.

They can be used from:

- Developer Tools
- Automations
- Scripts
- Other Home Assistant integrations

## Persistent storage

HomeBase stores Chores and Maintenance separately using Home Assistant storage.

This allows each module to maintain its own:

- Records
- Completion or service history
- Scheduling state
- Reminder occurrence markers

Reminder markers are persisted before reminder events are emitted so a Home Assistant restart does not cause the same occurrence to be sent repeatedly.

## Beta testing

`v0.2.0-beta.1` is a public beta release.

This release expands HomeBase from its original Chores module to include the first version of HomeBase Maintenance.

Feedback and bug reports are welcome.

When reporting an issue, please include:

- Home Assistant version
- HomeBase version
- Which HomeBase module is affected
- What you expected to happen
- What actually happened
- Relevant Home Assistant logs, if available
- Steps that reproduce the issue

Please use the repository's **Issues** section for bug reports and feedback.

## Roadmap

HomeBase is intended to grow into a broader home-management platform for Home Assistant.

### Available now

- Chores
- Maintenance

### Planned

Future development is expected to include areas such as:

- Shared HomeBase dashboard and platform architecture
- Assets
- Inventory
- Documents
- Vehicles
- Home health
- Additional household-management tools

The exact scope and order may change while HomeBase remains in beta.

## Updating

If HomeBase is installed through HACS, future releases can be downloaded through HACS when available.

After updating HomeBase, restart Home Assistant.

For manual installations, replace the existing:

```text
custom_components/homebase
```

directory with the version from the new release and restart Home Assistant.

Because HomeBase is currently beta software, review release notes before upgrading.

## License

HomeBase is released under the MIT License. See [LICENSE](LICENSE).

## Disclaimer

HomeBase is an independent community project and is not affiliated with or endorsed by the Home Assistant project, Nabu Casa, or the Open Home Foundation.
