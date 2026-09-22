import { supabase } from "./supabaseClient.js";

// Merged list of seed + custom foods, all normalized to
// { name, kcal, protein_g, fat_g, carbs_g, unit, grams_per_unit } per 100g,
// where unit/grams_per_unit let the log UI ask for "2 eggs" instead of
// "100g" — quantity * grams_per_unit gives the true grams. Foods without a
// natural discrete serving just use unit "g" with grams_per_unit 1, so
// quantity IS grams.
export async function loadFoods() {
  const [seedRes, customRes] = await Promise.all([
    fetch("data/foods.seed.json").then((r) => r.json()),
    supabase.from("custom_foods").select("*"),
  ]);

  const seed = seedRes.map((f) => ({
    ...f,
    unit: f.unit || "g",
    grams_per_unit: f.grams_per_unit || 1,
  }));

  const custom = (customRes.data || []).map((f) => ({
    name: f.name,
    kcal: f.kcal_per_100g,
    protein_g: f.protein_g_per_100g,
    fat_g: f.fat_g_per_100g,
    carbs_g: f.carbs_g_per_100g,
    unit: f.unit || "g",
    grams_per_unit: f.grams_per_unit || 1,
  }));

  return [...seed, ...custom].sort((a, b) => a.name.localeCompare(b.name));
}

export async function addCustomFood(userId, food) {
  const { error } = await supabase.from("custom_foods").insert({
    user_id: userId,
    name: food.name,
    kcal_per_100g: food.kcal,
    protein_g_per_100g: food.protein_g,
    fat_g_per_100g: food.fat_g,
    carbs_g_per_100g: food.carbs_g,
    unit: food.unit || "g",
    grams_per_unit: food.grams_per_unit || 1,
  });
  return { error };
}
