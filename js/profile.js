import { requireSession, signOut } from "./auth.js";
import { supabase } from "./supabaseClient.js";
import { bmr, tdee, targetKcal, macros, sumMacros, ACTIVITY_LABELS, ACTIVITY_MULTIPLIER } from "./calc.js";
import { barChart, pieChart, renderLegend } from "./svgChart.js";
import { monthGridDates, toISODate, todayISODate, monthLabel, WEEKDAY_LABELS } from "./dateUtils.js";

const session = await requireSession();
if (!session) throw new Error("redirecting to login");

document.getElementById("sign-out").addEventListener("click", (e) => {
  e.preventDefault();
  signOut();
});

const activitySelect = document.getElementById("activity_level");
activitySelect.innerHTML = Object.entries(ACTIVITY_LABELS)
  .map(([value, label]) => `<option value="${value}">${label}</option>`)
  .join("");

const form = document.getElementById("profile-form");
const statusEl = document.getElementById("status");

let macroTargets = null; // { proteinG, fatG, carbsG } — set once the profile loads
let todayTotals = null; // { proteinG, fatG, carbsG } — set once today's food log loads

function fieldsFromForm() {
  return {
    weight_kg: parseFloat(document.getElementById("weight_kg").value),
    height_cm: parseFloat(document.getElementById("height_cm").value),
    age: parseInt(document.getElementById("age").value, 10),
    sex: document.getElementById("sex").value,
    activity_level: document.getElementById("activity_level").value,
    goal: document.getElementById("goal").value,
    rate_kg_per_week: parseFloat(document.getElementById("rate_kg_per_week").value) || 0,
    protein_g_per_kg: parseFloat(document.getElementById("protein_g_per_kg").value),
  };
}

function populateForm(profile) {
  document.getElementById("weight_kg").value = profile.weight_kg;
  document.getElementById("height_cm").value = profile.height_cm;
  document.getElementById("age").value = profile.age;
  document.getElementById("sex").value = profile.sex;
  document.getElementById("activity_level").value = profile.activity_level;
  document.getElementById("goal").value = profile.goal;
  document.getElementById("rate_kg_per_week").value = profile.rate_kg_per_week;
  document.getElementById("protein_g_per_kg").value = profile.protein_g_per_kg;
}

function renderResults(fields) {
  const b = bmr(fields.sex, fields.weight_kg, fields.height_cm, fields.age);
  const t = tdee(b, fields.activity_level);
  const target = targetKcal(b, t, fields.goal, fields.rate_kg_per_week);
  const m = macros(fields.weight_kg, target, fields.protein_g_per_kg);

  const kpiRow = document.getElementById("kpi-row");
  kpiRow.hidden = false;
  kpiRow.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">BMR</div>
      <div class="kpi-value">${Math.round(b)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">TDEE</div>
      <div class="kpi-value">${Math.round(t)}</div>
    </div>
    <div class="kpi-card emphasis">
      <div class="kpi-label">Daily target (kcal)</div>
      <div class="kpi-value">${Math.round(target)}</div>
    </div>
  `;

  const macroSlices = [
    { label: "Protein", value: m.proteinG, colorVar: "--chart-protein", unit: "g" },
    { label: "Fat", value: m.fatG, colorVar: "--chart-fat", unit: "g" },
    { label: "Carbs", value: m.carbsG, colorVar: "--chart-carbs", unit: "g" },
  ];
  document.getElementById("macro-chart-card").hidden = false;
  pieChart(document.getElementById("chart-macros"), macroSlices);
  renderLegend(document.getElementById("macro-legend"), macroSlices);

  document.getElementById("small-multiples-card").hidden = false;
  renderSmallMultiples(fields, b);

  macroTargets = m;
  renderRemaining();
}

function renderSmallMultiples(fields, b) {
  const container = document.getElementById("chart-small-multiples");
  container.innerHTML = "";
  const goals = ["lose", "maintain", "gain"];

  const combos = Object.keys(ACTIVITY_MULTIPLIER).flatMap((activityLevel) =>
    goals.map((goal) => {
      const t = tdee(b, activityLevel);
      return { activityLevel, goal, t, target: targetKcal(b, t, goal, fields.rate_kg_per_week) };
    })
  );

  // Shared scale across all combos so bar heights are comparable cell to cell.
  const sharedMax = Math.max(...combos.flatMap((c) => [c.t, c.target])) * 1.15;

  for (const combo of combos) {
    const wrapper = document.createElement("div");
    const heading = document.createElement("div");
    heading.className = "small-multiple-label";
    heading.textContent = `${combo.activityLevel.replace("_", " ")} / ${combo.goal}`;
    wrapper.appendChild(heading);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    wrapper.appendChild(svg);
    barChart(
      svg,
      [
        { label: "TDEE", value: combo.t, colorVar: "--chart-tdee", unit: "" },
        { label: "Target", value: combo.target, colorVar: "--chart-target", unit: "" },
      ],
      { max: sharedMax }
    );

    container.appendChild(wrapper);
  }
}

async function loadProfile() {
  const { data } = await supabase
    .from("profile")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (data) {
    populateForm(data);
    renderResults(data);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fields = fieldsFromForm();
  statusEl.textContent = "Saving...";

  const { error } = await supabase
    .from("profile")
    .upsert({ user_id: session.user.id, ...fields, updated_at: new Date().toISOString() });

  statusEl.textContent = error ? "Something went wrong." : "Saved.";
  if (!error) renderResults(fields);
});

// --- Today's food summary ---

const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

async function loadFoodSummary() {
  const { data } = await supabase.from("food_logs").select("*").eq("log_date", todayISODate());
  const container = document.getElementById("food-summary-content");

  todayTotals = sumMacros(data || []);
  renderRemaining();

  if (!data || data.length === 0) {
    container.innerHTML = `<p class="food-summary-empty">Nothing logged yet today.</p>`;
    return;
  }

  const byMeal = { breakfast: [], lunch: [], dinner: [] };
  for (const row of data) byMeal[row.meal]?.push(row);

  const rows = Object.entries(MEAL_LABELS)
    .filter(([meal]) => byMeal[meal].length > 0)
    .map(([meal, label]) => {
      const mealTotal = sumMacros(byMeal[meal]);
      return `<div class="food-summary-meal"><span>${label}</span><span>${Math.round(mealTotal.kcal)} kcal</span></div>`;
    })
    .join("");

  container.innerHTML = `
    ${rows}
    <div class="food-summary-meal"><strong>Total</strong><strong>${Math.round(todayTotals.kcal)} kcal</strong></div>
  `;
}

// --- Remaining today: progress vs macro targets, with a fat-overage alert ---

function progressBar(label, consumed, target, colorVar) {
  const pct = target > 0 ? (consumed / target) * 100 : 0;
  const over = consumed > target;
  const displayPct = Math.min(pct, 100);
  return `
    <div class="progress-item">
      <div class="progress-label">
        <span class="progress-name">${label}</span>
        <span class="progress-numbers">${Math.round(consumed)} / ${Math.round(target)} g</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill${over ? " over" : ""}" style="width:${displayPct}%; background:var(${colorVar});"></div>
      </div>
    </div>
  `;
}

function renderRemaining() {
  if (!macroTargets || !todayTotals) return;

  const card = document.getElementById("remaining-card");
  card.hidden = false;

  const fatOver = todayTotals.fatG > macroTargets.fatG;
  const fatOverBy = Math.round(todayTotals.fatG - macroTargets.fatG);

  document.getElementById("remaining-content").innerHTML = `
    ${progressBar("Protein", todayTotals.proteinG, macroTargets.proteinG, "--chart-protein")}
    ${progressBar("Fat", todayTotals.fatG, macroTargets.fatG, "--chart-fat")}
    ${progressBar("Carbs", todayTotals.carbsG, macroTargets.carbsG, "--chart-carbs")}
    ${fatOver ? `<p class="progress-alert">You're ${fatOverBy}g over your fat target today.</p>` : ""}
  `;
}

// --- Mini calendar + this month's stats ---

async function loadMiniCalendarAndStats() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const gridDates = monthGridDates(year, month);
  const rangeStart = toISODate(gridDates[0]);
  const rangeEnd = toISODate(gridDates[gridDates.length - 1]);

  const [{ data: entries }, { data: logs }] = await Promise.all([
    supabase.from("diary_entries").select("entry_date, pinned").gte("entry_date", rangeStart).lte("entry_date", rangeEnd),
    supabase.from("food_logs").select("log_date").gte("log_date", rangeStart).lte("log_date", rangeEnd),
  ]);

  const pinnedDates = new Set((entries || []).filter((e) => e.pinned).map((e) => e.entry_date));
  const loggedDates = new Set((logs || []).map((l) => l.log_date));

  // Grid dates include a few padding days from adjacent months; stats should
  // only count days actually inside this month.
  const monthStart = toISODate(new Date(year, month, 1));
  const monthEnd = toISODate(new Date(year, month + 1, 0));
  const inMonth = (iso) => iso >= monthStart && iso <= monthEnd;
  const entriesThisMonth = (entries || []).filter((e) => inMonth(e.entry_date)).length;
  const pinnedThisMonth = [...pinnedDates].filter(inMonth).length;
  const loggedThisMonth = [...loggedDates].filter(inMonth).length;

  document.getElementById("mini-cal-title").textContent = monthLabel(year, month);

  const weekdaysEl = document.getElementById("mini-cal-weekdays");
  weekdaysEl.innerHTML = WEEKDAY_LABELS.map((l) => `<div class="calendar-weekday">${l[0]}</div>`).join("");

  const today = todayISODate();
  const daysEl = document.getElementById("mini-cal-days");
  daysEl.innerHTML = "";
  for (const date of gridDates) {
    const iso = toISODate(date);
    const isOutside = date.getMonth() !== month;
    const cell = document.createElement("div");
    cell.className = "calendar-day" + (isOutside ? " outside-month" : "") + (iso === today ? " today" : "");
    cell.innerHTML = `
      <div class="day-header">
        <span class="day-number">${date.getDate()}</span>
        <span class="markers">
          ${pinnedDates.has(iso) ? '<span class="badge-pin">★</span>' : ""}${loggedDates.has(iso) ? '<span class="badge-logged"></span>' : ""}
        </span>
      </div>
    `;
    daysEl.appendChild(cell);
  }

  document.getElementById("month-stats").innerHTML = `
    <div class="stat-row"><span class="stat-label">Entries this month</span><span class="stat-value">${entriesThisMonth}</span></div>
    <div class="stat-row"><span class="stat-label">Pinned</span><span class="stat-value">${pinnedThisMonth}</span></div>
    <div class="stat-row"><span class="stat-label">Days logged</span><span class="stat-value">${loggedThisMonth}</span></div>
  `;
}

// --- Today's diary entry ---

async function loadTodayEntry() {
  const { data } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("entry_date", todayISODate())
    .order("created_at", { ascending: true });

  const container = document.getElementById("today-entry-content");

  if (!data || data.length === 0) {
    container.innerHTML = `<a href="entry.html"><button class="secondary">+ Add today's entry</button></a>`;
    return;
  }

  container.innerHTML = data
    .map(
      (entry) => `
        <a href="entry.html?id=${entry.id}" class="food-summary-meal">
          <span>${entry.pinned ? "★ " : ""}${escapeHtml(entry.title)}</span>
        </a>
      `
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

await Promise.all([loadProfile(), loadFoodSummary(), loadMiniCalendarAndStats(), loadTodayEntry()]);
