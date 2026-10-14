const STORAGE_KEY = "moodtracker.entries.v1";
const MAX_ENTRIES = 80;
const MAX_NOTE = 140;

const MOODS = [
  { id: "great", emoji: "😄", label: "Great" },
  { id: "good", emoji: "🙂", label: "Good" },
  { id: "okay", emoji: "😐", label: "Okay" },
  { id: "meh", emoji: "😕", label: "Meh" },
  { id: "low", emoji: "😢", label: "Low" },
  { id: "anxious", emoji: "😰", label: "Anxious" },
  { id: "frustrated", emoji: "😤", label: "Frustrated" },
  { id: "tired", emoji: "😴", label: "Tired" },
];

const moodGrid = document.getElementById("mood-grid");
const noteInput = document.getElementById("note-input");
const charCount = document.getElementById("char-count");
const saveBtn = document.getElementById("save-btn");
const statusEl = document.getElementById("status");
const historyList = document.getElementById("history-list");
const clearBtn = document.getElementById("clear-btn");

let selectedMoodId = null;

function safeLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeEntry)
      .filter(Boolean)
      .sort((a, b) => b.created.localeCompare(a.created));
  } catch {
    return [];
  }
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const mood = MOODS.find((item) => item.id === raw.moodId);
  if (!mood) return null;
  if (typeof raw.id !== "string" || typeof raw.created !== "string") return null;
  const note = typeof raw.note === "string" ? raw.note.trim().slice(0, MAX_NOTE) : "";
  return {
    id: raw.id,
    created: raw.created,
    moodId: mood.id,
    emoji: mood.emoji,
    label: mood.label,
    note,
  };
}

function safeSave(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    return true;
  } catch {
    return false;
  }
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function renderMoods() {
  moodGrid.replaceChildren();
  for (const mood of MOODS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mood";
    button.dataset.moodId = mood.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(mood.id === selectedMoodId));
    button.setAttribute("aria-label", mood.label);
    button.innerHTML = `<span class="glyph" aria-hidden="true">${mood.emoji}</span><span class="label">${mood.label}</span>`;
    button.addEventListener("click", () => selectMood(mood.id));
    moodGrid.appendChild(button);
  }
}

function selectMood(id) {
  selectedMoodId = id;
  renderMoods();
  saveBtn.disabled = false;
  setStatus("");
}

function updateCount() {
  const length = noteInput.value.length;
  charCount.textContent = `${length} / ${MAX_NOTE}`;
}

function relativeTime(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const delta = Date.now() - then;
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderHistory() {
  const entries = safeLoad();
  historyList.replaceChildren();
  clearBtn.hidden = entries.length === 0;

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No moods yet. Tap one above to start a local log.";
    historyList.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const item = document.createElement("li");
    const note = entry.note
      ? escapeHtml(entry.note)
      : `<span class="empty">No note</span>`;
    item.innerHTML = `
      <span class="emoji" aria-hidden="true">${entry.emoji}</span>
      <div>
        <p class="meta">${escapeHtml(entry.label)} · ${escapeHtml(relativeTime(entry.created))}</p>
        <p class="note">${note}</p>
      </div>
    `;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn tiny";
    remove.setAttribute("aria-label", `Remove ${entry.label} entry`);
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeEntry(entry.id));
    item.appendChild(remove);
    historyList.appendChild(item);
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function logMood() {
  const mood = MOODS.find((item) => item.id === selectedMoodId);
  if (!mood) {
    setStatus("Pick an emoji first.", true);
    return;
  }

  const note = noteInput.value.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE);
  const entries = safeLoad();
  entries.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created: new Date().toISOString(),
    moodId: mood.id,
    note,
  });

  const saved = safeSave(entries);
  if (!saved) {
    setStatus("Could not save. Private browsing or storage may be blocked.", true);
    return;
  }

  noteInput.value = "";
  updateCount();
  selectedMoodId = null;
  saveBtn.disabled = true;
  renderMoods();
  renderHistory();
  setStatus("Logged locally.");
}

function removeEntry(id) {
  const next = safeLoad().filter((entry) => entry.id !== id);
  if (!safeSave(next)) {
    setStatus("Could not update storage.", true);
    return;
  }
  renderHistory();
  setStatus("Entry removed.");
}

function clearAll() {
  if (!window.confirm("Clear every mood in this browser?")) return;
  if (!safeSave([])) {
    setStatus("Could not clear storage.", true);
    return;
  }
  renderHistory();
  setStatus("History cleared.");
}

noteInput.addEventListener("input", updateCount);
saveBtn.addEventListener("click", logMood);
clearBtn.addEventListener("click", clearAll);
noteInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    logMood();
  }
});

renderMoods();
updateCount();
renderHistory();
