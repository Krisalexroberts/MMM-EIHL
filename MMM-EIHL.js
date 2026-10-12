Module.register("MMM-EIHL", {
  defaults: {width: "310px", updateInterval: 600000, rotateInterval: 20000, maxScores: 4, favoriteTeam: "", season: "", playoffWindowDays: 14},
  getStyles() { return ["MMM-EIHL.css"]; },
  start() {
    this.eihlData = null; this.page = 0;
    this.sendSocketNotification("EIHL_START", {...this.config, instanceId: this.identifier});
    this.timer = setInterval(() => { this.page++; this.updateDom(300); }, Math.max(5000, this.config.rotateInterval));
  },
  suspend() { clearInterval(this.timer); },
  resume() { this.suspend(); this.timer = setInterval(() => { this.page++; this.updateDom(300); }, Math.max(5000, this.config.rotateInterval)); },
  socketNotificationReceived(name, data) {
    if (name !== "EIHL_DATA" || data.instanceId !== this.identifier) return;
    this.eihlData = data; this.updateDom(300);
  },
  getDom() {
    const el = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
    const root = el("div", "", "eihl"); root.style.width = this.config.width;
    const competitions = this.eihlData?.competitions || [];
    const today = new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
    const now = Date.parse(today);
    const pages = [];
    for (const key of ["league", "cup"]) {
      const c = competitions.find(c => c.key === key);
      if (!c) continue;
      pages.push({...c, games: c.games.filter(g => key !== "league" || !g.playoff)});
      if (key === "league") {
        const playoffGames = c.games.filter(g => g.playoff);
        const window = this.config.playoffWindowDays * 86400000;
        if (playoffGames.some(g => Math.abs(Date.parse(g.date) - now) <= window)) pages.push({...c, title: "Playoffs", groups: [], games: playoffGames});
      }
    }
    root.appendChild(el("div", "EIHL", "eihl-brand"));
    if (!pages.length) { root.appendChild(el("div", this.eihlData ? "EIHL unavailable · retrying" : "Loading EIHL…", "eihl-empty")); return root; }
    const c = pages[this.page % pages.length];
    root.appendChild(el("div", `${c.title} · ${this.eihlData.season || ""}`, "eihl-heading"));
    const favorite = team => this.config.favoriteTeam && team.toLowerCase().includes(this.config.favoriteTeam.toLowerCase());
    root.appendChild(el("div", c.title === "Playoffs" ? "Playoff games" : "Recent scores", "eihl-label"));
    const recent = c.games.filter(g => g.played && g.date <= today).sort((a,b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).slice(0, this.config.maxScores);
    const upcoming = c.title === "Playoffs" ? c.games.filter(g => !g.played && g.date >= today).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, this.config.maxScores) : [];
    for (const g of [...recent, ...upcoming]) {
      const row = el("div", "", "eihl-game" + (favorite(g.home) || favorite(g.away) ? " eihl-favorite" : ""));
      const date = new Date(g.date + "T12:00:00Z").toLocaleDateString("en-GB", {day:"numeric", month:"short", timeZone:"Europe/London"});
      row.append(el("div", `${date}${c.title === "Playoffs" ? " · " + g.stage : ""}`, "eihl-date"));
      const line = el("div", "", "eihl-match");
      line.append(el("span", g.home.split(" ")[0]), el("strong", g.played ? g.score.replace(":", "–") : g.time), el("span", g.away.split(" ")[0]));
      row.append(line); root.append(row);
    }
    if (!recent.length && !upcoming.length) root.appendChild(el("div", "No results yet", "eihl-empty"));
    for (const group of c.groups) {
      root.appendChild(el("div", group.name ? `Group ${group.name}` : "Standings", "eihl-label"));
      const table = el("table", "", "eihl-table");
      const header = el("tr", ""); ["#", "Team", "GP", "Pts"].forEach(t => header.appendChild(el("th", t))); table.append(header);
      for (const t of group.rows) {
        const row = el("tr", "", favorite(t.team) ? "eihl-favorite" : "");
        [t.rank, t.team, t.gp, t.pts].forEach(v => row.appendChild(el("td", String(v)))); table.append(row);
      }
      root.append(table);
    }
    const stale = this.eihlData.errors?.length || Date.now() - c.updated > Math.max(1800000, this.config.updateInterval * 2);
    root.appendChild(el("div", stale ? "Feed unavailable · last saved data" : `Updated ${new Date(c.updated).toLocaleTimeString("en-GB", {hour:"2-digit", minute:"2-digit", timeZone:"Europe/London"})} · ${this.page % pages.length + 1}/${pages.length}`, "eihl-footer"));
    return root;
  }
});
