function Constraint(lhs, rhs, rel) {
  this.lhs = lhs;
  this.rhs = rhs;
  this.rel = rel;
}

Constraint.prototype.displayText = function() {
  var text = this.lhs.concat(' ', relationConstToString(this.rel));
  if (relationConstHasRHS(this.rel)) {
    text = text.concat(' ', this.rhs);
  }
  return text;
};

Constraint.prototype.displayValue = function() {
  return this.lhs.concat(';', this.rel, ';', this.rhs);
};
