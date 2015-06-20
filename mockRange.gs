// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

OpenSolver.MockRange = function(values) {
  this.values = values;
};

OpenSolver.MockRange.prototype.getValue = function() {
  return this.values[0][0];
};

OpenSolver.MockRange.prototype.getValues = function() {
  return this.values;
};

OpenSolver.MockRange.prototype.getNumColumns = function() {
  return this.values[0].length;
};

OpenSolver.MockRange.prototype.getNumRows = function() {
  return this.values.length;
};

OpenSolver.MockRange.prototype.getCell = function(i, j) {
  return new OpenSolver.MockRange([[this.values[i - 1][j - 1]]]);
};

OpenSolver.MockRange.prototype.getA1Notation = function() {
  return 'DummyCell';
};
