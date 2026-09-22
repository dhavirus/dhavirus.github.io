import { requireSession, signOut } from "./auth.js";
import { supabase } from "./supabaseClient.js";
import {
  monthGridDates,
  toISODate,
  todayISODate,
  WEEKDAY_LABELS,
  monthLabel,
} from "./dateUtils.js";
import { getSignedUrl, deleteImages, extractImagePaths } from "./storage.js";

const session = await requireSession();
if (!session) throw new Error("redirecting to login");

document.getElementById("sign-out").addEventListener("click", (e) => {
  e.preventDefault();
  signOut();
});

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let entriesByDate = new Map(); // isoDate -> entry[]
let loggedDates = new Set();

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
          ${hasPinned ? '<span class="badge-pin" title="Pinned">★</span>' : ""}${hasLog ? '<span class="badge-logged" title="Food logged"></span>' : ""}
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

// --- Blog-style board (cover page) ---

function plainTextExcerpt(html, len) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = div.textContent || "";
  return text.length > len ? text.slice(0, len).trimEnd() + "…" : text;
}

function formatCardDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

async function loadBoard() {
  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .order("pinned", { ascending: false })
    .order("entry_date", { ascending: false })
    .limit(100);

  const grid = document.getElementById("board-grid");

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<p class="board-empty">No entries yet — write your first one.</p>`;
    return;
  }

  grid.innerHTML = "";
  for (const [i, entry] of data.entries()) {
    const card = document.createElement("article");
    card.className = entry.pinned ? "board-card tint-1 featured" : `board-card tint-${(i % 4) + 1}`;

    const thumbnailUrl = entry.thumbnail_path ? await getSignedUrl(entry.thumbnail_path) : null;

    card.innerHTML = `
      ${thumbnailUrl ? `<img class="board-card-thumb" src="${thumbnailUrl}" alt="" />` : ""}
      <div class="board-card-date">${formatCardDate(entry.entry_date)}</div>
      <h3 class="entry-font-${entry.font}">${entry.pinned ? "★ " : ""}${escapeHtml(entry.title)}</h3>
      <p class="board-card-excerpt">${escapeHtml(plainTextExcerpt(entry.content, entry.pinned ? 220 : 100))}</p>
    `;
    card.addEventListener("click", () => {
      window.location.href = `entry.html?id=${entry.id}`;
    });
    grid.appendChild(card);
  }
}

// --- Day detail modal ---

const dayModal = document.getElementById("day-modal");
const dayModalTitle = document.getElementById("day-modal-title");
const dayEntriesList = document.getElementById("day-entries-list");
let dayModalDate = null;

function openDayModal(iso) {
  dayModalDate = iso;
  dayModalTitle.textContent = iso;
  document.getElementById("day-add-entry").href = `entry.html?date=${iso}`;
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
          <a href="entry.html?id=${entry.id}"><button class="secondary">Edit</button></a>
          <button class="secondary" data-action="delete">Delete</button>
        </div>
      </div>
      <p>${escapeHtml(plainTextExcerpt(entry.content, 200))}</p>
    `;
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

async function deleteEntry(id) {
  if (!confirm("Delete this entry?")) return;

  const { data: entry } = await supabase.from("diary_entries").select("content, thumbnail_path").eq("id", id).maybeSingle();
  const paths = [...extractImagePaths(entry?.content), entry?.thumbnail_path].filter(Boolean);

  await supabase.from("diary_entries").delete().eq("id", id);
  await deleteImages(paths);
  await Promise.all([loadMonth(), loadBoard()]);
  renderDayEntries();
}

await Promise.all([loadMonth(), loadBoard()]);
