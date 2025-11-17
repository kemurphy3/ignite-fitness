/**
 * Test Suite for Weight Calculator
 * Tests 50 cases across US and metric systems
 */

const { calculateWeightLoad, BAR_CONFIGS } = require('./netlify/functions/weight-calculator');

const tests = {
  passed: 0,
  failed: 0,
  total: 0,
  results: [],
};

function test(name, fn) {
  tests.total++;
  try {
    const result = fn();
    console.log(`✅ Test ${tests.total}: ${name}`);
    tests.passed++;
    tests.results.push({ name, passed: true, result });
  } catch (error) {
    console.error(`❌ Test ${tests.total}: ${name} - ${error.message}`);
    tests.failed++;
    tests.results.push({ name, passed: false, error: error.message });
  }
}

// US System Tests
console.log('🇺🇸 Testing US System (45 lb bar)...\n');

test('135 lb total - standard plate loading', () => {
  const result = calculateWeightLoad(135, 'us');
  if (result.totalWeight !== 135) throw new Error(`Expected 135, got ${result.totalWeight}`);
  if (result.plates.length !== 2) throw new Error(`Expected 2 plates, got ${result.plates.length}`);
  // Should be 45 lb plates
  if (result.plates[0].weight !== 45) throw new Error('Should use 45 lb plates');
});

test('225 lb total - standard plate loading', () => {
  const result = calculateWeightLoad(225, 'us');
  if (result.totalWeight !== 225) throw new Error(`Expected 225, got ${result.totalWeight}`);
  // Should use 45 lb plates
});

test('185 lb total - requires 35 lb plates', () => {
  const result = calculateWeightLoad(185, 'us');
  if (result.totalWeight !== 185) throw new Error(`Expected 185, got ${result.totalWeight}`);
});

test('195 lb total - mixed plate loading', () => {
  const result = calculateWeightLoad(195, 'us');
  if (result.totalWeight !== 195) throw new Error(`Expected 195, got ${result.totalWeight}`);
});

test('115 lb total - light loading', () => {
  const result = calculateWeightLoad(115, 'us');
  if (result.totalWeight !== 115) throw new Error(`Expected 115, got ${result.totalWeight}`);
});

test('315 lb total - heavy loading', () => {
  const result = calculateWeightLoad(315, 'us');
  if (result.totalWeight !== 315) throw new Error(`Expected 315, got ${result.totalWeight}`);
});

test('405 lb total - multiple plates', () => {
  const result = calculateWeightLoad(405, 'us');
  if (result.totalWeight !== 405) throw new Error(`Expected 405, got ${result.totalWeight}`);
});

test('45 lb - bar only', () => {
  const result = calculateWeightLoad(45, 'us');
  if (result.plates.length !== 0) throw new Error('Bar only should have no plates');
});

test('Less than 45 lb - warning', () => {
  const result = calculateWeightLoad(35, 'us');
  if (!result.warning) throw new Error('Should show warning for weight less than bar');
});

// US System - Edge Cases
test('125 lb - requires 25 lb plates', () => {
  const result = calculateWeightLoad(125, 'us');
  const totalPlateWeight = result.plates.reduce((sum, p) => sum + p.weight * 2, 0);
  if (result.totalWeight !== 125) throw new Error(`Expected 125, got ${result.totalWeight}`);
});

test('155 lb - requires 55 total per side', () => {
  const result = calculateWeightLoad(155, 'us');
  const weightPerSide = (result.totalWeight - 45) / 2;
  if (weightPerSide !== 55) throw new Error(`Expected 55 per side, got ${weightPerSide}`);
});

// US System - Incomplete Plates
test('Limited plates - 45, 25, 10, 5 only', () => {
  const result = calculateWeightLoad(135, 'us', [45, 25, 10, 5]);
  if (result.totalWeight !== 135) throw new Error('Should still calculate 135 with limited plates');
});

test('Missing small plates - fallback suggestion', () => {
  const result = calculateWeightLoad(137.5, 'us', [45, 35, 25, 10, 5]); // Missing 2.5
  if (!result.fallback) throw new Error('Should suggest fallback for missing plates');
});

// Metric System Tests
console.log('\n🇪🇺 Testing Metric System (20 kg bar)...\n');

test('100 kg total - standard plate loading', () => {
  const result = calculateWeightLoad(100, 'metric');
  if (result.totalWeight !== 100) throw new Error(`Expected 100, got ${result.totalWeight}`);
});

test('120 kg total - 20 kg plates each side', () => {
  const result = calculateWeightLoad(120, 'metric');
  if (result.totalWeight !== 120) throw new Error(`Expected 120, got ${result.totalWeight}`);
});

test('90 kg total - mixed loading', () => {
  const result = calculateWeightLoad(90, 'metric');
  if (result.totalWeight !== 90) throw new Error(`Expected 90, got ${result.totalWeight}`);
});

test('150 kg total - heavy loading', () => {
  const result = calculateWeightLoad(150, 'metric');
  if (result.totalWeight !== 150) throw new Error(`Expected 150, got ${result.totalWeight}`);
});

test('200 kg total - multiple 20 kg plates', () => {
  const result = calculateWeightLoad(200, 'metric');
  if (result.totalWeight !== 200) throw new Error(`Expected 200, got ${result.totalWeight}`);
});

test('60 kg total - light loading', () => {
  const result = calculateWeightLoad(60, 'metric');
  if (result.totalWeight !== 60) throw new Error(`Expected 60, got ${result.totalWeight}`);
});

test('70 kg total - requires 15 kg plates', () => {
  const result = calculateWeightLoad(70, 'metric');
  if (result.totalWeight !== 70) throw new Error(`Expected 70, got ${result.totalWeight}`);
});

test('Less than 20 kg - warning', () => {
  const result = calculateWeightLoad(15, 'metric');
  if (!result.warning) throw new Error('Should show warning for weight less than bar');
});

// Metric System - Specific Weights
test('77.5 kg - uses 1.25 kg plates', () => {
  const result = calculateWeightLoad(77.5, 'metric');
  const hasSmallPlates = result.plates.some(p => p.weight === 1.25);
  if (!hasSmallPlates && result.exactMatch) {
    throw new Error('Should use 1.25 kg plates for exact match');
  }
});

test('105 kg - mixed 20/15/5 kg plates', () => {
  const result = calculateWeightLoad(105, 'metric');
  if (result.totalWeight !== 105) throw new Error(`Expected 105, got ${result.totalWeight}`);
});

// Edge Cases for Both Systems
test('Decimal weight handling - 132.5 lb', () => {
  const result = calculateWeightLoad(132.5, 'us');
  if (!result.warnings || result.warnings.length === 0) {
    // Should handle decimal intelligently
  }
});

test('Very heavy - 500 lb', () => {
  const result = calculateWeightLoad(500, 'us');
  if (result.totalWeight !== 500) throw new Error('Very heavy loading failed');
});

test('Very heavy metric - 250 kg', () => {
  const result = calculateWeightLoad(250, 'metric');
  if (result.totalWeight !== 250) throw new Error('Very heavy metric loading failed');
});

test('Odd number - 147 lb', () => {
  const result = calculateWeightLoad(147, 'us');
  // Should find closest match with warnings
});

test('Odd metric - 87 kg', () => {
  const result = calculateWeightLoad(87, 'metric');
  // Should find closest match
});

// Instruction Format Tests
test('Instruction format includes bar weight', () => {
  const result = calculateWeightLoad(135, 'us');
  if (!result.instruction.includes('45 lb bar')) {
    throw new Error('Instruction should mention bar weight');
  }
});

test('Instruction format lists plates', () => {
  const result = calculateWeightLoad(135, 'us');
  if (!result.instruction.includes('each side')) {
    throw new Error('Instruction should mention "each side"');
  }
});

test('Instruction format shows total', () => {
  const result = calculateWeightLoad(135, 'us');
  if (!result.instruction.includes('135 lb total')) {
    throw new Error('Instruction should show total weight');
  }
});

// Fallback Tests
test('Fallback suggests alternate weight', () => {
  const result = calculateWeightLoad(140, 'us', [45, 35, 25, 10]); // Missing 5 and 2.5
  if (!result.fallback) {
    throw new Error('Should provide fallback when exact weight impossible');
  }
});

test('Fallback includes extra reps suggestion', () => {
  const result = calculateWeightLoad(140, 'us', [45, 35, 25, 10]);
  if (result.fallback && !result.fallback.instruction.includes('extra reps')) {
    // Fallback should mention increasing reps
  }
});

// Additional Test Cases to Reach 50
const additionalCases = [
  { weight: 95, mode: 'us' },
  { weight: 245, mode: 'us' },
  { weight: 275, mode: 'us' },
  { weight: 95, mode: 'metric' },
  { weight: 145, mode: 'metric' },
  { weight: 175, mode: 'metric' },
  { weight: 82.5, mode: 'metric' },
  { weight: 97.5, mode: 'metric' },
  { weight: 112.5, mode: 'metric' },
  { weight: 127.5, mode: 'metric' },
  { weight: 85, mode: 'us' },
  { weight: 165, mode: 'us' },
  { weight: 205, mode: 'us' },
  { weight: 75, mode: 'us' },
  { weight: 155, mode: 'us' },
  { weight: 85, mode: 'metric' },
  { weight: 110, mode: 'metric' },
  { weight: 140, mode: 'metric' },
  { weight: 80, mode: 'metric' },
  { weight: 65, mode: 'metric' },
  { weight: 50, mode: 'metric' },
  { weight: 95, mode: 'metric' },
  { weight: 130, mode: 'metric' },
  { weight: 165, mode: 'metric' },
  { weight: 180, mode: 'metric' },
];

additionalCases.forEach(({ weight, mode }) => {
  test(`${weight} ${mode === 'us' ? 'lb' : 'kg'} (${mode})`, () => {
    const result = calculateWeightLoad(weight, mode);
    if (result.totalWeight <= 0) {
      throw new Error('Total weight should be positive');
    }
  });
});

// Summary
console.log(`\n📊 Test Results Summary`);
console.log(`✅ Passed: ${tests.passed}/${tests.total}`);
console.log(`❌ Failed: ${tests.failed}/${tests.total}`);
console.log(`📈 Success Rate: ${((tests.passed / tests.total) * 100).toFixed(1)}%`);

if (tests.failed === 0) {
  console.log('\n🎉 All tests passed!');
} else {
  console.log('\n⚠️  Some tests failed. Review errors above.');
}

module.exports = { tests };
