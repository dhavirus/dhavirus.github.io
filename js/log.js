import { requireSession, signOut } from "./auth.js";
import { supabase } from "./supabaseClient.js";
import { bmr, tdee, targetKcal, scaleFood, sumMacros } from "./calc.js";
import { loadFoods, addCustomFood } from "./foods.js";
import { todayISODate } from "./dateUtils.js";

const session = await requireSession();
if (!session) throw new Error("redirecting to login");

document.getElementById("sign-out").addEventListener("click", (e) => {
  e.preventDefault();
  signOut();
});

const MEALS = ["breakfast", "lunch", "dinner"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

let foodsByName = new Map();
let rows = { breakfast: [], lunch: [], dinner: [] };
let dayTargetKcal = null;
const subtotalEls = {};

const mealsEl = document.getElementById("meals");
const dateInput = document.getElementById("log-date");
dateInput.value = todayISODate();

function emptyRow() {
  return { food_name: "", quantity: "" };
}

function rowMacros(row) {
  const food = foodsByName.get(row.food_name.trim().toLowerCase());
  const quantity = parseFloat(row.quantity);
  if (!food || !quantity || quantity <= 0) return null;
  const grams = quantity * (food.grams_per_unit || 1);
  return { ...scaleFood(food, grams), food_name: food.name, grams };
}

function renderMeals() {
  mealsEl.innerHTML = "";
  for (const meal of MEALS) {
    const section = document.createElement("section");
    section.className = "meal-section";
    const title = document.createElement("h2");
    title.textContent = MEAL_LABELS[meal];
    section.appendChild(title);

    const rowsContainer = document.createElement("div");
    rowsContainer.className = "meal-rows";

    rows[meal].forEach((row, index) => {
      rowsContainer.appendChild(renderRow(meal, index, row));
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "secondary meal-add-btn";
    addBtn.textContent = "+ Add food";
    addBtn.addEventListener("click", () => {
      rows[meal].push(emptyRow());
      renderMeals();
    });

    const subtotal = document.createElement("div");
    subtotal.className = "stat-row";
    subtotal.innerHTML = `<span class="stat-label">Subtotal</span><span class="stat-value"></span>`;
    subtotalEls[meal] = subtotal.querySelector(".stat-value");

    section.appendChild(rowsContainer);
    section.appendChild(addBtn);
    section.appendChild(subtotal);
    mealsEl.appendChild(section);
  }
  renderTotals();
}

function renderTotals() {
  for (const meal of MEALS) {
    const m = sumMacros(rows[meal].map(rowMacros).filter(Boolean));
    subtotalEls[meal].textContent = `${Math.round(m.kcal)} kcal  P${Math.round(m.proteinG)} F${Math.round(m.fatG)} C${Math.round(m.carbsG)}`;
  }
  renderDayTotals();
}

function renderRow(meal, index, row) {
  const rowEl = document.createElement("div");
  rowEl.className = "log-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.setAttribute("list", "foods-datalist");
  nameInput.placeholder = "Search food...";
  nameInput.value = row.food_name;

  const quantityInput = document.createElement("input");
  quantityInput.type = "number";
  quantityInput.className = "quantity-input";
  quantityInput.min = "0";
  quantityInput.step = "any";
  quantityInput.placeholder = "qty";
  quantityInput.value = row.quantity;

  const unitLabel = document.createElement("span");
  unitLabel.className = "unit-label";

  const macrosLabel = document.createElement("span");
  macrosLabel.className = "row-macros";

  function updateUnitLabel() {
    const food = foodsByName.get(row.food_name.trim().toLowerCase());
    unitLabel.textContent = food ? food.unit : "";
  }

  function updateMacrosLabel() {
    const m = rowMacros(row);
    macrosLabel.textContent = m
      ? `${Math.round(m.kcal)}kcal P${Math.round(m.protein_g)} F${Math.round(m.fat_g)} C${Math.round(m.carbs_g)}`
      : "";
  }
  updateUnitLabel();
  updateMacrosLabel();

  nameInput.addEventListener("input", () => {
    row.food_name = nameInput.value;
    updateUnitLabel();
    updateMacrosLabel();
    renderTotals();
  });
  quantityInput.addEventListener("input", () => {
    row.quantity = quantityInput.value;
    updateMacrosLabel();
    renderTotals();
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "secondary";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => {
    rows[meal].splice(index, 1);
    renderMeals();
  });

  rowEl.append(nameInput, quantityInput, unitLabel, macrosLabel, removeBtn);
  return rowEl;
}

function renderDayTotals() {
  const allRows = MEALS.flatMap((meal) => rows[meal].map(rowMacros).filter(Boolean));
  const t = sumMacros(allRows);
  const totalsEl = document.getElementById("day-totals");
  totalsEl.innerHTML = `
    <div class="stat-row emphasis">
      <span class="stat-label">Day total</span>
      <span class="stat-value">${Math.round(t.kcal)} kcal${dayTargetKcal ? ` / ${Math.round(dayTargetKcal)}` : ""}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Protein</span>
      <span class="stat-value">${Math.round(t.proteinG)} g</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Fat</span>
      <span class="stat-value">${Math.round(t.fatG)} g</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Carbs</span>
      <span class="stat-value">${Math.round(t.carbsG)} g</span>
    </div>
  `;
}

async function loadDayTarget() {
  const { data: profile } = await supabase
    .from("profile")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (!profile) return;
  const b = bmr(profile.sex, profile.weight_kg, profile.height_cm, profile.age);
  const t = tdee(b, profile.activity_level);
  dayTargetKcal = targetKcal(b, t, profile.goal, profile.rate_kg_per_week);
}

async function loadDay(date) {
  const { data } = await supabase.from("food_logs").select("*").eq("log_date", date);
  rows = { breakfast: [], lunch: [], dinner: [] };
  for (const meal of MEALS) {
    const mealRows = (data || [])
      .filter((r) => r.meal === meal)
      .map((r) => {
        const food = foodsByName.get(r.food_name.trim().toLowerCase());
        const gramsPerUnit = food?.grams_per_unit || 1;
        return { food_name: r.food_name, quantity: r.grams / gramsPerUnit };
      });
    rows[meal] = mealRows.length > 0 ? mealRows : [emptyRow()];
  }
  renderMeals();
}

dateInput.addEventListener("change", () => loadDay(dateInput.value));

document.getElementById("save-log").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  statusEl.textContent = "Saving...";

  const date = dateInput.value;
  await supabase.from("food_logs").delete().eq("log_date", date);

  const inserts = [];
  for (const meal of MEALS) {
    for (const row of rows[meal]) {
      const m = rowMacros(row);
      if (!m) continue;
      inserts.push({
        log_date: date,
        meal,
        food_name: m.food_name,
        grams: m.grams,
        kcal: m.kcal,
        protein_g: m.protein_g,
        fat_g: m.fat_g,
        carbs_g: m.carbs_g,
      });
    }
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from("food_logs").insert(inserts);
    statusEl.textContent = error ? "Something went wrong." : "Saved.";
  } else {
    statusEl.textContent = "Saved (empty day).";
  }
});

// --- Add custom food ---

const addFoodToggle = document.getElementById("add-food-toggle");
const addFoodForm = document.getElementById("add-food-form");
addFoodToggle.addEventListener("click", () => {
  addFoodForm.hidden = !addFoodForm.hidden;
});

addFoodForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const food = {
    name: document.getElementById("cf-name").value.trim(),
    kcal: parseFloat(document.getElementById("cf-kcal").value),
    protein_g: parseFloat(document.getElementById("cf-protein").value),
    fat_g: parseFloat(document.getElementById("cf-fat").value),
    carbs_g: parseFloat(document.getElementById("cf-carbs").value),
    unit: document.getElementById("cf-unit").value.trim() || "g",
    grams_per_unit: parseFloat(document.getElementById("cf-grams-per-unit").value) || 1,
  };
  const { error } = await addCustomFood(session.user.id, food);
  document.getElementById("status").textContent = error ? "Could not add food (name may already exist)." : "Food added.";
  if (!error) {
    addFoodForm.reset();
    addFoodForm.hidden = true;
    await refreshFoods();
  }
});

async function refreshFoods() {
  const foods = await loadFoods();
  foodsByName = new Map(foods.map((f) => [f.name.toLowerCase(), f]));
  const datalist = document.getElementById("foods-datalist");
  datalist.innerHTML = foods.map((f) => `<option value="${f.name}"></option>`).join("");
}

await refreshFoods();
await loadDayTarget();
await loadDay(dateInput.value);
