// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

OpenSolver.IndexedCoeffs = function() {
  this.indices = [];
  this.values = [];
};

OpenSolver.IndexedCoeffs.prototype.add = function(index, value) {
  this.indices.push(index);
  this.values.push(value);
};

OpenSolver.IndexedCoeffs.prototype.index = function(i) {
  return this.indices[i];
};

OpenSolver.IndexedCoeffs.prototype.coeff = function(i) {
  return this.values[i];
};

OpenSolver.IndexedCoeffs.prototype.count = function() {
  return this.indices.length;
};

OpenSolver.IndexedCoeffs.prototype.evaluate = function(varValues) {
  var maxValue = 0;
  var total = 0;
  for (var i = 0; i < this.count(); i++) {
    var coeff = this.coeff(i);
    var value = varValues[this.index(i)];
    total += coeff * value;
    maxValue = Math.max(maxValue, Math.abs(value), Math.abs(coeff), Math.abs(total));
  }
  return { value: total, max: maxValue };
};
