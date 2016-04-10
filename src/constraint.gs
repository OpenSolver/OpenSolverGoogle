function Constraint(lhs, rhs, rel) {
  this.lhs = lhs;
  this.rhs = rhs;
  this.rel = rel;
}

Constraint.prototype.displayText = function(sheetName) {
  var text = removeSheetNameFromRange(this.lhs, sheetName) + ' ' +
             relationConstToString(this.rel);
  if (relationConstHasRHS(this.rel)) {
    text += ' ' + removeSheetNameFromRange(this.rhs, sheetName);
  }
  return text;
};

Constraint.prototype.displayValue = function(sheetName) {
  return this.lhs + ';' + this.rel + ';' + this.rhs;
};
