// Pure functions, no DOM/Supabase dependency — see test/calc.test.html.

export const ACTIVITY_MULTIPLIER = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS = {
  sedentary: "Sedentary (little/no exercise)",
  light: "Light (1-3 days/week)",
  moderate: "Moderate (3-5 days/week)",
  active: "Active (6-7 days/week)",
  very_active: "Very active (physical job or 2x/day)",
};

export const KCAL_PER_KG = 7700;

export function bmr(sex, weightKg, heightCm, age) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function tdee(bmrValue, activityLevel) {
  return bmrValue * ACTIVITY_MULTIPLIER[activityLevel];
}

// Never lets the target drop below BMR, even for an aggressive loss rate.
export function targetKcal(bmrValue, tdeeValue, goal, rateKgPerWeek) {
  const dailyDelta = (Math.abs(rateKgPerWeek) * KCAL_PER_KG) / 7;
  if (goal === "lose") return Math.max(tdeeValue - dailyDelta, bmrValue);
  if (goal === "gain") return tdeeValue + dailyDelta;
  return tdeeValue;
}

// protein/fat/carbs in grams and % of target kcal. Carbs floor at 0 kcal if
// protein+fat already consume the whole budget (e.g. very high protein g/kg
// combined with a low target).
export function macros(weightKg, targetKcalValue, proteinGPerKg) {
  const proteinG = weightKg * proteinGPerKg;
  const proteinKcal = proteinG * 4;
  const fatKcal = targetKcalValue * 0.25;
  const fatG = fatKcal / 9;
  const carbsKcal = Math.max(targetKcalValue - proteinKcal - fatKcal, 0);
  const carbsG = carbsKcal / 4;

  const pct = (kcal) => (targetKcalValue > 0 ? (kcal / targetKcalValue) * 100 : 0);

  return {
    proteinG,
    fatG,
    carbsG,
    proteinPct: pct(proteinKcal),
    fatPct: pct(fatKcal),
    carbsPct: pct(carbsKcal),
  };
}

// Convenience: sum macros for a set of food-log rows (each with
// kcal/protein_g/fat_g/carbs_g already computed for its grams).
export function sumMacros(rows) {
  return rows.reduce(
    (acc, r) => ({
      kcal: acc.kcal + r.kcal,
      proteinG: acc.proteinG + r.protein_g,
      fatG: acc.fatG + r.fat_g,
      carbsG: acc.carbsG + r.carbs_g,
    }),
    { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }
  );
}

// Scale a per-100g food entry to the eaten grams.
export function scaleFood(food, grams) {
  const factor = grams / 100;
  return {
    kcal: food.kcal * factor,
    protein_g: food.protein_g * factor,
    fat_g: food.fat_g * factor,
    carbs_g: food.carbs_g * factor,
  };
}
