import { requireSession, signOut } from "./auth.js";
import { supabase } from "./supabaseClient.js";
import { bmr, tdee, targetKcal, macros, ACTIVITY_LABELS, ACTIVITY_MULTIPLIER } from "./calc.js";
import { barChart } from "./svgChart.js";

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

  document.getElementById("results").hidden = false;
  document.getElementById("targets-stat-list").innerHTML = `
    <div class="stat-row">
      <span class="stat-label">BMR</span>
      <span class="stat-value">${Math.round(b)} kcal</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">TDEE</span>
      <span class="stat-value">${Math.round(t)} kcal</span>
    </div>
    <div class="stat-row emphasis">
      <span class="stat-label">Daily target</span>
      <span class="stat-value">${Math.round(target)} kcal</span>
    </div>
  `;

  barChart(
    document.getElementById("chart-target-tdee"),
    [
      { label: "TDEE", value: t, colorVar: "--chart-tdee", unit: " kcal" },
      { label: "Target", value: target, colorVar: "--chart-target", unit: " kcal" },
    ]
  );

  barChart(
    document.getElementById("chart-macros"),
    [
      { label: "Protein", value: m.proteinG, colorVar: "--chart-protein", unit: "g" },
      { label: "Fat", value: m.fatG, colorVar: "--chart-fat", unit: "g" },
      { label: "Carbs", value: m.carbsG, colorVar: "--chart-carbs", unit: "g" },
    ]
  );

  renderSmallMultiples(fields, b);
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

await loadProfile();
