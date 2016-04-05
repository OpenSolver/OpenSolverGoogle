function testUtil(test) {

var relations = ['GE', 'LE', 'EQ', 'INT', 'BIN', 'ALLDIFF'];
var strings = ['>=', '<=', '==', 'int', 'bin', 'alldiff'];
var hasRHS = [true, true, true, false, false, false];

test('util - relationConstToString', function(t) {
  for (var i = 0; i < relations.length; i++) {
    var relation = relations[i];
    var result = strings[i];
    t.equal(relationConstToString(Relation[relation]),
            result,
            relation + rightArrow + result);
  }
});

test('util - relationConstHasRHS', function(t) {
  for (var i = 0; i < relations.length; i++) {
    var relation = relations[i];
    var result = hasRHS[i];
    t.equal(relationConstHasRHS(Relation[relation]),
            result,
            relation + rightArrow + result);
  }
});

var errorValues = ['#DIV/0!', '#NUM!', '#N/A', '#VALUE!'];

test('valueIsError', function(t) {
  for (var i = 0; i < errorValues.length; i++) {
    var value = errorValues[i];
    t.ok(valueIsError(value), value + tick);
  }
});

test('createArray', function(t) {
  var array1 = createArray(0);
  t.equal(array1.length, 0, 'createArray(0) has length 0' + tick);

  var array2 = createArray(1);
  t.equal(array2.length, 1, 'createArray(1) has length 1' + tick);

  var array3 = createArray(2, 3);
  t.ok((array3.length == 2) && (array3[0].length == 3),
       'createArray(2, 3) has dimension 2x3' + tick);

  var array4 = createArray(2, 3, 4);
  t.ok((array4.length == 2) && (array4[0].length == 3) && (array4[0][0].length == 4),
       'createArray(2, 3, 4) has dimension 2x3x4' + tick);
});

test('checkValueIsNumeric', function(t) {
  var errorNotNumeric = function() { return 'numeric'; };
  var errorInvalid = function() { return 'invalid'; };

  var checkValue = function(value) {
    return function() {
      checkValueIsNumeric(value, errorInvalid, errorNotNumeric);
    };
  };

  t.equal(checkValueIsNumeric(10, errorInvalid, errorNotNumeric),
          10,
          'Number returns actual value');
  t.equal(checkValueIsNumeric('', errorInvalid, errorNotNumeric),
          0,
          'Empty string is converted to zero and returns this');
  t.throws(checkValue('abc'),
           'Non-numeric cell throws error');


  for (var i = 0; i < errorValues.length; i++) {
    var errorValue = errorValues[i];
    t.throws(checkValue(errorValue),
             'Error cell (' + errorValue + ') throws error');
  }
});

test('checkRangeValuesNumeric', function(t) {
  var errorNotNumeric = function(cellName) { return 'numeric'; };
  var errorInvalid = function(cellName) { return 'invalid'; };

  var checkRange = function(range) {
    return function() {
      checkRangeValuesNumeric(range, errorInvalid, errorNotNumeric);
    };
  };

  var values1 = [[1, 2, 3], [4, 5, 6]];
  var range1 = new MockRange(values1);
  t.deepEqual(checkRangeValuesNumeric(range1, errorInvalid, errorNotNumeric),
              values1,
              'All numbers returns actual values');

  var values2 = [[1, 2, ''], [4, '', 6]];
  var range2 = new MockRange(values2);
  values2[0][2] = 0;
  values2[1][1] = 0;
  t.deepEqual(checkRangeValuesNumeric(range2, errorInvalid, errorNotNumeric),
              values2,
              'Empty cells converted to zeros');
  t.deepEqual(values2, values2)

  var values3 = [[1, 2, 3], ['abc', 5, 6]];
  var range3 = new MockRange(values3);
  t.throws(checkRange(range3),
           'Non-numeric cell anywhere in range throws error');

  var values4 = [[1, 2, errorValues[0]], [4, 5, 6]];
  var range4 = new MockRange(values4);
  t.throws(checkRange(range4),
           'Error cell anywhere in range throws error');
});

var ranges = ['abc!A1', 'abc!A1', "'abc'!A1", 'abc!A1', 'abc!A1', 'abc!A1'];
var sheetNames = ['abc', 'abd', "'abc'", '', null, undefined];
var shortenedRanges = ['A1', 'abc!A1', 'A1', 'abc!A1', 'abc!A1', 'abc!A1'];

test('removeSheetNameFromRange', function(t) {
  for (var i = 0; i < ranges.length; i++) {
    var range = ranges[i];
    var sheetName = sheetNames[i];
    var result = shortenedRanges[i];
    t.equal(removeSheetNameFromRange(range, sheetName),
            result,
            range + ' - ' + sheetName + rightArrow + result);
  }
});

}
