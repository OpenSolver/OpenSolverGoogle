// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

function utilTest() {

QUnit.module('util');


var relations = ['GE', 'LE', 'EQ', 'INT', 'BIN', 'ALLDIFF'];
var strings = ['>=', '<=', '==', 'int', 'bin', 'alldiff'];
var hasRHS = [true, true, true, false, false, false];

QUnit.test('relationConstToString', relations.length, function(assert) {
  for (var i = 0; i < relations.length; i++) {
    var relation = relations[i];
    var result = strings[i];
    assert.equal(OpenSolver.util.relationConstToString(OpenSolver.consts.relation[relation]), result, relation + rightArrow + result);
  }
});

QUnit.test('relationConstHasRHS', relations.length, function(assert) {
  for (var i = 0; i < relations.length; i++) {
    var relation = relations[i];
    var result = hasRHS[i];
    assert.equal(OpenSolver.util.relationConstHasRHS(OpenSolver.consts.relation[relation]), result, relation + rightArrow + result);
  }
});

var nonNegStrings = ['TRUE', 'FALSE'];
var nonNegBools = [true, false];

QUnit.test('assumeNonNeg' + '\u2194' + 'Boolean conversion', nonNegStrings.length * 2, function(assert) {
  for (var i = 0; i < nonNegStrings.length; i++) {
    var nonNegString = nonNegStrings[i];
    var nonNegBool = nonNegBools[i];
    assert.equal(OpenSolver.util.assumeNonNegToBoolean(OpenSolver.consts.assumeNonNeg[nonNegString]), nonNegBool, nonNegString + rightArrow + nonNegBool);
    assert.equal(OpenSolver.util.assumeNonNegFromBoolean(nonNegBool), OpenSolver.consts.assumeNonNeg[nonNegString], nonNegString + leftArrow + nonNegBool);
  }
});

var errorValues = ['#DIV/0!', '#NUM!', '#N/A', '#VALUE!'];

QUnit.test('valueIsError', errorValues.length, function(assert) {
  for (var i = 0; i < errorValues.length; i++) {
    var value = errorValues[i];
    assert.ok(OpenSolver.util.valueIsError(value), value + tick);

  }
});

QUnit.test('createArray', 4, function(assert) {
  var array1 = OpenSolver.util.createArray(0);
  assert.equal(array1.length, 0, 'createArray(0) has length 0' + tick);

  var array2 = OpenSolver.util.createArray(1);
  assert.equal(array2.length, 1, 'createArray(1) has length 1' + tick);

  var array3 = OpenSolver.util.createArray(2, 3);
  assert.ok((array3.length == 2) && (array3[0].length == 3), 'createArray(2, 3) has dimension 2x3' + tick);

  var array4 = OpenSolver.util.createArray(2, 3, 4);
  assert.ok((array4.length == 2) && (array4[0].length == 3) && (array4[0][0].length == 4),
            'createArray(2, 3, 4) has dimension 2x3x4' + tick);
});

QUnit.test('checkValueIsNumeric', 3 + errorValues.length, function(assert) {
  var errorNotNumeric = function() { return 'numeric' };
  var errorInvalid = function() { return 'invalid' };

  assert.equal(OpenSolver.util.checkValueIsNumeric(10, errorInvalid, errorNotNumeric),
               10,
               'Number returns actual value');
  assert.equal(OpenSolver.util.checkValueIsNumeric('', errorInvalid, errorNotNumeric),
               0,
               'Empty string is converted to zero and returns this');
  assert.throws(function () {
                  OpenSolver.util.checkValueIsNumeric('abc', errorInvalid, errorNotNumeric);
                },
                /numeric/,
                'Non-numeric cell throws error');

  for (var i = 0; i < errorValues.length; i++) {
    var errorValue = errorValues[i];
    assert.throws(function () {
                    OpenSolver.util.checkValueIsNumeric(errorValue, errorInvalid, errorNotNumeric);
                  },
                  /invalid/,
                  'Error cell (' + errorValue + ') throws error');
  }
});

QUnit.test('checkRangeValuesNumeric', 4, function(assert) {
  var errorNotNumeric = function(cellName) { return 'numeric' };
  var errorInvalid = function(cellName) { return 'invalid' };

  var values1 = [[1, 2, 3], [4, 5, 6]];
  var range1 = new OpenSolver.MockRange(values1);
  assert.deepEqual(OpenSolver.util.checkRangeValuesNumeric(range1, errorInvalid, errorNotNumeric),
                   values1,
                   'All numbers returns actual values');

  var values2 = [[1, 2, ''], [4, '', 6]];
  var range2 = new OpenSolver.MockRange(values2);
  values2[0][2] = 0;
  values2[1][1] = 0;
  assert.deepEqual(OpenSolver.util.checkRangeValuesNumeric(range2, errorInvalid, errorNotNumeric),
                   values2,
                   'Empty cells converted to zeros');

  var values3 = [[1, 2, 3], ['abc', 5, 6]];
  var range3 = new OpenSolver.MockRange(values3);
  assert.throws(function () {
                  OpenSolver.util.checkRangeValuesNumeric(range3, errorInvalid, errorNotNumeric);
                },
                /numeric/,
                'Non-numeric cell anywhere in range throws error');

  var values4 = [[1, 2, errorValues[0]], [4, 5, 6]];
  var range4 = new OpenSolver.MockRange(values4);
  assert.throws(function () {
                  OpenSolver.util.checkRangeValuesNumeric(range4, errorInvalid, errorNotNumeric);
                },
                /invalid/,
                'Error cell anywhere in range throws error');
});

}
