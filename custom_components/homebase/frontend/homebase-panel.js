class HomeBasePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._hass = null;
    this._loaded = false;
    this._loading = true;
    this._error = null;
    this._chores = [];
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
      <article class="chore">
        <div class="chore-main">
          <div class="chore-title-row">
            <h3>${this.escapeHtml(chore.name)}</h3>
            <span class="status status-${chore.status}">
              ${this.statusLabel(chore.status)}
            </span>
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

    const dueToday = this._chores.filter(
      (chore) => chore.status === "due_today"
    ).length;

    const overdue = this._chores.filter(
      (chore) => chore.status === "overdue"
    ).length;

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

          <button id="refresh-button">Refresh</button>
        </header>

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
      </main>
    `;

    this.shadowRoot
      .querySelector("#refresh-button")
      ?.addEventListener("click", () => this.loadChores());
  }
}

if (!customElements.get("homebase-panel")) {
  customElements.define("homebase-panel", HomeBasePanel);
}
