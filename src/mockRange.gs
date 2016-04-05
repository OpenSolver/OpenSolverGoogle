MockRange = function(values) {
  this.values = values;
};

MockRange.prototype.getValue = function() {
  return this.values[0][0];
};

MockRange.prototype.getValues = function() {
  return this.values;
};

MockRange.prototype.getNumColumns = function() {
  return this.values[0].length;
};

MockRange.prototype.getNumRows = function() {
  return this.values.length;
};

MockRange.prototype.getCell = function(i, j) {
  return new MockRange([[this.values[i - 1][j - 1]]]);
};

MockRange.prototype.getA1Notation = function() {
  return '';
};
