// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

OpenSolver.Constraint = function(lhs, rhs, rel) {
  this.lhs = lhs;
  this.rhs = rhs;
  this.rel = rel;
};

OpenSolver.Constraint.prototype.displayText = function() {
  var text = this.lhs.concat(' ', OpenSolver.util.relationConstToString(this.rel));
  if (OpenSolver.util.relationConstHasRHS(this.rel)) {
    text = text.concat(' ', this.rhs);
  }
  return text;
};

OpenSolver.Constraint.prototype.displayValue = function() {
  return this.lhs.concat(';', this.rel, ';', this.rhs);
};
