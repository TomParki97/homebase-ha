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
    this._addChoreDraft = {
      name: "",
      description: "",
      area: "",
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

  escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  render() {
    if (!this.shadowRoot) {
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

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }
        }
      </style>

      <main class="page">
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
          selectedChore && !this._showAddChore
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
