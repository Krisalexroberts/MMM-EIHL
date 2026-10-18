const NodeHelper = require("node_helper");
const provider = require("./provider");
module.exports = NodeHelper.create({
  start() { this.clients = new Map(); },
  socketNotificationReceived(name, config) {
    if (name !== "EIHL_START" || !config.instanceId) return;
    const old = this.clients.get(config.instanceId);
    if (old) { clearInterval(old.timer); clearInterval(old.liveTimer); }
    const client = {config, data: null, busy: false};
    this.clients.set(config.instanceId, client);
    this.refresh(client);
    client.timer = setInterval(() => this.refresh(client), Math.max(60000, Number(config.updateInterval) || 600000));
    client.liveTimer = setInterval(() => this.refreshLive(client), Math.max(30000, Number(config.liveUpdateInterval) || 60000));
  },
  async refreshLive(client) {
    if (client.busy || client.liveBusy || !client.data) return;
    const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/London'}).format(new Date());
    if (!client.data.competitions.some(c => c.games.some(g => g.date === today))) return;
    client.liveBusy = true;
    try { client.data = provider.applyLive(client.data, await provider.loadLive()); }
    catch { client.data = {...client.data, liveError: true}; }
    finally {
      client.liveBusy = false;
      this.sendSocketNotification('EIHL_DATA', {instanceId: client.config.instanceId, ...client.data});
    }
  },
  async refresh(client) {
    if (client.busy || client.liveBusy) return;
    client.busy = true;
    try {
      const next = await provider.load(client.config);
      // Retain each competition independently when a source request fails.
      for (const cached of client.data?.competitions || []) {
        if (!next.competitions.some(c => c.key === cached.key) && next.season === client.data.season) next.competitions.push(cached);
      }
      client.data = next;
      try { client.data = provider.applyLive(client.data, await provider.loadLive()); }
      catch { client.data.liveError = true; }
    } catch (error) {
      console.error(`[MMM-EIHL] ${error.message}`);
      client.data = {...(client.data || {competitions: []}), errors: ["EIHL feed"]};
    } finally {
      client.busy = false;
      this.sendSocketNotification("EIHL_DATA", {instanceId: client.config.instanceId, ...client.data});
    }
  },
  stop() { for (const client of this.clients.values()) { clearInterval(client.timer); clearInterval(client.liveTimer); } }
});
