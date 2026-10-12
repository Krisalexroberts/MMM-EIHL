const NodeHelper = require("node_helper");
const provider = require("./provider");
module.exports = NodeHelper.create({
  start() { this.clients = new Map(); },
  socketNotificationReceived(name, config) {
    if (name !== "EIHL_START" || !config.instanceId) return;
    const old = this.clients.get(config.instanceId);
    if (old) clearInterval(old.timer);
    const client = {config, data: null, busy: false};
    this.clients.set(config.instanceId, client);
    this.refresh(client);
    client.timer = setInterval(() => this.refresh(client), Math.max(60000, Number(config.updateInterval) || 600000));
  },
  async refresh(client) {
    if (client.busy) return;
    client.busy = true;
    try {
      const next = await provider.load(client.config);
      // Retain each competition independently when a source request fails.
      for (const cached of client.data?.competitions || []) {
        if (!next.competitions.some(c => c.key === cached.key) && next.season === client.data.season) next.competitions.push(cached);
      }
      client.data = next;
    } catch (error) {
      console.error(`[MMM-EIHL] ${error.message}`);
      client.data = {...(client.data || {competitions: []}), errors: ["EIHL feed"]};
    } finally {
      client.busy = false;
      this.sendSocketNotification("EIHL_DATA", {instanceId: client.config.instanceId, ...client.data});
    }
  },
  stop() { for (const client of this.clients.values()) clearInterval(client.timer); }
});
