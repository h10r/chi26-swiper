const STORAGE_KEY = "chi-swiper-state-v1";
const CSV_PATH = "all_papers.csv";
const SWIPE_THRESHOLD = 120;

const state = {
  papers: [],
  order: [],
  decisions: {},
  currentIndex: 0
};

const elements = {
  paperCard: document.getElementById("paper-card"),
  emptyState: document.getElementById("empty-state"),
  messageBanner: document.getElementById("message-banner"),
  progressPill: document.getElementById("progress-pill"),
  cardTime: document.getElementById("card-time"),
  cardRoom: document.getElementById("card-room"),
  cardTitle: document.getElementById("card-title"),
  cardAuthors: document.getElementById("card-authors"),
  readFlag: document.getElementById("read-flag"),
  savedFlag: document.getElementById("saved-flag"),
  readList: document.getElementById("read-list"),
  savedList: document.getElementById("saved-list"),
  readCount: document.getElementById("read-count"),
  savedCount: document.getElementById("saved-count"),
  passButton: document.getElementById("pass-button"),
  readButton: document.getElementById("read-button"),
  saveButton: document.getElementById("save-button"),
  downloadReadingButton: document.getElementById("download-reading"),
  downloadButton: document.getElementById("download-ics"),
  resetButton: document.getElementById("reset-app"),
  listItemTemplate: document.getElementById("list-item-template")
};

let dragState = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  hydrateState();
  showMessage("Loading all_papers.csv...");

  if (typeof window.ALL_PAPERS_CSV === "string" && window.ALL_PAPERS_CSV.trim()) {
    loadPapers(window.ALL_PAPERS_CSV);
    hideMessage();
    return;
  }

  try {
    const response = await fetch(CSV_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const csv = await response.text();
    loadPapers(csv);
    hideMessage();
  } catch (error) {
    showMessage(
      "Could not load paper data automatically. Regenerate all_papers.data.js from all_papers.csv or open the app through a local web server."
    );
    console.error(error);
    render();
  }
}

function bindEvents() {
  elements.passButton.addEventListener("click", () => decideCurrent("pass"));
  elements.saveButton.addEventListener("click", () => decideCurrent("save"));
  elements.readButton.addEventListener("click", toggleReadFirst);
  elements.downloadReadingButton.addEventListener("click", downloadReadingCsv);
  elements.downloadButton.addEventListener("click", downloadIcs);
  //elements.resetButton.addEventListener("click", resetState);

  elements.paperCard.addEventListener("pointerdown", onPointerDown);
  elements.paperCard.addEventListener("pointermove", onPointerMove);
  elements.paperCard.addEventListener("pointerup", onPointerUp);
  elements.paperCard.addEventListener("pointercancel", onPointerUp);
  elements.paperCard.addEventListener("touchstart", onTouchStart, { passive: false });
  elements.paperCard.addEventListener("touchmove", onTouchMove, { passive: false });
  elements.paperCard.addEventListener("touchend", onTouchEnd, { passive: false });
  elements.paperCard.addEventListener("touchcancel", onTouchEnd, { passive: false });
}

function hydrateState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    state.order = Array.isArray(saved.order) ? saved.order : [];
    state.decisions = saved.decisions && typeof saved.decisions === "object" ? saved.decisions : {};
    state.currentIndex = Number.isInteger(saved.currentIndex) ? saved.currentIndex : 0;
  } catch (error) {
    console.error("Failed to restore state", error);
  }
}

function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      order: state.order,
      decisions: state.decisions,
      currentIndex: state.currentIndex
    })
  );
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  state.order = state.papers.map((paper) => paper.id);
  state.decisions = {};
  state.currentIndex = 0;
  render();
  persistState();
}

function loadPapers(csvText) {
  const rows = parseCsv(csvText);
  state.papers = rows
    .map(mapPaper)
    .filter((paper) => paper.id && paper.title && paper.start && paper.end);

  const validIds = new Set(state.papers.map((paper) => paper.id));
  state.order = state.order.filter((id) => validIds.has(id));

  if (!state.order.length) {
    state.order = state.papers.map((paper) => paper.id);
  } else {
    const missingIds = state.papers.map((paper) => paper.id).filter((id) => !state.order.includes(id));
    state.order.push(...missingIds);
  }

  state.decisions = Object.fromEntries(
    Object.entries(state.decisions).filter(([id]) => validIds.has(id))
  );

  if (state.currentIndex >= state.order.length) {
    state.currentIndex = 0;
  }

  persistState();
  render();
}

function mapPaper(row) {
  return {
    id: row["Content ID"]?.trim(),
    title: row["Content title"]?.trim(),
    authors: row["Authors"]?.trim() || "Authors unavailable",
    room: row["Room name"]?.trim() || "Room TBA",
    startRaw: row["Content start date"]?.trim(),
    endRaw: row["Content end date"]?.trim(),
    start: parseConferenceDate(row["Content start date"]),
    end: parseConferenceDate(row["Content end date"])
  };
}

function parseConferenceDate(input) {
  if (!input) return null;
  const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) \(UTC \+02:00\)$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute)
  };
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      current = "";
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  if (!headers) return [];

  return dataRows.map((cells) => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header.trim()] = (cells[index] || "").trim();
    });
    return entry;
  });
}

function getCurrentPaper() {
  const id = state.order[state.currentIndex];
  return state.papers.find((paper) => paper.id === id) || null;
}

function decideCurrent(action) {
  const paper = getCurrentPaper();
  if (!paper) return;

  const existing = state.decisions[paper.id] || {};
  state.decisions[paper.id] = {
    ...existing,
    choice: action
  };

  state.currentIndex += 1;
  persistState();
  animateDecision(action);
  render();
}

function toggleReadFirst() {
  const paper = getCurrentPaper();
  if (!paper) return;

  const existing = state.decisions[paper.id] || {};
  state.decisions[paper.id] = {
    ...existing,
    readFirst: !existing.readFirst
  };
  persistState();
  render();
}

function animateDecision(action) {
  const direction = action === "save" ? 1 : -1;
  elements.paperCard.animate(
    [
      { transform: "translateX(0) rotate(0deg)", opacity: 1 },
      { transform: `translateX(${direction * 240}px) rotate(${direction * 14}deg)`, opacity: 0 }
    ],
    { duration: 220, easing: "ease-out" }
  );
}

function render() {
  renderCurrentCard();
  renderLists();
}

function renderCurrentCard() {
  const paper = getCurrentPaper();
  const total = state.order.length;
  const viewed = Math.min(state.currentIndex, total);
  elements.progressPill.textContent = total ? `${viewed + (paper ? 1 : 0)} / ${total}` : "0 / 0";

  if (!paper) {
    elements.paperCard.classList.add("hidden");
    elements.emptyState.classList.remove("hidden");
    return;
  }

  const decision = state.decisions[paper.id] || {};
  elements.emptyState.classList.add("hidden");
  elements.paperCard.classList.remove("hidden");
  elements.cardTime.textContent = formatDisplayTime(paper.start);
  elements.cardRoom.textContent = paper.room;
  elements.cardTitle.textContent = paper.title;
  elements.cardAuthors.textContent = paper.authors;
  elements.readFlag.classList.toggle("hidden", !decision.readFirst);
  elements.savedFlag.classList.toggle("hidden", decision.choice !== "save");
  elements.readButton.textContent = decision.readFirst ? "Do not read" : "Read";

  elements.paperCard.style.transform = "";
  elements.paperCard.style.opacity = "";
}

function renderLists() {
  const readPapers = state.papers.filter((paper) => state.decisions[paper.id]?.readFirst);
  const savedPapers = state.papers.filter((paper) => state.decisions[paper.id]?.choice === "save");

  elements.readCount.textContent = String(readPapers.length);
  elements.savedCount.textContent = String(savedPapers.length);
  populateList(elements.readList, readPapers, "No papers marked to read yet.");
  populateList(elements.savedList, savedPapers, "No papers marked to attend yet.");
}

function populateList(container, papers, emptyMessage) {
  container.innerHTML = "";
  if (!papers.length) {
    const empty = document.createElement("p");
    empty.className = "list-item-authors";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  papers
    .slice()
    .sort((a, b) => compareDates(a.start, b.start))
    .forEach((paper) => {
      const fragment = elements.listItemTemplate.content.cloneNode(true);
      fragment.querySelector(".list-item-time").textContent = formatDisplayTime(paper.start);
      fragment.querySelector(".list-item-room").textContent = paper.room;
      fragment.querySelector(".list-item-title").textContent = paper.title;
      fragment.querySelector(".list-item-authors").textContent = paper.authors;
      container.appendChild(fragment);
    });
}

function onPointerDown(event) {
  if (!getCurrentPaper()) return;
  beginDrag({
    pointerId: event.pointerId,
    startX: event.clientX
  });
  elements.paperCard.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  updateDrag(event.clientX);
}

function onPointerUp(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  elements.paperCard.releasePointerCapture(event.pointerId);
  finishDrag();
}

function onTouchStart(event) {
  if (!getCurrentPaper()) return;
  const touch = event.touches[0];
  if (!touch) return;
  event.preventDefault();
  beginDrag({
    startX: touch.clientX,
    touchId: touch.identifier
  });
}

function onTouchMove(event) {
  if (!dragState || dragState.touchId === undefined) return;
  const touch = Array.from(event.touches).find((entry) => entry.identifier === dragState.touchId);
  if (!touch) return;
  event.preventDefault();
  updateDrag(touch.clientX);
}

function onTouchEnd(event) {
  if (!dragState || dragState.touchId === undefined) return;
  const activeTouch = Array.from(event.touches).find((entry) => entry.identifier === dragState.touchId);
  if (activeTouch) return;
  event.preventDefault();
  finishDrag();
}

function beginDrag({ startX, pointerId, touchId }) {
  dragState = {
    startX,
    deltaX: 0,
    pointerId,
    touchId
  };
  elements.paperCard.classList.add("dragging");
}

function updateDrag(currentX) {
  if (!dragState) return;
  dragState.deltaX = currentX - dragState.startX;
  const rotation = dragState.deltaX / 18;
  const opacity = Math.max(0.5, 1 - Math.abs(dragState.deltaX) / 360);
  elements.paperCard.style.transform = `translateX(${dragState.deltaX}px) rotate(${rotation}deg)`;
  elements.paperCard.style.opacity = String(opacity);
}

function finishDrag() {
  if (!dragState) return;

  const { deltaX } = dragState;
  elements.paperCard.classList.remove("dragging");
  dragState = null;

  if (deltaX > SWIPE_THRESHOLD) {
    decideCurrent("save");
    return;
  }

  if (deltaX < -SWIPE_THRESHOLD) {
    decideCurrent("pass");
    return;
  }

  elements.paperCard.style.transform = "";
  elements.paperCard.style.opacity = "";
}

function downloadIcs() {
  const savedPapers = state.papers
    .filter((paper) => state.decisions[paper.id]?.choice === "save")
    .sort((a, b) => compareDates(a.start, b.start));

  if (!savedPapers.length) {
    showMessage("Save at least one paper before exporting an iCal file.");
    return;
  }

  hideMessage();
  const ics = buildIcs(savedPapers);
  downloadFile(ics, "chi-schedule.ics", "text/calendar;charset=utf-8");
}

function downloadReadingCsv() {
  const readPapers = state.papers
    .filter((paper) => state.decisions[paper.id]?.readFirst)
    .sort((a, b) => compareDates(a.start, b.start));

  if (!readPapers.length) {
    showMessage("Mark at least one paper as Read before exporting the reading list.");
    return;
  }

  hideMessage();
  const rows = [
    ["Content title", "Content start date", "Authors"],
    ...readPapers.map((paper) => [paper.title, paper.startRaw, paper.authors])
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  downloadFile(csv, "chi-reading-list.csv", "text/csv;charset=utf-8");
}

function buildIcs(papers) {
  const timezoneId = "Etc/GMT-2";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CHI Swipe Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:CHI Schedule",
    `X-WR-TIMEZONE:${timezoneId}`,
    "BEGIN:VTIMEZONE",
    `TZID:${timezoneId}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0200",
    "TZNAME:UTC+02:00",
    "END:STANDARD",
    "END:VTIMEZONE"
  ];

  papers.forEach((paper) => {
    const decision = state.decisions[paper.id] || {};
    lines.push(
      "BEGIN:VEVENT",
      `UID:${paper.id}@chi-swipe-scheduler`,
      `DTSTAMP:${formatUtcStamp(new Date())}`,
      `DTSTART;TZID=${timezoneId}:${formatIcsLocal(paper.start)}`,
      `DTEND;TZID=${timezoneId}:${formatIcsLocal(paper.end)}`,
      `SUMMARY:${escapeIcsText(paper.title)}`,
      `LOCATION:${escapeIcsText(paper.room)}`,
      `DESCRIPTION:${escapeIcsText(`Authors: ${paper.authors}${decision.readFirst ? "\\nRead: Yes" : ""}`)}`,
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function formatDisplayTime(dateParts) {
  const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day));
  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    timeZone: "UTC"
  }).format(date);
  return `${weekday} ${pad(dateParts.hour)}:${pad(dateParts.minute)}`;
}

function compareDates(a, b) {
  return (
    a.year - b.year ||
    a.month - b.month ||
    a.day - b.day ||
    a.hour - b.hour ||
    a.minute - b.minute
  );
}

function formatIcsLocal(dateParts) {
  return `${dateParts.year}${pad(dateParts.month)}${pad(dateParts.day)}T${pad(dateParts.hour)}${pad(dateParts.minute)}00`;
}

function formatUtcStamp(date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escapeIcsText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function downloadFile(contents, filename, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function showMessage(message) {
  elements.messageBanner.textContent = message;
  elements.messageBanner.classList.remove("hidden");
}

function hideMessage() {
  elements.messageBanner.classList.add("hidden");
}
