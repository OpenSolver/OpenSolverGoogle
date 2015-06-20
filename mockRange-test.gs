// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

function mockRangeTest() {

QUnit.module('mockRange');

var values = [
  [[0]],
  [[1], [2], [3]],
  [[1, 2, 3, 4]],
  [[1, 2], [3, 4], [5, 6]]
];
var rows = [1, 3, 1, 3];
var cols = [1, 1, 4, 2];
var firstVals = [0, 1, 1, 1];
var lastVals = [0, 3, 4, 6];

QUnit.test('getters', values.length * 5, function(assert) {
  for (var i = 0; i < values.length; i++) {
    var mock = new OpenSolver.MockRange(values[i]);
    var desc = rows[i] + 'x' + cols[i] + ' range';
    assert.equal(mock.getValue(), firstVals[i], 'getValue: ' + desc + tick);
    assert.equal(mock.getValues(), values[i], 'getValues: ' + desc + tick);
    assert.equal(mock.getNumColumns(), cols[i], 'getNumColumns: ' + desc + tick);
    assert.equal(mock.getNumRows(), rows[i], 'getNumRows: ' + desc + tick);
    assert.equal(mock.getCell(mock.getNumRows(), mock.getNumColumns()).getValue(),
                 lastVals[i],
                 'getCell: ' + desc + tick);
  }
});

}
