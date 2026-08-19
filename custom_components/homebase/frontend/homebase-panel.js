class HomeBasePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._hass = null;
    this._loaded = false;
    this._loading = true;
    this._error = null;
    this._chores = [];
    this._notice = null;
    this._completingChoreId = null;
    this._showAddChore = false;
    this._selectedChoreId = null;
    this._editingChoreId = null;
    this._confirmRemoveChoreId = null;
    this._addChoreDraft = {
      name: "",
      description: "",
      area: "",
      assignee: "",
      schedule_type: "one_time",
      due_at: "",
      interval_days: "",
    };

    this._activeModule = "chores";
    this._maintenance = [];
    this._completingMaintenanceId = null;
    this._showAddMaintenance = false;
    this._selectedMaintenanceId = null;
    this._editingMaintenanceId = null;
    this._confirmRemoveMaintenanceId = null;
    this._maintenanceDraft = {
      name: "",
      description: "",
      area: "",
      asset: "",
      assignee: "",
      schedule_type: "one_time",
      due_at: "",
      interval_days: "",
    };
  }

  set hass(value) {
    this._hass = value;

    if (!this._loaded && value?.connection) {
      this._loaded = true;
      this.loadChores();
    }
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    this.render();
  }

  async loadChores() {
    if (!this._hass?.connection) {
      return;
    }

    this._loading = true;
    this._error = null;
    this.render();

    try {
      const result =
        await this._hass.connection.sendMessagePromise({
          type: "homebase/chores/list",
        });

      this._chores = result.chores || [];
    } catch (error) {
      console.error("Unable to load HomeBase chores", error);
      this._error = "Unable to load chores.";
    }

    this._loading = false;
    this.render();
  }

  formatDate(value) {
    if (!value) {
      return "No due date";
    }

    const date = new Date(value);

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  statusLabel(status) {
    const labels = {
      upcoming: "Upcoming",
      due_today: "Due today",
      overdue: "Overdue",
      paused: "Paused",
      completed: "Completed",
    };

    return labels[status] || status;
  }

  toDateTimeLocal(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;

    return new Date(date.getTime() - offset)
      .toISOString()
      .slice(0, 16);
  }

  openEditChore(chore) {
    this._editingChoreId = chore.chore_id;

    this._addChoreDraft = {
      name: chore.name || "",
      description: chore.description || "",
      area: chore.area || "",
      assignee: chore.assignee || "",
      schedule_type: chore.schedule_type || "one_time",
      due_at: this.toDateTimeLocal(chore.due_at),
      interval_days:
        chore.interval_days !== null &&
        chore.interval_days !== undefined
          ? String(chore.interval_days)
          : "",
    };

    this._error = null;
    this._showAddChore = true;
    this.render();
  }

  async addChore(form) {
    if (!this._hass) {
      return;
    }

    const formData = new FormData(form);

    this._addChoreDraft = {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      area: String(formData.get("area") || ""),
      assignee: String(formData.get("assignee") || ""),
      schedule_type: String(
        formData.get("schedule_type") || "one_time"
      ),
      due_at: String(formData.get("due_at") || ""),
      interval_days: String(
        formData.get("interval_days") || ""
      ),
    };

    const name = this._addChoreDraft.name.trim();
    const description = String(
      formData.get("description") || ""
    ).trim();
    const area = String(formData.get("area") || "").trim();
    const assignee = String(
      formData.get("assignee") || ""
    ).trim();
    const scheduleType = String(
      formData.get("schedule_type") || "one_time"
    );
    const dueValue = String(formData.get("due_at") || "").trim();
    const intervalValue = String(
      formData.get("interval_days") || ""
    ).trim();

    if (!name) {
      this._error = "Chore name is required.";
      this.render();
      return;
    }

    if (
      scheduleType !== "one_time" &&
      !intervalValue
    ) {
      this._error =
        "Repeat every is required for recurring chores.";
      this.render();
      return;
    }

    const serviceData = {
      name,
      description,
      schedule_type: scheduleType,
    };

    if (area) {
      serviceData.area = area;
    }

    if (assignee) {
      serviceData.assignee = assignee;
    }

    if (intervalValue) {
      serviceData.interval_days = Number(intervalValue);
    }

    if (dueValue) {
      serviceData.due_at = new Date(dueValue).toISOString();
    }

    this._error = null;

    try {
      await this._hass.callService(
        "homebase",
        "add_chore",
        serviceData
      );

      this._showAddChore = false;
      this._addChoreDraft = {
        name: "",
        description: "",
        area: "",
        assignee: "",
        schedule_type: "one_time",
        due_at: "",
        interval_days: "",
      };

      await this.loadChores();

      this._notice = `${name} added to HomeBase.`;
    } catch (error) {
      console.error("Unable to add HomeBase chore", error);
      this._error = "Unable to add chore.";
    }

    this.render();
  }

  async updateChore(form) {
    if (!this._hass || !this._editingChoreId) {
      return;
    }

    const formData = new FormData(form);

    this._addChoreDraft = {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      area: String(formData.get("area") || ""),
      assignee: String(formData.get("assignee") || ""),
      schedule_type: String(
        formData.get("schedule_type") || "one_time"
      ),
      due_at: String(formData.get("due_at") || ""),
      interval_days: String(
        formData.get("interval_days") || ""
      ),
    };

    const name = this._addChoreDraft.name.trim();
    const description =
      this._addChoreDraft.description.trim();
    const area = this._addChoreDraft.area.trim();
    const assignee =
      this._addChoreDraft.assignee.trim();
    const scheduleType =
      this._addChoreDraft.schedule_type;
    const dueValue =
      this._addChoreDraft.due_at.trim();
    const intervalValue =
      this._addChoreDraft.interval_days.trim();

    if (!name) {
      this._error = "Chore name is required.";
      this.render();
      return;
    }

    if (
      scheduleType !== "one_time" &&
      !intervalValue
    ) {
      this._error =
        "Repeat every is required for recurring chores.";
      this.render();
      return;
    }

    const choreId = this._editingChoreId;

    const message = {
      type: "homebase/chores/update",
      chore_id: choreId,
      name,
      description,
      area: area || null,
      assignee: assignee || null,
      schedule_type: scheduleType,
      due_at: dueValue
        ? new Date(dueValue).toISOString()
        : null,
      interval_days:
        scheduleType === "one_time"
          ? null
          : Number(intervalValue),
    };

    this._error = null;
    this._notice = null;

    try {
      await this._hass.connection.sendMessagePromise(
        message
      );

      this._showAddChore = false;
      this._editingChoreId = null;

      this._addChoreDraft = {
        name: "",
        description: "",
        area: "",
        assignee: "",
        schedule_type: "one_time",
        due_at: "",
        interval_days: "",
      };

      await this.loadChores();

      this._selectedChoreId = choreId;
      this._notice = `${name} updated.`;
    } catch (error) {
      console.error(
        "Unable to update HomeBase chore",
        error
      );
      this._error = "Unable to update chore.";
    }

    this.render();
  }

  async removeChore(choreId) {
    if (!this._hass) {
      return;
    }

    const chore = this._chores.find(
      (item) => item.chore_id === choreId
    );

    this._error = null;
    this._notice = null;

    try {
      await this._hass.callService(
        "homebase",
        "remove_chore",
        {
          chore_id: choreId,
        }
      );

      this._confirmRemoveChoreId = null;
      this._selectedChoreId = null;

      await this.loadChores();

      this._notice =
        `${chore?.name || "Chore"} removed from HomeBase.`;
    } catch (error) {
      console.error(
        "Unable to remove HomeBase chore",
        error
      );
      this._error = "Unable to remove chore.";
    }

    this.render();
  }

  async setChorePaused(choreId, paused) {
    if (!this._hass) {
      return;
    }

    const chore = this._chores.find(
      (item) => item.chore_id === choreId
    );

    this._error = null;
    this._notice = null;

    try {
      await this._hass.connection.sendMessagePromise({
        type: "homebase/chores/set_paused",
        chore_id: choreId,
        paused,
      });

      await this.loadChores();

      this._notice = paused
        ? `${chore?.name || "Chore"} paused.`
        : `${chore?.name || "Chore"} resumed.`;
    } catch (error) {
      console.error(
        "Unable to update HomeBase chore pause state",
        error
      );
      this._error = paused
        ? "Unable to pause chore."
        : "Unable to resume chore.";
    }

    this.render();
  }

  async completeChore(choreId) {
    if (!this._hass || this._completingChoreId) {
      return;
    }

    const chore = this._chores.find(
      (item) => item.chore_id === choreId
    );

    this._completingChoreId = choreId;
    this._notice = null;
    this._error = null;
    this.render();

    try {
      await this._hass.callService(
        "homebase",
        "complete_chore",
        {
          chore_id: choreId,
          note: "Completed from HomeBase",
        }
      );

      await this.loadChores();

      const updated = this._chores.find(
        (item) => item.chore_id === choreId
      );

      if (updated && updated.status !== "completed") {
        this._notice =
          `${chore?.name || "Chore"} completed. ` +
          `Next due ${this.formatDate(updated.due_at)}.`;
      } else {
        this._notice =
          `${chore?.name || "Chore"} completed.`;
      }
    } catch (error) {
      console.error("Unable to complete HomeBase chore", error);
      this._error = "Unable to complete chore.";
    } finally {
      this._completingChoreId = null;
      this.render();
    }
  }

  scheduleLabel(scheduleType) {
    switch (scheduleType) {
      case "fixed":
        return "Fixed cycle";
      case "relative":
        return "After completion";
      default:
        return "One time";
    }
  }

  renderChore(chore) {
    const meta = [
      chore.area,
      chore.assignee,
      chore.due_at ? `Due ${this.formatDate(chore.due_at)}` : null,
      chore.interval_days
        ? `Every ${chore.interval_days} days`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return `
      <article
        class="chore chore-open"
        data-chore-id="${this.escapeHtml(chore.chore_id)}"
      >
        <div class="chore-main">
          <div class="chore-title-row">
            <h3>${this.escapeHtml(chore.name)}</h3>

            <div class="chore-actions">
              <span class="status status-${chore.status}">
                ${this.statusLabel(chore.status)}
              </span>

              ${
                chore.status !== "completed" &&
                chore.status !== "paused"
                  ? `
                    <button
                      class="complete-button"
                      data-chore-id="${this.escapeHtml(chore.chore_id)}"
                      ${
                        this._completingChoreId === chore.chore_id
                          ? "disabled"
                          : ""
                      }
                    >
                      ${
                        this._completingChoreId === chore.chore_id
                          ? "Completing…"
                          : "Complete"
                      }
                    </button>
                  `
                  : ""
              }

              ${
                chore.status !== "completed"
                  ? `
                    <button
                      class="pause-button"
                      data-chore-id="${this.escapeHtml(chore.chore_id)}"
                      data-paused="${
                        chore.status === "paused"
                          ? "false"
                          : "true"
                      }"
                    >
                      ${
                        chore.status === "paused"
                          ? "Resume"
                          : "Pause"
                      }
                    </button>
                  `
                  : ""
              }
            </div>
          </div>

          ${
            chore.description
              ? `<p class="description">${this.escapeHtml(
                  chore.description
                )}</p>`
              : ""
          }

          ${
            meta
              ? `<p class="meta">${this.escapeHtml(meta)}</p>`
              : ""
          }

          ${
            chore.last_completed_at &&
            chore.status !== "completed"
              ? `
                <p class="last-completed">
                  Last completed ${this.formatDate(
                    chore.last_completed_at
                  )}
                  ${
                    chore.completion_history?.length
                      ? ` · ${chore.completion_history.length} completions`
                      : ""
                  }
                </p>
              `
              : ""
          }
        </div>
      </article>
    `;
  }

  renderModuleTabs(activeModule) {
    return `
      <nav class="module-tabs" aria-label="HomeBase modules">
        <button
          type="button"
          id="module-chores"
          class="module-tab ${activeModule === "chores" ? "module-tab-active" : ""}"
        >
          Chores
        </button>
        <button
          type="button"
          id="module-maintenance"
          class="module-tab ${activeModule === "maintenance" ? "module-tab-active" : ""}"
        >
          Maintenance
        </button>
      </nav>
    `;
  }

  switchModule(module) {
    if (
      !["chores", "maintenance"].includes(module) ||
      module === this._activeModule
    ) {
      return;
    }

    this._activeModule = module;
    this._error = null;
    this._notice = null;

    if (module === "maintenance") {
      this._showAddChore = false;
      this._selectedChoreId = null;
      this._confirmRemoveChoreId = null;
      this.loadMaintenance();
      return;
    }

    this._showAddMaintenance = false;
    this._selectedMaintenanceId = null;
    this._confirmRemoveMaintenanceId = null;
    this.loadChores();
  }

  async loadMaintenance() {
    if (!this._hass?.connection) {
      return;
    }

    this._loading = true;
    this._error = null;
    this.render();

    try {
      const result =
        await this._hass.connection.sendMessagePromise({
          type: "homebase/maintenance/list",
        });

      this._maintenance = result.maintenance || [];
    } catch (error) {
      console.error(
        "Unable to load HomeBase maintenance",
        error
      );
      this._error = "Unable to load maintenance.";
    }

    this._loading = false;
    this.render();
  }

  resetMaintenanceDraft() {
    this._maintenanceDraft = {
      name: "",
      description: "",
      area: "",
      asset: "",
      assignee: "",
      schedule_type: "one_time",
      due_at: "",
      interval_days: "",
    };
  }

  openEditMaintenance(item) {
    this._editingMaintenanceId = item.maintenance_id;

    this._maintenanceDraft = {
      name: item.name || "",
      description: item.description || "",
      area: item.area || "",
      asset: item.asset || "",
      assignee: item.assignee || "",
      schedule_type: item.schedule_type || "one_time",
      due_at: this.toDateTimeLocal(item.due_at),
      interval_days:
        item.interval_days !== null &&
        item.interval_days !== undefined
          ? String(item.interval_days)
          : "",
    };

    this._error = null;
    this._showAddMaintenance = true;
    this.render();
  }

  async addMaintenance(form) {
    if (!this._hass) {
      return;
    }

    const formData = new FormData(form);

    this._maintenanceDraft = {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      area: String(formData.get("area") || ""),
      asset: String(formData.get("asset") || ""),
      assignee: String(formData.get("assignee") || ""),
      schedule_type: String(
        formData.get("schedule_type") || "one_time"
      ),
      due_at: String(formData.get("due_at") || ""),
      interval_days: String(
        formData.get("interval_days") || ""
      ),
    };

    const name = this._maintenanceDraft.name.trim();
    const description =
      this._maintenanceDraft.description.trim();
    const area = this._maintenanceDraft.area.trim();
    const asset = this._maintenanceDraft.asset.trim();
    const assignee =
      this._maintenanceDraft.assignee.trim();
    const scheduleType =
      this._maintenanceDraft.schedule_type;
    const dueValue =
      this._maintenanceDraft.due_at.trim();
    const intervalValue =
      this._maintenanceDraft.interval_days.trim();

    if (!name) {
      this._error = "Maintenance name is required.";
      this.render();
      return;
    }

    if (
      scheduleType !== "one_time" &&
      !intervalValue
    ) {
      this._error =
        "Repeat every is required for recurring maintenance.";
      this.render();
      return;
    }

    const serviceData = {
      name,
      description,
      schedule_type: scheduleType,
    };

    if (area) {
      serviceData.area = area;
    }

    if (asset) {
      serviceData.asset = asset;
    }

    if (assignee) {
      serviceData.assignee = assignee;
    }

    if (intervalValue) {
      serviceData.interval_days = Number(intervalValue);
    }

    if (dueValue) {
      serviceData.due_at =
        new Date(dueValue).toISOString();
    }

    this._error = null;
    this._notice = null;

    try {
      await this._hass.callService(
        "homebase",
        "add_maintenance",
        serviceData
      );

      this._showAddMaintenance = false;
      this._editingMaintenanceId = null;
      this.resetMaintenanceDraft();

      await this.loadMaintenance();

      this._notice =
        `${name} added to Maintenance.`;
    } catch (error) {
      console.error(
        "Unable to add HomeBase maintenance",
        error
      );
      this._error = "Unable to add maintenance.";
    }

    this.render();
  }

  async updateMaintenance(form) {
    if (!this._hass || !this._editingMaintenanceId) {
      return;
    }

    const formData = new FormData(form);

    this._maintenanceDraft = {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      area: String(formData.get("area") || ""),
      asset: String(formData.get("asset") || ""),
      assignee: String(formData.get("assignee") || ""),
      schedule_type: String(
        formData.get("schedule_type") || "one_time"
      ),
      due_at: String(formData.get("due_at") || ""),
      interval_days: String(
        formData.get("interval_days") || ""
      ),
    };

    const name = this._maintenanceDraft.name.trim();
    const description =
      this._maintenanceDraft.description.trim();
    const area = this._maintenanceDraft.area.trim();
    const asset = this._maintenanceDraft.asset.trim();
    const assignee =
      this._maintenanceDraft.assignee.trim();
    const scheduleType =
      this._maintenanceDraft.schedule_type;
    const dueValue =
      this._maintenanceDraft.due_at.trim();
    const intervalValue =
      this._maintenanceDraft.interval_days.trim();

    if (!name) {
      this._error = "Maintenance name is required.";
      this.render();
      return;
    }

    if (
      scheduleType !== "one_time" &&
      !intervalValue
    ) {
      this._error =
        "Repeat every is required for recurring maintenance.";
      this.render();
      return;
    }

    const maintenanceId =
      this._editingMaintenanceId;

    const message = {
      type: "homebase/maintenance/update",
      maintenance_id: maintenanceId,
      name,
      description,
      area: area || null,
      asset: asset || null,
      assignee: assignee || null,
      schedule_type: scheduleType,
      due_at: dueValue
        ? new Date(dueValue).toISOString()
        : null,
      interval_days:
        scheduleType === "one_time"
          ? null
          : Number(intervalValue),
    };

    this._error = null;
    this._notice = null;

    try {
      await this._hass.connection.sendMessagePromise(
        message
      );

      this._showAddMaintenance = false;
      this._editingMaintenanceId = null;
      this.resetMaintenanceDraft();

      await this.loadMaintenance();

      this._selectedMaintenanceId = maintenanceId;
      this._notice = `${name} updated.`;
    } catch (error) {
      console.error(
        "Unable to update HomeBase maintenance",
        error
      );
      this._error = "Unable to update maintenance.";
    }

    this.render();
  }

  async removeMaintenance(maintenanceId) {
    if (!this._hass) {
      return;
    }

    const item = this._maintenance.find(
      (entry) =>
        entry.maintenance_id === maintenanceId
    );

    this._error = null;
    this._notice = null;

    try {
      await this._hass.callService(
        "homebase",
        "remove_maintenance",
        {
          maintenance_id: maintenanceId,
        }
      );

      this._confirmRemoveMaintenanceId = null;
      this._selectedMaintenanceId = null;

      await this.loadMaintenance();

      this._notice =
        `${item?.name || "Maintenance item"} removed from HomeBase.`;
    } catch (error) {
      console.error(
        "Unable to remove HomeBase maintenance",
        error
      );
      this._error = "Unable to remove maintenance.";
    }

    this.render();
  }

  async setMaintenancePaused(
    maintenanceId,
    paused
  ) {
    if (!this._hass) {
      return;
    }

    const item = this._maintenance.find(
      (entry) =>
        entry.maintenance_id === maintenanceId
    );

    this._error = null;
    this._notice = null;

    try {
      await this._hass.connection.sendMessagePromise({
        type: "homebase/maintenance/set_paused",
        maintenance_id: maintenanceId,
        paused,
      });

      await this.loadMaintenance();

      this._notice = paused
        ? `${item?.name || "Maintenance item"} paused.`
        : `${item?.name || "Maintenance item"} resumed.`;
    } catch (error) {
      console.error(
        "Unable to update HomeBase maintenance pause state",
        error
      );
      this._error = paused
        ? "Unable to pause maintenance."
        : "Unable to resume maintenance.";
    }

    this.render();
  }

  async completeMaintenance(maintenanceId) {
    if (
      !this._hass ||
      this._completingMaintenanceId
    ) {
      return;
    }

    const item = this._maintenance.find(
      (entry) =>
        entry.maintenance_id === maintenanceId
    );

    this._completingMaintenanceId =
      maintenanceId;
    this._notice = null;
    this._error = null;
    this.render();

    try {
      await this._hass.callService(
        "homebase",
        "complete_maintenance",
        {
          maintenance_id: maintenanceId,
          note: "Completed from HomeBase",
        }
      );

      await this.loadMaintenance();

      const updated = this._maintenance.find(
        (entry) =>
          entry.maintenance_id === maintenanceId
      );

      if (
        updated &&
        updated.status !== "completed"
      ) {
        this._notice =
          `${item?.name || "Maintenance item"} completed. ` +
          `Next due ${this.formatDate(updated.due_at)}.`;
      } else {
        this._notice =
          `${item?.name || "Maintenance item"} completed.`;
      }
    } catch (error) {
      console.error(
        "Unable to complete HomeBase maintenance",
        error
      );
      this._error = "Unable to complete maintenance.";
    } finally {
      this._completingMaintenanceId = null;
      this.render();
    }
  }

  renderMaintenanceItem(item) {
    const meta = [
      item.asset ? `Asset: ${item.asset}` : null,
      item.area,
      item.assignee,
      item.due_at
        ? `Due ${this.formatDate(item.due_at)}`
        : null,
      item.interval_days
        ? `Every ${item.interval_days} days`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return `
      <article
        class="maintenance-card maintenance-open"
        data-maintenance-id="${this.escapeHtml(item.maintenance_id)}"
      >
        <div class="maintenance-main">
          <div class="maintenance-title-row">
            <h3>${this.escapeHtml(item.name)}</h3>

            <div class="maintenance-actions">
              <span class="status status-${item.status}">
                ${this.statusLabel(item.status)}
              </span>

              ${
                item.status !== "completed" &&
                item.status !== "paused"
                  ? `
                    <button
                      class="maintenance-complete-button"
                      data-maintenance-id="${this.escapeHtml(item.maintenance_id)}"
                      ${
                        this._completingMaintenanceId ===
                        item.maintenance_id
                          ? "disabled"
                          : ""
                      }
                    >
                      ${
                        this._completingMaintenanceId ===
                        item.maintenance_id
                          ? "Completing…"
                          : "Complete"
                      }
                    </button>
                  `
                  : ""
              }

              ${
                item.status !== "completed"
                  ? `
                    <button
                      class="maintenance-pause-button"
                      data-maintenance-id="${this.escapeHtml(item.maintenance_id)}"
                      data-paused="${
                        item.status === "paused"
                          ? "false"
                          : "true"
                      }"
                    >
                      ${
                        item.status === "paused"
                          ? "Resume"
                          : "Pause"
                      }
                    </button>
                  `
                  : ""
              }
            </div>
          </div>

          ${
            item.description
              ? `<p class="description">${this.escapeHtml(
                  item.description
                )}</p>`
              : ""
          }

          ${
            meta
              ? `<p class="meta">${this.escapeHtml(meta)}</p>`
              : ""
          }

          ${
            item.last_completed_at &&
            item.status !== "completed"
              ? `
                <p class="last-completed">
                  Last completed ${this.formatDate(
                    item.last_completed_at
                  )}
                  ${
                    item.completion_history?.length
                      ? ` · ${item.completion_history.length} services`
                      : ""
                  }
                </p>
              `
              : ""
          }
        </div>
      </article>
    `;
  }

  renderMaintenance() {
    if (!this.shadowRoot) {
      return;
    }

    const active = this._maintenance.filter(
      (item) =>
        item.status !== "completed" &&
        item.status !== "paused"
    );

    const completed = this._maintenance.filter(
      (item) => item.status === "completed"
    );

    const paused = this._maintenance.filter(
      (item) => item.status === "paused"
    );

    const selectedMaintenance =
      this._selectedMaintenanceId
        ? this._maintenance.find(
            (item) =>
              item.maintenance_id ===
              this._selectedMaintenanceId
          )
        : null;

    const dueToday = this._maintenance.filter(
      (item) => item.status === "due_today"
    ).length;

    const overdue = this._maintenance.filter(
      (item) => item.status === "overdue"
    ).length;

    const recentActivity = this._maintenance
      .filter((item) => item.last_completed_at)
      .map((item) => {
        const history =
          item.completion_history || [];

        return {
          item,
          completion:
            history[history.length - 1] || {
              completed_at:
                item.last_completed_at,
              completed_by: null,
              note: "",
            },
        };
      })
      .sort(
        (a, b) =>
          new Date(b.completion.completed_at) -
          new Date(a.completion.completed_at)
      )
      .slice(0, 5);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: 100%;
          box-sizing: border-box;
          background: var(--primary-background-color);
          color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
        }

        * {
          box-sizing: border-box;
        }

        .page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 28px 24px 60px;
        }

        .module-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          padding: 5px;
          width: fit-content;
          border-radius: 14px;
          background: var(--secondary-background-color);
        }

        .module-tab {
          padding: 9px 15px;
          border: 0;
          border-radius: 10px;
          cursor: pointer;
          font: inherit;
          font-weight: 700;
          color: var(--secondary-text-color);
          background: transparent;
        }

        .module-tab-active {
          color: var(--text-primary-color);
          background: var(--primary-color);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 28px;
        }

        .eyebrow {
          margin: 0 0 4px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--secondary-text-color);
        }

        h1 {
          margin: 0;
          font-size: 32px;
          line-height: 1.2;
        }

        .subtitle {
          margin: 7px 0 0;
          color: var(--secondary-text-color);
        }

        button {
          border: 0;
          border-radius: 12px;
          padding: 11px 16px;
          cursor: pointer;
          font: inherit;
          font-weight: 600;
          color: var(--text-primary-color);
          background: var(--primary-color);
        }

        .header-actions,
        .maintenance-actions,
        .form-actions {
          display: flex;
          gap: 10px;
        }

        .secondary-button,
        .maintenance-pause-button,
        .close-button {
          color: var(--primary-text-color);
          background: var(--secondary-background-color);
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 30px;
        }

        .stat,
        .maintenance-card,
        .activity-item {
          background: var(--card-background-color);
          box-shadow: var(--ha-card-box-shadow);
        }

        .stat {
          padding: 18px;
          border-radius: 16px;
        }

        .stat-value {
          display: block;
          font-size: 28px;
          font-weight: 700;
        }

        .stat-label {
          color: var(--secondary-text-color);
          font-size: 14px;
        }

        section {
          margin-top: 30px;
        }

        .section-title,
        .history-heading {
          margin: 0 0 12px;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--secondary-text-color);
        }

        .maintenance-list,
        .activity-list,
        .history-list {
          display: grid;
          gap: 12px;
        }

        .maintenance-card {
          padding: 18px 20px;
          border-radius: 16px;
        }

        .maintenance-open {
          cursor: pointer;
          transition:
            transform 120ms ease,
            box-shadow 120ms ease;
        }

        .maintenance-open:hover {
          transform: translateY(-1px);
        }

        .maintenance-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .maintenance-actions {
          align-items: center;
        }

        h3 {
          margin: 0;
          font-size: 18px;
        }

        .description {
          margin: 8px 0 0;
          color: var(--primary-text-color);
        }

        .meta,
        .last-completed,
        .activity-meta {
          margin: 7px 0 0;
          color: var(--secondary-text-color);
          font-size: 13px;
        }

        .maintenance-complete-button,
        .maintenance-pause-button,
        .danger-button,
        .close-button {
          padding: 7px 11px;
          border-radius: 10px;
          font-size: 13px;
        }

        .maintenance-complete-button:disabled {
          opacity: 0.65;
          cursor: default;
        }

        .status {
          flex: 0 0 auto;
          padding: 5px 9px;
          border-radius: 999px;
          background: var(--secondary-background-color);
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 700;
        }

        .status-overdue {
          color: var(--error-color);
        }

        .notice {
          margin-bottom: 20px;
          padding: 13px 16px;
          border-radius: 12px;
          background: var(--card-background-color);
          border-left: 4px solid var(--success-color, var(--primary-color));
        }

        .empty,
        .loading,
        .error {
          padding: 28px;
          text-align: center;
          border-radius: 16px;
          color: var(--secondary-text-color);
          background: var(--card-background-color);
        }

        .error {
          color: var(--error-color);
        }

        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          padding: 15px 18px;
          border-radius: 14px;
        }

        .activity-check {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          font-size: 16px;
          font-weight: 700;
          color: var(--success-color, var(--primary-color));
          background: var(--secondary-background-color);
        }

        .activity-content {
          min-width: 0;
          flex: 1;
        }

        .activity-title {
          margin: 0;
          font-weight: 700;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.62);
        }

        .modal {
          width: min(680px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          padding: 24px;
          border-radius: 20px;
          background: var(--card-background-color);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 24px;
        }

        .modal-header p {
          margin: 6px 0 0;
          color: var(--secondary-text-color);
        }

        .detail-grid,
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .detail-grid {
          margin-top: 20px;
        }

        .detail-item,
        .history-item,
        .confirmation-warning {
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--secondary-background-color);
        }

        .detail-item-full,
        .field-full {
          grid-column: 1 / -1;
        }

        .detail-label {
          margin: 0 0 5px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--secondary-text-color);
        }

        .detail-value,
        .history-item p {
          margin: 0;
        }

        .history-heading {
          margin-top: 24px;
        }

        .history-meta {
          margin-top: 5px !important;
          font-size: 12px;
          color: var(--secondary-text-color);
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        label {
          font-size: 13px;
          font-weight: 700;
          color: var(--secondary-text-color);
        }

        input,
        textarea,
        select {
          width: 100%;
          border: 1px solid var(--divider-color);
          border-radius: 11px;
          padding: 11px 12px;
          outline: none;
          font: inherit;
          color: var(--primary-text-color);
          background: var(--primary-background-color);
        }

        textarea {
          min-height: 90px;
          resize: vertical;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: var(--primary-color);
        }

        .form-help {
          margin: 0;
          font-size: 12px;
          color: var(--secondary-text-color);
        }

        .form-actions {
          justify-content: flex-end;
          margin-top: 22px;
        }

        .hidden {
          display: none;
        }

        .danger-button {
          border: 1px solid var(--error-color);
          background: transparent;
          color: var(--error-color);
        }

        .danger-button-solid {
          background: var(--error-color);
          color: white;
        }

        .confirmation-warning {
          margin: 18px 0;
        }

        .confirmation-warning p {
          margin: 0;
        }

        .confirmation-warning p + p {
          margin-top: 8px;
          color: var(--secondary-text-color);
          font-size: 13px;
        }

        @media (max-width: 700px) {
          .page {
            padding: 20px 14px 50px;
          }

          .header,
          .maintenance-title-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .detail-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }

          .detail-item-full,
          .field-full {
            grid-column: auto;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }

          .module-tabs {
            width: 100%;
          }

          .module-tab {
            flex: 1;
          }

          .maintenance-actions {
            flex-wrap: wrap;
          }
        }
      </style>

      <main class="page">
        ${this.renderModuleTabs("maintenance")}

        <header class="header">
          <div>
            <p class="eyebrow">HomeBase</p>
            <h1>Maintenance</h1>
            <p class="subtitle">
              Track recurring home maintenance, service history, and upcoming work.
            </p>
          </div>

          <div class="header-actions">
            <button
              class="secondary-button"
              id="maintenance-refresh-button"
            >
              Refresh
            </button>

            <button id="add-maintenance-button">
              + Add Maintenance
            </button>
          </div>
        </header>

        ${
          this._notice
            ? `<div class="notice">${this.escapeHtml(this._notice)}</div>`
            : ""
        }

        <div class="stats">
          <div class="stat">
            <span class="stat-value">${active.length}</span>
            <span class="stat-label">Active</span>
          </div>

          <div class="stat">
            <span class="stat-value">${dueToday}</span>
            <span class="stat-label">Due today</span>
          </div>

          <div class="stat">
            <span class="stat-value">${overdue}</span>
            <span class="stat-label">Overdue</span>
          </div>
        </div>

        ${
          this._loading
            ? `<div class="loading">Loading HomeBase maintenance…</div>`
            : this._error
              ? `<div class="error">${this.escapeHtml(this._error)}</div>`
              : `
                <section>
                  <h2 class="section-title">Active</h2>

                  <div class="maintenance-list">
                    ${
                      active.length
                        ? active
                            .map((item) =>
                              this.renderMaintenanceItem(item)
                            )
                            .join("")
                        : `<div class="empty">No active maintenance.</div>`
                    }
                  </div>
                </section>

                ${
                  paused.length
                    ? `
                      <section>
                        <h2 class="section-title">Paused</h2>

                        <div class="maintenance-list">
                          ${paused
                            .map((item) =>
                              this.renderMaintenanceItem(item)
                            )
                            .join("")}
                        </div>
                      </section>
                    `
                    : ""
                }

                ${
                  recentActivity.length
                    ? `
                      <section>
                        <h2 class="section-title">
                          Recent Service Activity
                        </h2>

                        <div class="activity-list">
                          ${recentActivity
                            .map(({ item, completion }) => {
                              const details = [
                                `Completed ${this.formatDate(
                                  completion.completed_at
                                )}`,
                                completion.completed_by
                                  ? `by ${completion.completed_by}`
                                  : null,
                                item.status !== "completed" &&
                                item.due_at
                                  ? `Next due ${this.formatDate(
                                      item.due_at
                                    )}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ");

                              return `
                                <div class="activity-item">
                                  <div class="activity-check">✓</div>

                                  <div class="activity-content">
                                    <p class="activity-title">
                                      ${this.escapeHtml(item.name)}
                                    </p>

                                    <p class="activity-meta">
                                      ${this.escapeHtml(details)}
                                    </p>
                                  </div>
                                </div>
                              `;
                            })
                            .join("")}
                        </div>
                      </section>
                    `
                    : ""
                }

                <section>
                  <h2 class="section-title">Completed</h2>

                  <div class="maintenance-list">
                    ${
                      completed.length
                        ? completed
                            .map((item) =>
                              this.renderMaintenanceItem(item)
                            )
                            .join("")
                        : `<div class="empty">No completed maintenance yet.</div>`
                    }
                  </div>
                </section>
              `
        }

        ${
          selectedMaintenance &&
          !this._showAddMaintenance &&
          !this._confirmRemoveMaintenanceId
            ? `
              <div class="modal-backdrop">
                <div class="modal">
                  <div class="modal-header">
                    <div>
                      <h2>
                        ${this.escapeHtml(selectedMaintenance.name)}
                      </h2>

                      <p>
                        <span
                          class="status status-${selectedMaintenance.status}"
                        >
                          ${this.statusLabel(selectedMaintenance.status)}
                        </span>
                      </p>
                    </div>

                    <div style="display:flex; gap:8px;">
                      <button
                        type="button"
                        class="secondary-button"
                        id="edit-maintenance-button"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        class="danger-button"
                        id="remove-maintenance-button"
                      >
                        Remove
                      </button>

                      <button
                        type="button"
                        class="close-button"
                        id="close-maintenance-detail"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  ${
                    selectedMaintenance.description
                      ? `
                        <p class="description">
                          ${this.escapeHtml(
                            selectedMaintenance.description
                          )}
                        </p>
                      `
                      : ""
                  }

                  <div class="detail-grid">
                    <div class="detail-item">
                      <p class="detail-label">Asset</p>
                      <p class="detail-value">
                        ${this.escapeHtml(
                          selectedMaintenance.asset ||
                          "Not assigned"
                        )}
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">Area</p>
                      <p class="detail-value">
                        ${this.escapeHtml(
                          selectedMaintenance.area ||
                          "Not assigned"
                        )}
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">Assignee</p>
                      <p class="detail-value">
                        ${this.escapeHtml(
                          selectedMaintenance.assignee ||
                          "Not assigned"
                        )}
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">Schedule</p>
                      <p class="detail-value">
                        ${this.escapeHtml(
                          this.scheduleLabel(
                            selectedMaintenance.schedule_type
                          )
                        )}
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">Repeat</p>
                      <p class="detail-value">
                        ${
                          selectedMaintenance.interval_days
                            ? `Every ${selectedMaintenance.interval_days} days`
                            : "Does not repeat"
                        }
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">Due</p>
                      <p class="detail-value">
                        ${
                          selectedMaintenance.due_at
                            ? this.formatDate(
                                selectedMaintenance.due_at
                              )
                            : "No due date"
                        }
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">
                        Last completed
                      </p>
                      <p class="detail-value">
                        ${
                          selectedMaintenance.last_completed_at
                            ? this.formatDate(
                                selectedMaintenance.last_completed_at
                              )
                            : "Never"
                        }
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">
                        Total services
                      </p>
                      <p class="detail-value">
                        ${
                          selectedMaintenance.completion_history
                            ?.length || 0
                        }
                      </p>
                    </div>
                  </div>

                  <h3 class="history-heading">
                    Service History
                  </h3>

                  <div class="history-list">
                    ${
                      selectedMaintenance.completion_history?.length
                        ? [
                            ...selectedMaintenance.completion_history,
                          ]
                            .reverse()
                            .map(
                              (completion) => `
                                <div class="history-item">
                                  <p>
                                    ✓ Completed
                                    ${this.formatDate(
                                      completion.completed_at
                                    )}
                                  </p>

                                  <p class="history-meta">
                                    ${[
                                      completion.completed_by
                                        ? `By ${completion.completed_by}`
                                        : null,
                                      completion.note || null,
                                    ]
                                      .filter(Boolean)
                                      .map((value) =>
                                        this.escapeHtml(value)
                                      )
                                      .join(" · ") ||
                                    "No additional details"}
                                  </p>
                                </div>
                              `
                            )
                            .join("")
                        : `
                          <div class="empty">
                            No service history recorded yet.
                          </div>
                        `
                    }
                  </div>
                </div>
              </div>
            `
            : ""
        }

        ${
          this._confirmRemoveMaintenanceId &&
          selectedMaintenance
            ? `
              <div class="modal-backdrop">
                <div class="modal">
                  <div class="modal-header">
                    <div>
                      <h2>Remove Maintenance Item?</h2>
                      <p>This action cannot be undone.</p>
                    </div>
                  </div>

                  <div class="confirmation-warning">
                    <p>
                      <strong>
                        ${this.escapeHtml(selectedMaintenance.name)}
                      </strong>
                    </p>

                    <p>
                      This will permanently remove the maintenance item
                      ${
                        selectedMaintenance.completion_history?.length
                          ? `and its ${selectedMaintenance.completion_history.length} recorded service entr${
                              selectedMaintenance.completion_history.length === 1
                                ? "y"
                                : "ies"
                            }.`
                          : "from HomeBase."
                      }
                    </p>
                  </div>

                  <div class="form-actions">
                    <button
                      type="button"
                      class="secondary-button"
                      id="cancel-remove-maintenance"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      class="danger-button danger-button-solid"
                      id="confirm-remove-maintenance"
                    >
                      Remove Maintenance
                    </button>
                  </div>
                </div>
              </div>
            `
            : ""
        }

        ${
          this._showAddMaintenance
            ? `
              <div class="modal-backdrop">
                <div class="modal">
                  <div class="modal-header">
                    <div>
                      <h2>
                        ${
                          this._editingMaintenanceId
                            ? "Edit Maintenance"
                            : "Add Maintenance"
                        }
                      </h2>
                      <p>
                        ${
                          this._editingMaintenanceId
                            ? "Update this HomeBase maintenance item."
                            : "Create a new HomeBase maintenance item."
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      class="close-button"
                      id="close-add-maintenance"
                    >
                      Close
                    </button>
                  </div>

                  <form id="add-maintenance-form">
                    <div class="form-grid">
                      <div class="field field-full">
                        <label for="maintenance-name">
                          Name
                        </label>
                        <input
                          id="maintenance-name"
                          name="name"
                          type="text"
                          required
                          autofocus
                          placeholder="e.g. Replace HVAC Filter"
                          value="${this.escapeHtml(this._maintenanceDraft.name)}"
                        />
                      </div>

                      <div class="field field-full">
                        <label for="maintenance-description">
                          Description
                        </label>
                        <textarea
                          id="maintenance-description"
                          name="description"
                          placeholder="Optional maintenance details"
                        >${this.escapeHtml(this._maintenanceDraft.description)}</textarea>
                      </div>

                      <div class="field">
                        <label for="maintenance-area">
                          Area
                        </label>
                        <input
                          id="maintenance-area"
                          name="area"
                          type="text"
                          placeholder="e.g. Utility Room"
                          value="${this.escapeHtml(this._maintenanceDraft.area)}"
                        />
                      </div>

                      <div class="field">
                        <label for="maintenance-asset">
                          Asset
                        </label>
                        <input
                          id="maintenance-asset"
                          name="asset"
                          type="text"
                          placeholder="e.g. Main HVAC"
                          value="${this.escapeHtml(this._maintenanceDraft.asset)}"
                        />
                      </div>

                      <div class="field">
                        <label for="maintenance-assignee">
                          Assignee
                        </label>
                        <input
                          id="maintenance-assignee"
                          name="assignee"
                          type="text"
                          placeholder="e.g. Tom"
                          value="${this.escapeHtml(this._maintenanceDraft.assignee)}"
                        />
                      </div>

                      <div class="field">
                        <label for="maintenance-schedule">
                          Schedule type
                        </label>
                        <select
                          id="maintenance-schedule"
                          name="schedule_type"
                        >
                          <option
                            value="one_time"
                            ${this._maintenanceDraft.schedule_type === "one_time" ? "selected" : ""}
                          >
                            One time
                          </option>
                          <option
                            value="fixed"
                            ${this._maintenanceDraft.schedule_type === "fixed" ? "selected" : ""}
                          >
                            Fixed cycle
                          </option>
                          <option
                            value="relative"
                            ${this._maintenanceDraft.schedule_type === "relative" ? "selected" : ""}
                          >
                            After completion
                          </option>
                        </select>
                      </div>

                      <div class="field">
                        <label for="maintenance-due">
                          ${
                            this._editingMaintenanceId
                              ? "Due"
                              : "First due"
                          }
                        </label>
                        <input
                          id="maintenance-due"
                          name="due_at"
                          type="datetime-local"
                          value="${this.escapeHtml(this._maintenanceDraft.due_at)}"
                        />
                      </div>

                      <div
                        class="field field-full hidden"
                        id="maintenance-repeat-field"
                      >
                        <label for="maintenance-interval">
                          Repeat every
                        </label>

                        <input
                          id="maintenance-interval"
                          name="interval_days"
                          type="number"
                          min="1"
                          max="3650"
                          step="1"
                          placeholder="90"
                          value="${this.escapeHtml(this._maintenanceDraft.interval_days)}"
                        />

                        <p class="form-help">
                          Number of days between service occurrences.
                        </p>
                      </div>
                    </div>

                    <div class="form-actions">
                      <button
                        type="button"
                        class="secondary-button"
                        id="cancel-add-maintenance"
                      >
                        Cancel
                      </button>

                      <button type="submit">
                        ${
                          this._editingMaintenanceId
                            ? "Save Changes"
                            : "Add Maintenance"
                        }
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            `
            : ""
        }
      </main>
    `;

    this.shadowRoot
      .querySelector("#module-chores")
      ?.addEventListener("click", () =>
        this.switchModule("chores")
      );

    this.shadowRoot
      .querySelector("#maintenance-refresh-button")
      ?.addEventListener("click", () =>
        this.loadMaintenance()
      );

    this.shadowRoot
      .querySelector("#add-maintenance-button")
      ?.addEventListener("click", () => {
        this._editingMaintenanceId = null;
        this.resetMaintenanceDraft();
        this._showAddMaintenance = true;
        this.render();
      });

    const closeAddMaintenance = () => {
      this._showAddMaintenance = false;
      this._editingMaintenanceId = null;
      this._error = null;
      this.render();
    };

    this.shadowRoot
      .querySelector("#close-add-maintenance")
      ?.addEventListener(
        "click",
        closeAddMaintenance
      );

    this.shadowRoot
      .querySelector("#cancel-add-maintenance")
      ?.addEventListener(
        "click",
        closeAddMaintenance
      );

    const maintenanceScheduleSelect =
      this.shadowRoot.querySelector(
        "#maintenance-schedule"
      );

    const maintenanceRepeatField =
      this.shadowRoot.querySelector(
        "#maintenance-repeat-field"
      );

    const updateMaintenanceRepeatVisibility =
      () => {
        if (
          !maintenanceScheduleSelect ||
          !maintenanceRepeatField
        ) {
          return;
        }

        maintenanceRepeatField.classList.toggle(
          "hidden",
          maintenanceScheduleSelect.value ===
            "one_time"
        );
      };

    maintenanceScheduleSelect?.addEventListener(
      "change",
      updateMaintenanceRepeatVisibility
    );

    updateMaintenanceRepeatVisibility();

    this.shadowRoot
      .querySelector("#add-maintenance-form")
      ?.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();

          if (this._editingMaintenanceId) {
            await this.updateMaintenance(
              event.currentTarget
            );
          } else {
            await this.addMaintenance(
              event.currentTarget
            );
          }
        }
      );

    this.shadowRoot
      .querySelectorAll(
        ".maintenance-complete-button"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          (event) => {
            event.stopPropagation();
            this.completeMaintenance(
              button.dataset.maintenanceId
            );
          }
        );
      });

    this.shadowRoot
      .querySelectorAll(
        ".maintenance-pause-button"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          (event) => {
            event.stopPropagation();
            this.setMaintenancePaused(
              button.dataset.maintenanceId,
              button.dataset.paused === "true"
            );
          }
        );
      });

    this.shadowRoot
      .querySelectorAll(".maintenance-open")
      .forEach((card) => {
        card.addEventListener("click", () => {
          this._selectedMaintenanceId =
            card.dataset.maintenanceId;
          this.render();
        });
      });

    this.shadowRoot
      .querySelector("#edit-maintenance-button")
      ?.addEventListener("click", () => {
        if (selectedMaintenance) {
          this.openEditMaintenance(
            selectedMaintenance
          );
        }
      });

    this.shadowRoot
      .querySelector("#remove-maintenance-button")
      ?.addEventListener("click", () => {
        if (selectedMaintenance) {
          this._confirmRemoveMaintenanceId =
            selectedMaintenance.maintenance_id;
          this.render();
        }
      });

    this.shadowRoot
      .querySelector(
        "#cancel-remove-maintenance"
      )
      ?.addEventListener("click", () => {
        this._confirmRemoveMaintenanceId = null;
        this.render();
      });

    this.shadowRoot
      .querySelector(
        "#confirm-remove-maintenance"
      )
      ?.addEventListener(
        "click",
        async () => {
          if (
            this._confirmRemoveMaintenanceId
          ) {
            await this.removeMaintenance(
              this._confirmRemoveMaintenanceId
            );
          }
        }
      );

    this.shadowRoot
      .querySelector(
        "#close-maintenance-detail"
      )
      ?.addEventListener("click", () => {
        this._selectedMaintenanceId = null;
        this.render();
      });
  }

  escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  render() {
    if (!this.shadowRoot) {
      return;
    }

    if (this._activeModule === "maintenance") {
      this.renderMaintenance();
      return;
    }

    const active = this._chores.filter(
      (chore) =>
        chore.status !== "completed" &&
        chore.status !== "paused"
    );

    const completed = this._chores.filter(
      (chore) => chore.status === "completed"
    );


    const paused = this._chores.filter(
      (chore) => chore.status === "paused"
    );


    const selectedChore = this._selectedChoreId
      ? this._chores.find(
          (chore) =>
            chore.chore_id === this._selectedChoreId
        )
      : null;

    const dueToday = this._chores.filter(
      (chore) => chore.status === "due_today"
    ).length;

    const overdue = this._chores.filter(
      (chore) => chore.status === "overdue"
    ).length;


    const recentActivity = this._chores
      .filter((chore) => chore.last_completed_at)
      .map((chore) => {
        const history = chore.completion_history || [];

        return {
          chore,
          completion:
            history[history.length - 1] || {
              completed_at: chore.last_completed_at,
              completed_by: null,
              note: "",
            },
        };
      })
      .sort(
        (a, b) =>
          new Date(b.completion.completed_at) -
          new Date(a.completion.completed_at)
      )
      .slice(0, 5);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: 100%;
          box-sizing: border-box;
          background: var(--primary-background-color);
          color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
        }

        * {
          box-sizing: border-box;
        }

        .page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 28px 24px 60px;
        }

        .module-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          padding: 5px;
          width: fit-content;
          border-radius: 14px;
          background: var(--secondary-background-color);
        }

        .module-tab {
          padding: 9px 15px;
          border: 0;
          border-radius: 10px;
          cursor: pointer;
          font: inherit;
          font-weight: 700;
          color: var(--secondary-text-color);
          background: transparent;
        }

        .module-tab-active {
          color: var(--text-primary-color);
          background: var(--primary-color);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 28px;
        }

        .eyebrow {
          margin: 0 0 4px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--secondary-text-color);
        }

        h1 {
          margin: 0;
          font-size: 32px;
          line-height: 1.2;
        }

        .subtitle {
          margin: 7px 0 0;
          color: var(--secondary-text-color);
        }

        button {
          border: 0;
          border-radius: 12px;
          padding: 11px 16px;
          cursor: pointer;
          font: inherit;
          font-weight: 600;
          color: var(--text-primary-color);
          background: var(--primary-color);
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .secondary-button {
          color: var(--primary-text-color);
          background: var(--card-background-color);
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 30px;
        }

        .stat {
          padding: 18px;
          border-radius: 16px;
          background: var(--card-background-color);
          box-shadow: var(--ha-card-box-shadow);
        }

        .stat-value {
          display: block;
          font-size: 28px;
          font-weight: 700;
        }

        .stat-label {
          color: var(--secondary-text-color);
          font-size: 14px;
        }

        section {
          margin-top: 30px;
        }

        .section-title {
          margin: 0 0 12px;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--secondary-text-color);
        }

        .chore-list {
          display: grid;
          gap: 12px;
        }


        .activity-list {
          display: grid;
          gap: 10px;
        }

        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          padding: 15px 18px;
          border-radius: 14px;
          background: var(--card-background-color);
          box-shadow: var(--ha-card-box-shadow);
        }

        .activity-check {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          font-size: 16px;
          font-weight: 700;
          color: var(--success-color, var(--primary-color));
          background: var(--secondary-background-color);
        }

        .activity-content {
          min-width: 0;
          flex: 1;
        }

        .activity-title {
          margin: 0;
          font-weight: 700;
        }

        .activity-meta {
          margin: 5px 0 0;
          color: var(--secondary-text-color);
          font-size: 13px;
        }

        .chore {
          padding: 18px 20px;
          border-radius: 16px;
          background: var(--card-background-color);
          box-shadow: var(--ha-card-box-shadow);
        }

        .chore-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .chore-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }


        .chore-open {
          cursor: pointer;
          transition:
            transform 120ms ease,
            box-shadow 120ms ease;
        }

        .chore-open:hover {
          transform: translateY(-1px);
        }

        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 20px;
        }

        .detail-item {
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--secondary-background-color);
        }

        .detail-item-full {
          grid-column: 1 / -1;
        }

        .detail-label {
          margin: 0 0 5px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--secondary-text-color);
        }

        .detail-value {
          margin: 0;
          font-size: 14px;
          color: var(--primary-text-color);
        }

        .history-heading {
          margin: 24px 0 12px;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--secondary-text-color);
        }

        .history-list {
          display: grid;
          gap: 10px;
        }

        .history-item {
          padding: 13px 15px;
          border-radius: 12px;
          background: var(--secondary-background-color);
        }

        .history-item p {
          margin: 0;
        }

        .history-meta {
          margin-top: 5px !important;
          font-size: 12px;
          color: var(--secondary-text-color);
        }

        .complete-button {
          padding: 7px 11px;
          border-radius: 10px;
          font-size: 13px;
        }

        .pause-button {
          padding: 7px 11px;
          border-radius: 10px;
          font-size: 13px;
          color: var(--primary-text-color);
          background: var(--secondary-background-color);
        }

        h3 {
          margin: 0;
          font-size: 18px;
        }

        .description {
          margin: 8px 0 0;
          color: var(--primary-text-color);
        }

        .meta {
          margin: 9px 0 0;
          color: var(--secondary-text-color);
          font-size: 14px;
        }

        .last-completed {
          margin: 7px 0 0;
          color: var(--secondary-text-color);
          font-size: 13px;
        }

        .notice {
          margin-bottom: 20px;
          padding: 13px 16px;
          border-radius: 12px;
          background: var(--card-background-color);
          border-left: 4px solid var(--success-color, var(--primary-color));
        }

        .complete-button:disabled {
          opacity: 0.65;
          cursor: default;
        }


        .danger-button {
          padding: 7px 11px;
          border-radius: 10px;
          border: 1px solid var(--error-color);
          background: transparent;
          color: var(--error-color);
        }

        .danger-button:hover {
          background: color-mix(
            in srgb,
            var(--error-color) 12%,
            transparent
          );
        }

        .danger-button-solid {
          background: var(--error-color);
          color: white;
        }

        .danger-button-solid:hover {
          background: var(--error-color);
          opacity: 0.9;
        }

        .confirmation-warning {
          margin: 18px 0;
          padding: 16px;
          border-radius: 12px;
          background: var(--secondary-background-color);
        }

        .confirmation-warning p {
          margin: 0;
        }

        .confirmation-warning p + p {
          margin-top: 8px;
          color: var(--secondary-text-color);
          font-size: 13px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.62);
        }

        .modal {
          width: min(640px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          padding: 24px;
          border-radius: 20px;
          background: var(--card-background-color);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 24px;
        }

        .modal-header p {
          margin: 6px 0 0;
          color: var(--secondary-text-color);
        }

        .close-button {
          padding: 7px 11px;
          color: var(--secondary-text-color);
          background: var(--secondary-background-color);
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field-full {
          grid-column: 1 / -1;
        }

        label {
          font-size: 13px;
          font-weight: 700;
          color: var(--secondary-text-color);
        }

        input,
        textarea,
        select {
          width: 100%;
          border: 1px solid var(--divider-color);
          border-radius: 11px;
          padding: 11px 12px;
          outline: none;
          font: inherit;
          color: var(--primary-text-color);
          background: var(--primary-background-color);
        }

        textarea {
          min-height: 90px;
          resize: vertical;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: var(--primary-color);
        }

        .form-help {
          margin: 0;
          font-size: 12px;
          color: var(--secondary-text-color);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }

        .hidden {
          display: none;
        }

        .status {
          flex: 0 0 auto;
          padding: 5px 9px;
          border-radius: 999px;
          background: var(--secondary-background-color);
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 700;
        }

        .status-overdue {
          color: var(--error-color);
        }

        .empty,
        .loading,
        .error {
          padding: 28px;
          text-align: center;
          border-radius: 16px;
          color: var(--secondary-text-color);
          background: var(--card-background-color);
        }

        .error {
          color: var(--error-color);
        }

        @media (max-width: 700px) {
          .page {
            padding: 20px 14px 50px;
          }

          .header {
            flex-direction: column;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .chore-title-row {
            align-items: flex-start;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }


          .detail-grid {
            grid-template-columns: 1fr;
          }

          .detail-item-full {
            grid-column: auto;
          }

          .field-full {
            grid-column: auto;
          }

          .module-tabs {
            width: 100%;
          }

          .module-tab {
            flex: 1;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }
        }
      </style>

      <main class="page">
        ${this.renderModuleTabs("chores")}

        <header class="header">
          <div>
            <p class="eyebrow">HomeBase</p>
            <h1>Chores</h1>
            <p class="subtitle">
              Keep household chores organized and on schedule.
            </p>
          </div>

          <div class="header-actions">
            <button class="secondary-button" id="refresh-button">
              Refresh
            </button>

            <button id="add-chore-button">
              + Add Chore
            </button>
          </div>
        </header>

        ${
          this._notice
            ? `<div class="notice">${this.escapeHtml(this._notice)}</div>`
            : ""
        }

        <div class="stats">
          <div class="stat">
            <span class="stat-value">${active.length}</span>
            <span class="stat-label">Active</span>
          </div>

          <div class="stat">
            <span class="stat-value">${dueToday}</span>
            <span class="stat-label">Due today</span>
          </div>

          <div class="stat">
            <span class="stat-value">${overdue}</span>
            <span class="stat-label">Overdue</span>
          </div>
        </div>

        ${
          this._loading
            ? `<div class="loading">Loading HomeBase chores…</div>`
            : this._error
              ? `<div class="error">${this._error}</div>`
              : `
                <section>
                  <h2 class="section-title">Active</h2>

                  <div class="chore-list">
                    ${
                      active.length
                        ? active
                            .map((chore) =>
                              this.renderChore(chore)
                            )
                            .join("")
                        : `<div class="empty">No active chores.</div>`
                    }
                  </div>
                </section>

                ${
                  paused.length
                    ? `
                      <section>
                        <h2 class="section-title">Paused</h2>

                        <div class="chore-list">
                          ${paused
                            .map((chore) =>
                              this.renderChore(chore)
                            )
                            .join("")}
                        </div>
                      </section>
                    `
                    : ""
                }

                ${
                  recentActivity.length
                    ? `
                      <section>
                        <h2 class="section-title">
                          Recent Activity
                        </h2>

                        <div class="activity-list">
                          ${recentActivity
                            .map(({ chore, completion }) => {
                              const details = [
                                `Completed ${this.formatDate(
                                  completion.completed_at
                                )}`,
                                completion.completed_by
                                  ? `by ${completion.completed_by}`
                                  : null,
                                chore.status !== "completed" &&
                                chore.due_at
                                  ? `Next due ${this.formatDate(
                                      chore.due_at
                                    )}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ");

                              return `
                                <div class="activity-item">
                                  <div class="activity-check">✓</div>

                                  <div class="activity-content">
                                    <p class="activity-title">
                                      ${this.escapeHtml(chore.name)}
                                    </p>

                                    <p class="activity-meta">
                                      ${this.escapeHtml(details)}
                                    </p>
                                  </div>
                                </div>
                              `;
                            })
                            .join("")}
                        </div>
                      </section>
                    `
                    : ""
                }

                <section>
                  <h2 class="section-title">Completed</h2>

                  <div class="chore-list">
                    ${
                      completed.length
                        ? completed
                            .map((chore) =>
                              this.renderChore(chore)
                            )
                            .join("")
                        : `<div class="empty">No completed chores yet.</div>`
                    }
                  </div>
                </section>
              `
        }
        ${
          selectedChore &&
          !this._showAddChore &&
          !this._confirmRemoveChoreId
            ? `
              <div class="modal-backdrop">
                <div class="modal">
                  <div class="modal-header">
                    <div>
                      <h2>
                        ${this.escapeHtml(selectedChore.name)}
                      </h2>

                      <p>
                        <span
                          class="status status-${selectedChore.status}"
                        >
                          ${this.statusLabel(selectedChore.status)}
                        </span>
                      </p>
                    </div>

                    <div style="display:flex; gap:8px;">
                      <button
                        type="button"
                        class="secondary-button"
                        id="edit-chore-button"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        class="danger-button"
                        id="remove-chore-button"
                      >
                        Remove
                      </button>

                      <button
                        type="button"
                        class="close-button"
                        id="close-chore-detail"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  ${
                    selectedChore.description
                      ? `
                        <p class="description">
                          ${this.escapeHtml(
                            selectedChore.description
                          )}
                        </p>
                      `
                      : ""
                  }

                  <div class="detail-grid">
                    <div class="detail-item">
                      <p class="detail-label">Area</p>
                      <p class="detail-value">
                        ${this.escapeHtml(
                          selectedChore.area || "Not assigned"
                        )}
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">Assignee</p>
                      <p class="detail-value">
                        ${this.escapeHtml(
                          selectedChore.assignee || "Not assigned"
                        )}
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">Schedule</p>
                      <p class="detail-value">
                        ${this.escapeHtml(
                          this.scheduleLabel(
                            selectedChore.schedule_type
                          )
                        )}
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">Repeat</p>
                      <p class="detail-value">
                        ${
                          selectedChore.interval_days
                            ? `Every ${selectedChore.interval_days} days`
                            : "Does not repeat"
                        }
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">Due</p>
                      <p class="detail-value">
                        ${
                          selectedChore.due_at
                            ? this.formatDate(
                                selectedChore.due_at
                              )
                            : "No due date"
                        }
                      </p>
                    </div>

                    <div class="detail-item">
                      <p class="detail-label">
                        Last completed
                      </p>
                      <p class="detail-value">
                        ${
                          selectedChore.last_completed_at
                            ? this.formatDate(
                                selectedChore.last_completed_at
                              )
                            : "Never"
                        }
                      </p>
                    </div>

                    <div class="detail-item detail-item-full">
                      <p class="detail-label">
                        Total completions
                      </p>
                      <p class="detail-value">
                        ${
                          selectedChore.completion_history
                            ?.length || 0
                        }
                      </p>
                    </div>
                  </div>

                  <h3 class="history-heading">
                    Completion History
                  </h3>

                  <div class="history-list">
                    ${
                      selectedChore.completion_history?.length
                        ? [
                            ...selectedChore.completion_history,
                          ]
                            .reverse()
                            .map(
                              (completion) => `
                                <div class="history-item">
                                  <p>
                                    ✓ Completed
                                    ${this.formatDate(
                                      completion.completed_at
                                    )}
                                  </p>

                                  <p class="history-meta">
                                    ${[
                                      completion.completed_by
                                        ? `By ${completion.completed_by}`
                                        : null,
                                      completion.note || null,
                                    ]
                                      .filter(Boolean)
                                      .map((value) =>
                                        this.escapeHtml(value)
                                      )
                                      .join(" · ") ||
                                    "No additional details"}
                                  </p>
                                </div>
                              `
                            )
                            .join("")
                        : `
                          <div class="empty">
                            No completions recorded yet.
                          </div>
                        `
                    }
                  </div>
                </div>
              </div>
            `
            : ""
        }

        ${
          this._confirmRemoveChoreId && selectedChore
            ? `
              <div class="modal-backdrop">
                <div class="modal">
                  <div class="modal-header">
                    <div>
                      <h2>Remove Chore?</h2>
                      <p>
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>

                  <div class="confirmation-warning">
                    <p>
                      <strong>
                        ${this.escapeHtml(selectedChore.name)}
                      </strong>
                    </p>

                    <p>
                      This will permanently remove the chore
                      ${
                        selectedChore.completion_history?.length
                          ? `and its ${selectedChore.completion_history.length} recorded completion${
                              selectedChore.completion_history.length === 1
                                ? ""
                                : "s"
                            }.`
                          : "from HomeBase."
                      }
                    </p>
                  </div>

                  <div class="form-actions">
                    <button
                      type="button"
                      class="secondary-button"
                      id="cancel-remove-chore"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      class="danger-button danger-button-solid"
                      id="confirm-remove-chore"
                    >
                      Remove Chore
                    </button>
                  </div>
                </div>
              </div>
            `
            : ""
        }

        ${
          this._showAddChore
            ? `
              <div class="modal-backdrop">
                <div class="modal">
                  <div class="modal-header">
                    <div>
                      <h2>
                        ${
                          this._editingChoreId
                            ? "Edit Chore"
                            : "Add Chore"
                        }
                      </h2>
                      <p>
                        ${
                          this._editingChoreId
                            ? "Update this HomeBase chore."
                            : "Create a new HomeBase chore."
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      class="close-button"
                      id="close-add-chore"
                    >
                      Close
                    </button>
                  </div>

                  <form id="add-chore-form">
                    <div class="form-grid">
                      <div class="field field-full">
                        <label for="chore-name">Name</label>
                        <input
                          id="chore-name"
                          name="name"
                          type="text"
                          required
                          autofocus
                          placeholder="e.g. Clean Bathroom"
                          value="${this.escapeHtml(this._addChoreDraft.name)}"
                        />
                      </div>

                      <div class="field field-full">
                        <label for="chore-description">
                          Description
                        </label>
                        <textarea
                          id="chore-description"
                          name="description"
                          placeholder="Optional details"
                        >${this.escapeHtml(this._addChoreDraft.description)}</textarea>
                      </div>

                      <div class="field">
                        <label for="chore-area">Area</label>
                        <input
                          id="chore-area"
                          name="area"
                          type="text"
                          placeholder="e.g. Master Bedroom"
                          value="${this.escapeHtml(this._addChoreDraft.area)}"
                        />
                      </div>

                      <div class="field">
                        <label for="chore-assignee">
                          Assignee
                        </label>
                        <input
                          id="chore-assignee"
                          name="assignee"
                          type="text"
                          placeholder="e.g. Tom"
                          value="${this.escapeHtml(this._addChoreDraft.assignee)}"
                        />
                      </div>

                      <div class="field">
                        <label for="chore-schedule">
                          Schedule type
                        </label>
                        <select
                          id="chore-schedule"
                          name="schedule_type"
                        >
                          <option
                            value="one_time"
                            ${this._addChoreDraft.schedule_type === "one_time" ? "selected" : ""}
                          >
                            One time
                          </option>
                          <option
                            value="fixed"
                            ${this._addChoreDraft.schedule_type === "fixed" ? "selected" : ""}
                          >
                            Fixed cycle
                          </option>
                          <option
                            value="relative"
                            ${this._addChoreDraft.schedule_type === "relative" ? "selected" : ""}
                          >
                            After completion
                          </option>
                        </select>
                      </div>

                      <div class="field">
                        <label for="chore-due">
                          ${
                            this._editingChoreId
                              ? "Due"
                              : "First due"
                          }
                        </label>
                        <input
                          id="chore-due"
                          name="due_at"
                          type="datetime-local"
                          value="${this.escapeHtml(this._addChoreDraft.due_at)}"
                        />
                      </div>

                      <div
                        class="field field-full hidden"
                        id="repeat-field"
                      >
                        <label for="chore-interval">
                          Repeat every
                        </label>

                        <input
                          id="chore-interval"
                          name="interval_days"
                          type="number"
                          min="1"
                          max="3650"
                          step="1"
                          placeholder="7"
                          value="${this.escapeHtml(this._addChoreDraft.interval_days)}"
                        />

                        <p class="form-help">
                          Number of days between occurrences.
                        </p>
                      </div>
                    </div>

                    <div class="form-actions">
                      <button
                        type="button"
                        class="secondary-button"
                        id="cancel-add-chore"
                      >
                        Cancel
                      </button>

                      <button type="submit">
                        ${
                          this._editingChoreId
                            ? "Save Changes"
                            : "Add Chore"
                        }
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            `
            : ""
        }
      </main>
    `;

    this.shadowRoot
      .querySelector("#module-maintenance")
      ?.addEventListener("click", () =>
        this.switchModule("maintenance")
      );

    this.shadowRoot
      .querySelector("#refresh-button")
      ?.addEventListener("click", () => this.loadChores());


    this.shadowRoot
      .querySelector("#add-chore-button")
      ?.addEventListener("click", () => {
        this._editingChoreId = null;
        this._addChoreDraft = {
          name: "",
          description: "",
          area: "",
          assignee: "",
          schedule_type: "one_time",
          due_at: "",
          interval_days: "",
        };
        this._showAddChore = true;
        this.render();
      });


    const closeAddChore = () => {
      this._showAddChore = false;
      this._editingChoreId = null;
      this._error = null;
      this.render();
    };

    this.shadowRoot
      .querySelector("#close-add-chore")
      ?.addEventListener("click", closeAddChore);

    this.shadowRoot
      .querySelector("#cancel-add-chore")
      ?.addEventListener("click", closeAddChore);

    const scheduleSelect =
      this.shadowRoot.querySelector("#chore-schedule");

    const repeatField =
      this.shadowRoot.querySelector("#repeat-field");

    const updateRepeatVisibility = () => {
      if (!scheduleSelect || !repeatField) {
        return;
      }

      repeatField.classList.toggle(
        "hidden",
        scheduleSelect.value === "one_time"
      );
    };

    scheduleSelect?.addEventListener(
      "change",
      updateRepeatVisibility
    );

    updateRepeatVisibility();

    this.shadowRoot
      .querySelector("#add-chore-form")
      ?.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (this._editingChoreId) {
          await this.updateChore(event.currentTarget);
        } else {
          await this.addChore(event.currentTarget);
        }
      });


    this.shadowRoot
      .querySelectorAll(".complete-button")
      .forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          this.completeChore(button.dataset.choreId);
        });
      });


    this.shadowRoot
      .querySelectorAll(".pause-button")
      .forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          this.setChorePaused(
            button.dataset.choreId,
            button.dataset.paused === "true"
          );
        });
      });


    this.shadowRoot
      .querySelectorAll(".chore-open")
      .forEach((card) => {
        card.addEventListener("click", () => {
          this._selectedChoreId = card.dataset.choreId;
          this.render();
        });
      });

    this.shadowRoot
      .querySelector("#edit-chore-button")
      ?.addEventListener("click", () => {
        if (selectedChore) {
          this.openEditChore(selectedChore);
        }
      });


    this.shadowRoot
      .querySelector("#remove-chore-button")
      ?.addEventListener("click", () => {
        if (selectedChore) {
          this._confirmRemoveChoreId =
            selectedChore.chore_id;
          this.render();
        }
      });

    this.shadowRoot
      .querySelector("#cancel-remove-chore")
      ?.addEventListener("click", () => {
        this._confirmRemoveChoreId = null;
        this.render();
      });

    this.shadowRoot
      .querySelector("#confirm-remove-chore")
      ?.addEventListener("click", async () => {
        if (this._confirmRemoveChoreId) {
          await this.removeChore(
            this._confirmRemoveChoreId
          );
        }
      });

    this.shadowRoot
      .querySelector("#close-chore-detail")
      ?.addEventListener("click", () => {
        this._selectedChoreId = null;
        this.render();
      });
  }
}

if (!customElements.get("homebase-panel")) {
  customElements.define("homebase-panel", HomeBasePanel);
}
