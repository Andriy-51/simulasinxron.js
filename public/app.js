const socket = io();

const queueCtx = document.getElementById('queueChart').getContext('2d');
const processedCtx = document.getElementById('processedChart').getContext('2d');
const slaCtx = document.getElementById('slaChart').getContext('2d');

const eventsList = document.getElementById('events');

function addEvent(text) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} — ${text}`;
  eventsList.insertBefore(li, eventsList.firstChild);
  if (eventsList.children.length > 200) eventsList.removeChild(eventsList.lastChild);
}

const labels = [];
const queueData = [];
const processedData = [];
const slaData = [];

function pushPoint(valueQueue, valueProcessed, valueSla) {
  const label = new Date().toLocaleTimeString();
  labels.push(label);
  queueData.push(valueQueue);
  processedData.push(valueProcessed);
  slaData.push(valueSla);
  if (labels.length > 40) {
    labels.shift(); queueData.shift(); processedData.shift(); slaData.shift();
  }
  queueChart.update(); processedChart.update(); slaChart.update();
}

const queueChart = new Chart(queueCtx, {
  type: 'line',
  data: { labels, datasets: [{ label: 'Queue length', data: queueData, borderColor: '#007bff', tension: 0.3 }] },
  options: { responsive: true }
});

const processedChart = new Chart(processedCtx, {
  type: 'line',
  data: { labels, datasets: [{ label: 'Processed', data: processedData, borderColor: '#28a745', tension: 0.3 }] },
  options: { responsive: true }
});

const slaChart = new Chart(slaCtx, {
  type: 'line',
  data: { labels, datasets: [{ label: 'SLA %', data: slaData, borderColor: '#ffc107', tension: 0.3 }] },
  options: { responsive: true, scales: { y: { min: 0, max: 100 } } }
});

window.queueChart = queueChart;
window.processedChart = processedChart;
window.slaChart = slaChart;

socket.on('connect', () => addEvent('Connected to server'));
socket.on('disconnect', () => addEvent('Disconnected'));

socket.on('platform.metrics', (payload) => {
  const summary = payload.dashboard || payload.monitor || payload;
  const qLen = summary.queue?.pending ?? summary.queue?.pendingCount ?? summary.queuePending ?? 0;
  const processed = summary.queue?.processed ?? summary.processed ?? 0;
  const sla = summary.sla?.compliancePercent ?? summary.cache?.hitRate ?? summary.cacheHitRate ?? 0;
  pushPoint(qLen, processed, sla);
});

socket.on('request.enqueued', (req) => addEvent(`Enqueued ${req.id} (${req.title})`));
socket.on('request.generated', (req) => addEvent(`Generated ${req.id}`));
socket.on('report.generated', (data) => addEvent(`Report generated: ${data.path}`));

document.getElementById('startBtn').addEventListener('click', async () => {
  const totalRequests = Number(document.getElementById('totalRequests').value) || 40;
  const concurrency = Number(document.getElementById('concurrency').value) || 3;
  addEvent(`Starting simulation: ${totalRequests} requests, concurrency ${concurrency}`);
  try {
    const res = await fetch('/api/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demo: { totalRequests }, runtime: { queueConcurrency: concurrency } })
    });
    const json = await res.json();
    addEvent(`Run API responded: ${json.status || JSON.stringify(json)}`);
  } catch (e) {
    addEvent('Failed to start simulation: ' + e.message);
  }
});
