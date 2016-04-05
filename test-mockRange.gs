function testMockRange(test) {

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

test('getters', function(t) {
  for (var i = 0; i < values.length; i++) {
    var mock = new MockRange(values[i]);
    var desc = rows[i] + 'x' + cols[i] + ' range';
    t.equal(mock.getValue(), firstVals[i], 'getValue: ' + desc + tick);
    t.equal(mock.getValues(), values[i], 'getValues: ' + desc + tick);
    t.equal(mock.getNumColumns(), cols[i], 'getNumColumns: ' + desc + tick);
    t.equal(mock.getNumRows(), rows[i], 'getNumRows: ' + desc + tick);
    t.equal(mock.getCell(mock.getNumRows(), mock.getNumColumns()).getValue(),
            lastVals[i],
            'getCell: ' + desc + tick);
  }
});

}
