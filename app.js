const processBody = document.getElementById("processBody");
const metricBody = document.getElementById("metricBody");
const ganttTimeline = document.getElementById("ganttTimeline");
const algorithmSelect = document.getElementById("algorithm");
const quantumWrap = document.getElementById("quantum-wrap");
const quantumInput = document.getElementById("quantum");
const contextSwitchInput = document.getElementById("contextSwitch");
const simulateBtn = document.getElementById("simulateBtn");
const addProcessBtn = document.getElementById("addProcessBtn");
const loadDemoBtn = document.getElementById("loadDemoBtn");
const summaryCards = document.getElementById("summaryCards");
const runBadge = document.getElementById("runBadge");
const playAnimBtn = document.getElementById("playAnimBtn");
const pauseAnimBtn = document.getElementById("pauseAnimBtn");
const resetAnimBtn = document.getElementById("resetAnimBtn");
const animSpeed = document.getElementById("animSpeed");
const liveClock = document.getElementById("liveClock");
const liveCurrent = document.getElementById("liveCurrent");
const liveQueue = document.getElementById("liveQueue");
const liveTrack = document.getElementById("liveTrack");
const remainingGrid = document.getElementById("remainingGrid");
const formulaGrid = document.getElementById("formulaGrid");
const traceBody = document.getElementById("traceBody");

const palette = ["#f59e0b", "#2dd4bf", "#60a5fa", "#fb7185", "#a3e635", "#f97316", "#22d3ee"];
let nextId = 1;
let processes = [];
let animationState = {
  timer: null,
  cursor: 0,
  frames: [],
};

function createProcessRow(process) {
  const tr = document.createElement("tr");
  tr.dataset.id = process.id;
  tr.innerHTML = `
    <td><input type="text" value="${process.name}" maxlength="10" class="name-input" /></td>
    <td><input type="number" min="0" step="1" value="${process.arrival}" class="arrival-input" /></td>
    <td><input type="number" min="1" step="1" value="${process.burst}" class="burst-input" /></td>
    <td><input type="number" min="1" step="1" value="${process.priority}" class="priority-input" /></td>
    <td><input type="color" value="${process.color}" class="swatch color-input" /></td>
    <td><button class="remove-btn">Remove</button></td>
  `;
  processBody.appendChild(tr);
}

function addProcess(process = null) {
  const item =
    process || {
      id: nextId++,
      name: `P${nextId - 1}`,
      arrival: 0,
      burst: 4,
      priority: 2,
      color: palette[(nextId - 2) % palette.length],
    };
  if (process) nextId = Math.max(nextId, process.id + 1);
  createProcessRow(item);
}

function loadDefaultProcesses() {
  processBody.innerHTML = "";
  nextId = 1;
  [
    { id: 1, name: "P1", arrival: 0, burst: 7, priority: 2, color: palette[0] },
    { id: 2, name: "P2", arrival: 2, burst: 4, priority: 1, color: palette[1] },
    { id: 3, name: "P3", arrival: 4, burst: 1, priority: 3, color: palette[2] },
    { id: 4, name: "P4", arrival: 5, burst: 4, priority: 2, color: palette[3] },
  ].forEach((p) => addProcess(p));
}

function sanitizeInt(value, min = 0, fallback = min) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, n);
}

function collectProcesses() {
  const rows = [...processBody.querySelectorAll("tr")];
  const collected = rows.map((row, index) => {
    const get = (selector) => row.querySelector(selector);
    return {
      id: index + 1,
      name: get(".name-input").value.trim() || `P${index + 1}`,
      arrival: sanitizeInt(get(".arrival-input").value, 0, 0),
      burst: sanitizeInt(get(".burst-input").value, 1, 1),
      priority: sanitizeInt(get(".priority-input").value, 1, 1),
      color: get(".color-input").value || palette[index % palette.length],
    };
  });

  processes = collected;
  return collected;
}

function buildMeta(processList) {
  const meta = {};
  for (const p of processList) {
    meta[p.id] = {
      name: p.name,
      arrival: p.arrival,
      burst: p.burst,
      priority: p.priority,
      color: p.color,
      remaining: p.burst,
      completion: null,
      firstStart: null,
    };
  }
  return meta;
}

function pushSegment(timeline, pid, start, end, label = null, color = null) {
  if (end <= start) return;
  const prev = timeline[timeline.length - 1];
  if (prev && prev.pid === pid && prev.end === start) {
    prev.end = end;
    return;
  }
  timeline.push({ pid, start, end, label, color });
}

function simulate(scheduleType, processList, quantum, contextSwitch) {
  const meta = buildMeta(processList);
  const total = processList.length;
  const timeline = [];
  let completed = 0;
  let time = 0;
  let contextSwitches = 0;
  let lastRealPid = null;
  const byArrival = [...processList].sort((a, b) => a.arrival - b.arrival || a.id - b.id);

  const insertContextSwitchIfNeeded = (newPid) => {
    if (lastRealPid === null || newPid === null || lastRealPid === newPid) return;
    if (contextSwitch > 0) {
      pushSegment(timeline, "CS", time, time + contextSwitch, "CS", "#d2dbe0");
      time += contextSwitch;
    }
    contextSwitches += 1;
  };

  if (scheduleType === "FCFS" || scheduleType === "SJF" || scheduleType === "PRIORITY") {
    while (completed < total) {
      const ready = byArrival.filter((p) => meta[p.id].remaining > 0 && p.arrival <= time);
      if (ready.length === 0) {
        const next = byArrival.find((p) => meta[p.id].remaining > 0);
        if (!next) break;
        pushSegment(timeline, "IDLE", time, next.arrival, "Idle", "#6b7280");
        time = next.arrival;
        continue;
      }

      let selected;
      if (scheduleType === "FCFS") {
        selected = [...ready].sort((a, b) => a.arrival - b.arrival || a.id - b.id)[0];
      } else if (scheduleType === "SJF") {
        selected = [...ready].sort((a, b) => a.burst - b.burst || a.arrival - b.arrival || a.id - b.id)[0];
      } else {
        selected = [...ready].sort((a, b) => a.priority - b.priority || a.arrival - b.arrival || a.id - b.id)[0];
      }

      insertContextSwitchIfNeeded(selected.id);
      const m = meta[selected.id];
      if (m.firstStart === null) m.firstStart = time;
      pushSegment(timeline, selected.id, time, time + m.remaining, m.name, m.color);
      time += m.remaining;
      m.remaining = 0;
      m.completion = time;
      completed += 1;
      lastRealPid = selected.id;
    }
  } else if (scheduleType === "SRTF") {
    while (completed < total) {
      const ready = byArrival.filter((p) => meta[p.id].remaining > 0 && p.arrival <= time);
      if (ready.length === 0) {
        const next = byArrival.find((p) => meta[p.id].remaining > 0);
        if (!next) break;
        pushSegment(timeline, "IDLE", time, next.arrival, "Idle", "#6b7280");
        time = next.arrival;
        continue;
      }
      const selected = [...ready].sort(
        (a, b) => meta[a.id].remaining - meta[b.id].remaining || a.arrival - b.arrival || a.id - b.id
      )[0];
      insertContextSwitchIfNeeded(selected.id);
      const m = meta[selected.id];
      if (m.firstStart === null) m.firstStart = time;
      pushSegment(timeline, selected.id, time, time + 1, m.name, m.color);
      m.remaining -= 1;
      time += 1;
      if (m.remaining === 0) {
        m.completion = time;
        completed += 1;
      }
      lastRealPid = selected.id;
    }
  } else if (scheduleType === "RR") {
    const queue = [];
    const arrived = new Set();
    const sorted = [...byArrival];
    const pushArrivals = () => {
      for (const p of sorted) {
        if (p.arrival <= time && !arrived.has(p.id)) {
          queue.push(p.id);
          arrived.add(p.id);
        }
      }
    };
    pushArrivals();
    while (completed < total) {
      if (queue.length === 0) {
        const next = sorted.find((p) => meta[p.id].remaining > 0 && !arrived.has(p.id));
        if (!next) break;
        pushSegment(timeline, "IDLE", time, next.arrival, "Idle", "#6b7280");
        time = next.arrival;
        pushArrivals();
        continue;
      }

      const pid = queue.shift();
      const m = meta[pid];
      if (m.remaining <= 0) continue;
      insertContextSwitchIfNeeded(pid);
      if (m.firstStart === null) m.firstStart = time;
      const runFor = Math.min(quantum, m.remaining);
      pushSegment(timeline, pid, time, time + runFor, m.name, m.color);
      time += runFor;
      m.remaining -= runFor;
      pushArrivals();
      if (m.remaining > 0) {
        queue.push(pid);
      } else {
        m.completion = time;
        completed += 1;
      }
      lastRealPid = pid;
    }
  }

  const metrics = processList.map((p) => {
    const m = meta[p.id];
    const turnaround = (m.completion || 0) - p.arrival;
    const waiting = turnaround - p.burst;
    const response = (m.firstStart || 0) - p.arrival;
    return {
      id: p.id,
      name: p.name,
      completion: m.completion || 0,
      turnaround,
      waiting,
      response,
    };
  });

  const totalBurst = processList.reduce((acc, p) => acc + p.burst, 0);
  const totalTime = timeline.length ? timeline[timeline.length - 1].end : 0;
  const avg = (key) => (metrics.reduce((acc, item) => acc + item[key], 0) / (metrics.length || 1)).toFixed(2);
  const throughput = totalTime > 0 ? (total / totalTime).toFixed(3) : "0.000";
  const utilization = totalTime > 0 ? ((totalBurst / totalTime) * 100).toFixed(2) : "0.00";

  return {
    timeline,
    metrics,
    summary: {
      averageTurnaround: avg("turnaround"),
      averageWaiting: avg("waiting"),
      averageResponse: avg("response"),
      throughput,
      cpuUtilization: utilization,
      totalTime,
      contextSwitches,
    },
  };
}

function renderGantt(timeline) {
  if (!timeline.length) {
    ganttTimeline.className = "gantt empty";
    ganttTimeline.textContent = "No timeline generated.";
    return;
  }

  ganttTimeline.className = "gantt";
  const total = timeline[timeline.length - 1].end - timeline[0].start;
  const track = document.createElement("div");
  track.className = "gantt-track";

  const scale = document.createElement("div");
  scale.className = "gantt-scale";

  timeline.forEach((seg) => {
    const width = ((seg.end - seg.start) / total) * 100;
    const block = document.createElement("div");
    block.className = "gantt-block";
    block.style.width = `${width}%`;
    block.style.background = seg.color || "#8ad4f6";
    block.textContent = seg.label || seg.pid;
    block.title = `${seg.label || seg.pid}: ${seg.start} -> ${seg.end}`;
    track.appendChild(block);

    const mark = document.createElement("div");
    mark.className = "scale-mark";
    mark.style.width = `${width}%`;
    mark.textContent = `${seg.end}`;
    scale.appendChild(mark);
  });

  const startMark = document.createElement("span");
  startMark.textContent = `${timeline[0].start} `;
  scale.prepend(startMark);

  ganttTimeline.innerHTML = "";
  ganttTimeline.appendChild(track);
  ganttTimeline.appendChild(scale);
}

function renderMetrics(metrics, summary) {
  metricBody.innerHTML = metrics
    .map(
      (m) => `
      <tr>
        <td>${m.name}</td>
        <td>${m.completion}</td>
        <td>${m.turnaround}</td>
        <td>${m.waiting}</td>
        <td>${m.response}</td>
      </tr>
    `
    )
    .join("");

  const items = [
    ["Avg Turnaround", summary.averageTurnaround],
    ["Avg Waiting", summary.averageWaiting],
    ["Avg Response", summary.averageResponse],
    ["Throughput", `${summary.throughput} jobs/t`],
    ["CPU Utilization", `${summary.cpuUtilization}%`],
    ["Total Time", summary.totalTime],
    ["Context Switches", summary.contextSwitches],
  ];

  summaryCards.innerHTML = items
    .map(
      ([label, value]) => `
      <article class="metric-card">
        <p>${label}</p>
        <strong>${value}</strong>
      </article>
    `
    )
    .join("");
}

function buildCalculationTrace(processList, timeline) {
  if (!timeline.length) {
    return { formulas: [], steps: [] };
  }

  const totalTime = timeline[timeline.length - 1].end;
  const remaining = Object.fromEntries(processList.map((p) => [p.id, p.burst]));
  const waiting = Object.fromEntries(processList.map((p) => [p.id, 0]));
  const completion = Object.fromEntries(processList.map((p) => [p.id, null]));
  const firstStart = Object.fromEntries(processList.map((p) => [p.id, null]));
  const byId = Object.fromEntries(processList.map((p) => [p.id, p]));
  const steps = [];

  for (let t = 0; t < totalTime; t += 1) {
    const seg = timeline.find((item) => item.start <= t && t < item.end) || null;
    const runningPid = seg && typeof seg.pid === "number" ? seg.pid : null;
    const ready = processList.filter((p) => p.arrival <= t && remaining[p.id] > 0 && p.id !== runningPid);

    ready.forEach((p) => {
      waiting[p.id] += 1;
    });

    let event = seg ? seg.label || (runningPid ? byId[runningPid].name : seg.pid) : "Idle";
    if (runningPid) {
      if (firstStart[runningPid] === null) {
        firstStart[runningPid] = t;
      }
      remaining[runningPid] -= 1;
      if (remaining[runningPid] === 0) {
        completion[runningPid] = t + 1;
        event += ` (Complete ${byId[runningPid].name})`;
      }
    }

    const waitingUpdate = ready.length ? ready.map((p) => `${p.name}+1`).join(", ") : "-";
    const remainingSnapshot = processList.map((p) => `${p.name}:${remaining[p.id]}`).join(" | ");
    steps.push({
      t,
      event,
      ready: ready.map((p) => p.name).join(", ") || "-",
      waitingUpdate,
      remainingSnapshot,
    });
  }

  const formulas = processList.map((p) => {
    const ct = completion[p.id] ?? 0;
    const tat = ct - p.arrival;
    const wt = waiting[p.id];
    const rt = firstStart[p.id] === null ? 0 : firstStart[p.id] - p.arrival;
    return {
      name: p.name,
      ct,
      tat,
      wt,
      rt,
      arrival: p.arrival,
      burst: p.burst,
    };
  });

  return { formulas, steps };
}

function renderCalculationBreakdown(calculation) {
  formulaGrid.innerHTML = calculation.formulas
    .map(
      (f) => `
      <article class="formula-card">
        <h3>${f.name}</h3>
        <p>CT = ${f.ct}</p>
        <p>TAT = CT - AT = ${f.ct} - ${f.arrival} = ${f.tat}</p>
        <p>WT = ${f.wt}</p>
        <p>RT = First Start - AT = ${f.rt + f.arrival} - ${f.arrival} = ${f.rt}</p>
        <p>Check: WT = TAT - BT = ${f.tat} - ${f.burst} = ${f.tat - f.burst}</p>
      </article>
    `
    )
    .join("");

  traceBody.innerHTML = calculation.steps
    .map(
      (s) => `
      <tr>
        <td>${s.t} → ${s.t + 1}</td>
        <td>${s.event}</td>
        <td>${s.ready}</td>
        <td>${s.waitingUpdate}</td>
        <td>${s.remainingSnapshot}</td>
      </tr>
    `
    )
    .join("");
}

function buildAnimationFrames(timeline, processList) {
  if (!timeline.length) return [];
  const totalTime = timeline[timeline.length - 1].end;
  const processMap = Object.fromEntries(processList.map((p) => [p.id, p]));
  const remaining = Object.fromEntries(processList.map((p) => [p.id, p.burst]));
  const frames = [];

  for (let t = 0; t < totalTime; t += 1) {
    const seg = timeline.find((item) => item.start <= t && t < item.end) || null;
    const pid = seg ? seg.pid : "IDLE";
    if (typeof pid === "number" && remaining[pid] > 0) {
      remaining[pid] -= 1;
    }
    const ready = processList
      .filter((p) => p.arrival <= t && remaining[p.id] > 0 && p.id !== pid)
      .map((p) => p.name)
      .join(", ");
    const remainLabel = processList.map((p) => `${p.name}:${remaining[p.id]}`).join(" | ");
    frames.push({
      t: t + 1,
      label: seg ? seg.label || (typeof pid === "number" ? processMap[pid].name : pid) : "Idle",
      color: seg ? seg.color || "#86d0f5" : "#6b7280",
      ready: ready || "-",
      remainLabel,
    });
  }
  return frames;
}

function stopAnimation() {
  if (animationState.timer) {
    clearInterval(animationState.timer);
    animationState.timer = null;
  }
}

function renderRemainingCards(frame) {
  const chunks = frame.remainLabel.split(" | ");
  remainingGrid.innerHTML = chunks
    .map((item) => `<div class="remaining-chip">${item} remaining</div>`)
    .join("");
}

function renderAnimationFrame(frame) {
  liveClock.textContent = `Time: ${frame.t}`;
  liveCurrent.textContent = `CPU: ${frame.label}`;
  liveQueue.textContent = `Ready: ${frame.ready}`;
  const cell = document.createElement("div");
  cell.className = "live-cell";
  cell.style.background = frame.color;
  cell.title = `t=${frame.t} | ${frame.label}`;
  liveTrack.appendChild(cell);
  renderRemainingCards(frame);
}

function resetAnimationBoard() {
  stopAnimation();
  animationState.cursor = 0;
  liveTrack.innerHTML = "";
  liveClock.textContent = "Time: 0";
  liveCurrent.textContent = "CPU: Idle";
  liveQueue.textContent = "Ready: -";
  remainingGrid.innerHTML = "";
}

function playAnimation() {
  if (!animationState.frames.length) {
    alert("Run a simulation first.");
    return;
  }
  if (animationState.timer) return;
  const speed = Math.max(1, Number.parseInt(animSpeed.value, 10) || 1);
  const delay = Math.max(120, Math.floor(600 / speed));
  animationState.timer = setInterval(() => {
    if (animationState.cursor >= animationState.frames.length) {
      stopAnimation();
      return;
    }
    renderAnimationFrame(animationState.frames[animationState.cursor]);
    animationState.cursor += 1;
  }, delay);
}

function runSimulation() {
  const inputProcesses = collectProcesses();
  if (inputProcesses.length === 0) {
    alert("Add at least one process to run simulation.");
    return;
  }

  const algorithm = algorithmSelect.value;
  const quantum = sanitizeInt(quantumInput.value, 1, 2);
  const contextSwitch = sanitizeInt(contextSwitchInput.value, 0, 0);
  const result = simulate(algorithm, inputProcesses, quantum, contextSwitch);
  const frames = buildAnimationFrames(result.timeline, inputProcesses);
  const calculation = buildCalculationTrace(inputProcesses, result.timeline);

  renderGantt(result.timeline);
  renderMetrics(result.metrics, result.summary);
  renderCalculationBreakdown(calculation);
  animationState.frames = frames;
  resetAnimationBoard();
  if (frames[0]) {
    renderRemainingCards(frames[0]);
  }
  runBadge.classList.remove("flash");
  window.requestAnimationFrame(() => runBadge.classList.add("flash"));
  runBadge.textContent =
    algorithm === "RR" ? `${algorithm} | Quantum ${quantum} | CS ${contextSwitch}` : `${algorithm} | CS ${contextSwitch}`;
}

function toggleQuantum() {
  quantumWrap.classList.toggle("hidden", algorithmSelect.value !== "RR");
}

algorithmSelect.addEventListener("change", toggleQuantum);
simulateBtn.addEventListener("click", runSimulation);
addProcessBtn.addEventListener("click", () => addProcess());
loadDemoBtn.addEventListener("click", loadDefaultProcesses);
playAnimBtn.addEventListener("click", playAnimation);
pauseAnimBtn.addEventListener("click", stopAnimation);
resetAnimBtn.addEventListener("click", resetAnimationBoard);

processBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("remove-btn")) return;
  const row = target.closest("tr");
  if (row) row.remove();
});

loadDefaultProcesses();
toggleQuantum();
runSimulation();
