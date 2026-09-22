import { requireSession, signOut } from "./auth.js";
import { supabase } from "./supabaseClient.js";
import {
  monthGridDates,
  toISODate,
  todayISODate,
  WEEKDAY_LABELS,
  monthLabel,
} from "./dateUtils.js";

const session = await requireSession();
if (!session) throw new Error("redirecting to login");

document.getElementById("sign-out").addEventListener("click", (e) => {
  e.preventDefault();
  signOut();
});

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let entriesByDate = new Map(); // isoDate -> entry[]
let loggedDates = new Set(); // isoDate strings that have a food log (wired in milestone 4)

const weekdaysEl = document.getElementById("calendar-weekdays");
weekdaysEl.innerHTML = WEEKDAY_LABELS.map(
  (label) => `<div class="calendar-weekday">${label}</div>`
).join("");

const daysEl = document.getElementById("calendar-days");
const monthLabelEl = document.getElementById("month-label");

async function loadMonth() {
  const gridDates = monthGridDates(viewYear, viewMonth);
  const rangeStart = toISODate(gridDates[0]);
  const rangeEnd = toISODate(gridDates[gridDates.length - 1]);

  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .gte("entry_date", rangeStart)
    .lte("entry_date", rangeEnd)
    .order("created_at", { ascending: true });

  entriesByDate = new Map();
  if (!error && data) {
    for (const entry of data) {
      if (!entriesByDate.has(entry.entry_date)) entriesByDate.set(entry.entry_date, []);
      entriesByDate.get(entry.entry_date).push(entry);
    }
  }

  const { data: logs } = await supabase
    .from("food_logs")
    .select("log_date")
    .gte("log_date", rangeStart)
    .lte("log_date", rangeEnd);
  loggedDates = new Set((logs || []).map((l) => l.log_date));

  renderCalendar(gridDates);
}

function renderCalendar(gridDates) {
  monthLabelEl.textContent = `${monthLabel(viewYear, viewMonth)} ${viewYear}`;
  const today = todayISODate();

  daysEl.innerHTML = "";
  for (const date of gridDates) {
    const iso = toISODate(date);
    const isOutside = date.getMonth() !== viewMonth;
    const dayEntries = entriesByDate.get(iso) || [];
    const hasPinned = dayEntries.some((e) => e.pinned);
    const hasLog = loggedDates.has(iso);

    const preview = dayEntries.find((e) => e.pinned) || dayEntries[0];

    const cell = document.createElement("div");
    cell.className = "calendar-day" + (isOutside ? " outside-month" : "") + (iso === today ? " today" : "");
    cell.innerHTML = `
      <div class="day-header">
        <span class="day-number">${date.getDate()}</span>
        <span class="markers">
          ${hasPinned ? "★" : ""}${hasLog ? '<span class="logged-dot" title="Food logged"></span>' : ""}
        </span>
      </div>
      ${preview ? `<span class="entry-preview">${escapeHtml(preview.title)}</span>` : ""}
    `;
    cell.addEventListener("click", () => openDayModal(iso));
    daysEl.appendChild(cell);
  }
}

document.getElementById("prev-month").addEventListener("click", () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  loadMonth();
});

document.getElementById("next-month").addEventListener("click", () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  loadMonth();
});

// --- Day detail modal ---

const dayModal = document.getElementById("day-modal");
const dayModalTitle = document.getElementById("day-modal-title");
const dayEntriesList = document.getElementById("day-entries-list");
let dayModalDate = null;

function openDayModal(iso) {
  dayModalDate = iso;
  dayModalTitle.textContent = iso;
  renderDayEntries();
  dayModal.hidden = false;
}

function renderDayEntries() {
  const entries = entriesByDate.get(dayModalDate) || [];
  if (entries.length === 0) {
    dayEntriesList.innerHTML = "<p>No entries yet.</p>";
    return;
  }
  dayEntriesList.innerHTML = "";
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "day-entry-row";
    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:start;">
        <strong>${entry.pinned ? "★ " : ""}${escapeHtml(entry.title)}</strong>
        <div>
          <button class="secondary" data-action="edit">Edit</button>
          <button class="secondary" data-action="delete">Delete</button>
        </div>
      </div>
      <p style="white-space:pre-wrap;">${escapeHtml(entry.content || "")}</p>
    `;
    row.querySelector('[data-action="edit"]').addEventListener("click", () => {
      dayModal.hidden = true;
      openEntryModal(entry);
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteEntry(entry.id));
    dayEntriesList.appendChild(row);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById("day-close").addEventListener("click", () => (dayModal.hidden = true));
document.getElementById("day-add-entry").addEventListener("click", () => {
  dayModal.hidden = true;
  openEntryModal(null, dayModalDate);
});

// --- Add/edit entry modal ---

const entryModal = document.getElementById("entry-modal");
const entryForm = document.getElementById("entry-form");
const entryModalTitle = document.getElementById("entry-modal-title");

function openEntryModal(entry, defaultDate) {
  entryModalTitle.textContent = entry ? "Edit entry" : "Add entry";
  document.getElementById("entry-id").value = entry?.id || "";
  document.getElementById("entry-date").value = entry?.entry_date || defaultDate || todayISODate();
  document.getElementById("entry-title").value = entry?.title || "";
  document.getElementById("entry-content").value = entry?.content || "";
  document.getElementById("entry-pinned").checked = !!entry?.pinned;
  entryModal.hidden = false;
}

document.getElementById("add-entry-btn").addEventListener("click", () => openEntryModal(null));
document.getElementById("entry-cancel").addEventListener("click", () => (entryModal.hidden = true));

entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("entry-id").value;
  const payload = {
    entry_date: document.getElementById("entry-date").value,
    title: document.getElementById("entry-title").value,
    content: document.getElementById("entry-content").value,
    pinned: document.getElementById("entry-pinned").checked,
  };

  if (id) {
    await supabase.from("diary_entries").update(payload).eq("id", id);
  } else {
    await supabase.from("diary_entries").insert(payload);
  }

  entryModal.hidden = true;
  await loadMonth();
});

async function deleteEntry(id) {
  if (!confirm("Delete this entry?")) return;
  await supabase.from("diary_entries").delete().eq("id", id);
  await loadMonth();
  renderDayEntries();
}

await loadMonth();
