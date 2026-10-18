Module.register("MMM-EIHL", {
  defaults: {width: "310px", updateInterval: 600000, liveUpdateInterval: 60000, rotateInterval: 20000, maxScores: 4, favoriteTeam: "", season: "", playoffWindowDays: 14},
  getStyles() { return ["MMM-EIHL.css"]; },
  gameLabel(game, competition) {
    const stage = String(game.stage || "").trim();
    const friendly = /friendly|exhibition|pre.?season/i.test(stage);
    const name = game.competition || (friendly ? "Friendly" : competition.title === "Playoffs" || (competition.key === "league" && game.playoff) ? "Play Offs" : competition.title);
    let round = "";
    if (/third.?place|3rd.?place/i.test(stage)) round = "Third-Place Play Off";
    else if (/quarter[\s-]?final/i.test(stage)) round = "Quarter-Final";
    else if (/semi[\s-]?final/i.test(stage)) round = "Semi-Final";
    else if (/\bfinal\b/i.test(stage)) round = "Final";
    else if (/elimination|qualification|qualifier|group|round|leg/i.test(stage)) round = stage;
    return [name, round].filter(Boolean).join(" · ");
  },
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
    const views = [];
    for (const competition of pages) {
      views.push({...competition, scoreView: "recent"});
      const todayGames = competition.games.filter(g => g.date === today).sort((a,b) => Number(b.live) - Number(a.live) || a.time.localeCompare(b.time));
      for (let offset = 0; offset < todayGames.length; offset += this.config.maxScores) {
        views.push({...competition, scoreView: "today", todayGames: todayGames.slice(offset, offset + this.config.maxScores)});
      }
      if (competition.title === "Playoffs") {
        const upcoming = competition.games.filter(g => !g.played && g.date > today).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, this.config.maxScores);
        if (upcoming.length) views.push({...competition, scoreView: "upcoming", todayGames: upcoming});
      }
    }
    const c = views[this.page % views.length];
    root.appendChild(el("div", `${c.title} · ${this.eihlData.season || ""}`, "eihl-heading"));
    const favorite = team => this.config.favoriteTeam && team.toLowerCase().includes(this.config.favoriteTeam.toLowerCase());
    const scoresPanel = el("section", "", "eihl-scores");
    scoresPanel.style.height = (25 + 42 * this.config.maxScores) + "px";
    scoresPanel.appendChild(el("div", c.scoreView === "upcoming" ? "Upcoming playoffs" : c.scoreView === "today" ? (c.todayGames.some(g => g.live) ? "Live scores" : "Today's games") : "Recent scores", "eihl-label"));
    const recent = c.games.filter(g => g.played && !g.live && (g.date < today || g.final)).sort((a,b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).slice(0, this.config.maxScores);
    const shown = c.scoreView !== "recent" ? c.todayGames : recent;
    for (const g of shown) {
      const row = el("div", "", "eihl-game" + (favorite(g.home) || favorite(g.away) ? " eihl-favorite" : ""));
      const date = new Date(g.date + "T12:00:00Z").toLocaleDateString("en-GB", {day:"numeric", month:"short", timeZone:"Europe/London"});
      const status = g.live ? g.status : g.final ? "FT" : g.date === today ? (g.status || g.time) : "";
      const details = [date, this.gameLabel(g, c), status].filter(Boolean).join(" · ");
      const meta = el("div", details, "eihl-date" + (g.live ? " eihl-live" : ""));
      meta.title = details;
      row.append(meta);
      const line = el("div", "", "eihl-match");
      line.append(el("span", g.home.split(" ")[0]), el("strong", (g.played || g.live || g.final) ? g.score.replace(":", "–") : g.time), el("span", g.away.split(" ")[0]));
      row.append(line); scoresPanel.append(row);
    }
    if (!shown.length) scoresPanel.appendChild(el("div", "No results yet", "eihl-empty"));
    root.append(scoresPanel);
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
    const stale = this.eihlData.errors?.length || this.eihlData.liveError || Date.now() - c.updated > Math.max(1800000, this.config.updateInterval * 2);
    root.appendChild(el("div", stale ? "Feed unavailable · last saved data" : `Updated ${new Date(c.scoreView === "today" ? this.eihlData.liveUpdated || c.updated : c.updated).toLocaleTimeString("en-GB", {hour:"2-digit", minute:"2-digit", timeZone:"Europe/London"})} · ${this.page % views.length + 1}/${views.length}`, "eihl-footer"));
    return root;
  }
});
