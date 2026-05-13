const { sleep, now } = require("../utils/delay");

async function produceByClients(channel, clients, requestsPerClient, vipRate) {
  let sequence = 0;
  const producers = Array.from({ length: clients }, (_, idx) => {
    const clientId = idx + 1;

    return (async () => {
      for (let i = 0; i < requestsPerClient; i += 1) {
        sequence += 1;
        const request = {
          sequence,
          clientId,
          arrivedAt: now(),
          priority: Math.random() < vipRate ? 1 : 0
        };

        channel.emit("request", request);
        await sleep(40 + Math.floor(Math.random() * 140));
      }
    })();
  });

  await Promise.all(producers);
}

async function produceDemo(channel, total, clients, vipRate) {
  let sequence = 0;
  const maxClients = Math.max(clients, 10);
  for (let i = 0; i < total; i += 1) {
    sequence += 1;
    const request = {
      sequence,
      clientId: 1 + Math.floor(Math.random() * maxClients),
      arrivedAt: now(),
      priority: Math.random() < vipRate ? 1 : 0
    };

    channel.emit("request", request);
    await sleep(20 + Math.floor(Math.random() * 180));
  }
}

module.exports = { produceByClients, produceDemo };
