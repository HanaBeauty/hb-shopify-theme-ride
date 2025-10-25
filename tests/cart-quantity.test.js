const test = require('node:test');
const assert = require('node:assert/strict');

const { getQuantityValidationResult } = require('../assets/cart.js');

const strings = {
  min_error: 'You must add at least [min] items.',
  max_error: 'You can add at most [max] items.',
  step_error: 'Please add items in multiples of [step].',
};

test('returns min error when value is below minimum', () => {
  const result = getQuantityValidationResult({
    value: '1',
    min: '2',
    max: '10',
    step: '1',
    strings,
  });

  assert.equal(result.message, 'You must add at least 2 items.');
});

test('returns max error when value exceeds maximum', () => {
  const result = getQuantityValidationResult({
    value: '12',
    min: '1',
    max: '10',
    step: '1',
    strings,
  });

  assert.equal(result.message, 'You can add at most 10 items.');
});

test('returns step error when value does not match the step', () => {
  const result = getQuantityValidationResult({
    value: '5',
    min: '1',
    max: '10',
    step: '2',
    strings,
  });

  assert.equal(result.message, 'Please add items in multiples of 2.');
});

test('returns an empty message and parsed value when value is valid', () => {
  const result = getQuantityValidationResult({
    value: '4',
    min: '1',
    max: '10',
    step: '1',
    strings,
  });

  assert.deepEqual(result, { message: '', parsedValue: 4 });
});
