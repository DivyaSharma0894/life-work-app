import test from 'node:test';
import assert from 'node:assert/strict';
import { bmi, bmiBand, bmr, calorieNeeds } from '../src/calories.js';

test('bmi and band', () => {
  assert.equal(bmi(70, 175), 22.9);
  assert.equal(bmiBand(22.9), 'Healthy range');
  assert.equal(bmiBand(17), 'Underweight');
  assert.equal(bmiBand(27), 'Overweight');
  assert.equal(bmiBand(31), 'Obese');
  assert.equal(bmi(0, 175), null);
});

test('bmr uses Mifflin-St Jeor', () => {
  assert.equal(bmr({ sex: 'male', age: 30, weightKg: 80, heightCm: 180 }), 1780);
  assert.equal(bmr({ sex: 'female', age: 30, weightKg: 60, heightCm: 165 }), 1320);
  assert.equal(bmr({ sex: 'female', age: NaN, weightKg: 60, heightCm: 165 }), null);
});

test('lose, maintain and gain targets', () => {
  const base = { sex: 'female', age: 30, weightKg: 60, heightCm: 165, activity: 'moderate' };
  const m = calorieNeeds({ ...base, goal: 'maintain' });
  assert.equal(m.maintenance, 2046);
  assert.equal(m.target, 2046);
  const lose = calorieNeeds({ ...base, goal: 'lose', kgPerWeek: 0.5 });
  assert.equal(lose.target, 2046 - 550);
  assert.equal(lose.kgPerWeek, 0.5);
  const gain = calorieNeeds({ ...base, goal: 'gain', kgPerWeek: 0.25 });
  assert.equal(gain.target, 2046 + 275);
});

test('safe limits', () => {
  const base = { sex: 'female', age: 30, weightKg: 50, heightCm: 160, activity: 'sedentary' };
  const fast = calorieNeeds({ ...base, goal: 'lose', kgPerWeek: 1 });
  assert.equal(fast.target, 1200);
  assert.ok(fast.notes.some((n) => n.includes('too low')));
  const over = calorieNeeds({ ...base, goal: 'gain', kgPerWeek: 3 });
  assert.ok(over.notes.some((n) => n.includes('not recommended')));
  assert.equal(over.kgPerWeek, 1);
  const thin = calorieNeeds({ sex: 'female', age: 25, weightKg: 40, heightCm: 170, activity: 'light', goal: 'lose', kgPerWeek: 0.5 });
  assert.ok(thin.notes.some((n) => n.includes('doctor')));
  assert.equal(calorieNeeds({ sex: 'male', age: '', weightKg: 70, heightCm: 170, goal: 'lose' }), null);
});
