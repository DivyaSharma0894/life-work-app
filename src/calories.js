// Calorie calculator. Pure functions, no screen code.
// BMR uses the Mifflin-St Jeor equation. One kilogram of body weight is roughly 7,700 kcal.

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Little or no exercise (desk job)', factor: 1.2 },
  { id: 'light', label: 'Light exercise 1 to 3 days a week', factor: 1.375 },
  { id: 'moderate', label: 'Moderate exercise 3 to 5 days a week', factor: 1.55 },
  { id: 'high', label: 'Hard exercise 6 to 7 days a week', factor: 1.725 },
  { id: 'athlete', label: 'Very hard exercise or a physical job', factor: 1.9 }
];

export const KCAL_PER_KG = 7700;
export const MAX_KG_PER_WEEK = 1;

export function bmi(weightKg, heightCm) {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiBand(v) {
  if (v == null) return '';
  if (v < 18.5) return 'Underweight';
  if (v < 25) return 'Healthy range';
  if (v < 30) return 'Overweight';
  return 'Obese';
}

/** Basic calories your body burns at rest. sex is "female" or "male". */
export function bmr({ sex, age, weightKg, heightCm }) {
  if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161));
}

/**
 * input: { sex, age, weightKg, heightCm, activity (id), goal: 'lose'|'maintain'|'gain', kgPerWeek }
 * Returns null if something is missing, else { bmi, band, bmr, maintenance, target, change, kgPerWeek, floor, notes[] }.
 */
export function calorieNeeds(input) {
  const { sex, age, weightKg, heightCm, activity, goal } = input;
  const base = bmr({ sex, age, weightKg, heightCm });
  if (base == null) return null;
  const level = ACTIVITY_LEVELS.find((a) => a.id === activity) || ACTIVITY_LEVELS[0];
  const maintenance = Math.round(base * level.factor);
  const notes = [];
  let rate = Math.max(0, Math.min(MAX_KG_PER_WEEK, Number(input.kgPerWeek) || 0));
  if (Number(input.kgPerWeek) > MAX_KG_PER_WEEK) notes.push(`A change of more than ${MAX_KG_PER_WEEK} kg a week is not recommended, so ${MAX_KG_PER_WEEK} kg was used.`);
  if (goal === 'maintain') rate = 0;
  const dir = goal === 'lose' ? -1 : goal === 'gain' ? 1 : 0;
  let target = Math.round(maintenance + dir * ((rate * KCAL_PER_KG) / 7));
  const floor = sex === 'male' ? 1500 : 1200;
  if (dir < 0 && target < floor) {
    notes.push(`That pace would go below ${floor} kcal a day, which is too low without medical supervision. ${floor} kcal is shown instead.`);
    target = floor;
  }
  const change = target - maintenance;
  const realRate = Math.round((Math.abs(change) * 7 / KCAL_PER_KG) * 100) / 100;
  const b = bmi(weightKg, heightCm);
  if (goal === 'lose' && b != null && b < 18.5) notes.push('Your BMI is already in the underweight range. Please talk to a doctor before trying to lose weight.');
  if (goal === 'gain' && b != null && b >= 30) notes.push('Your BMI is in the obese range. Please talk to a doctor before trying to gain weight.');
  return { bmi: b, band: bmiBand(b), bmr: base, maintenance, target, change, kgPerWeek: realRate, floor, notes };
}
