Model = function(sheet) {
  if (!sheet) {
    return null;
  }
  this.sheet = sheet;
  this.constraints = [];
  this.variables = [];
  this.objective = '';
  this.objectiveSense = ObjectiveSenseType.MINIMISE;
  this.objectiveVal = 0;
  this.assumeNonNeg = true;
  this.showStatus = false;
  this.checkLinear = true;
};

Model.prototype.saveConstraint = function(lhs, rhs, rel, index) {
  // TODO move validation logic into API

  if (!lhs) {
    showError(ERR_LHS_BLANK());
    return;
  }

  var lhsRange;
  try {
    lhsRange = this.sheet.getRange(lhs);
  } catch (e) {
    showMessage(e.message);
    return;
  }

  if (getRangeSize(lhsRange) === 0) {
    showError(ERR_LHS_NO_CELLS());
    return;
  }

  var rhsRange;
  switch (rel) {
    case Relation.INT:
      rhs = 'integer';
      break;
    case Relation.BIN:
      rhs = 'binary';
      break;
    case Relation.ALLDIFF:
      rhs = 'alldiff';
      break;
    default:
      if (!rhs) {
        showError(ERR_RHS_BLANK());
        return;
      }

      try {
        rhsRange = this.sheet.getRange(rhs);
      } catch (e) {
        showMessage(e.message);
        return;
      }

      // Make sure range is compatible with LHS
      var lhsDims = getRangeDims(lhsRange);
      var rhsDims = getRangeDims(rhsRange);

      // Check for a RHS of size 1 or matching RHS and LHS dimensions
      if (!((getRangeSize(rhsRange) === 1) ||
            (lhsDims.rows === rhsDims.rows && lhsDims.cols === rhsDims.cols) ||
            (lhsDims.cols === rhsDims.rows && lhsDims.rows === rhsDims.cols))) {
        showError(ERR_RHS_WRONG_SIZE());
        return;
      }
      break;
  }

  // If no RHS, we have a INT/BIN/ALLDIFF constraint.
  // We need to check that the LHS is all decision variables.
  if (!rhsRange) {
    valid = false;
    for (var i = 0; i < this.variables.length; i++) {
      var varRange = this.sheet.getRange(this.variables[i]);
      var intersectRange = getRangeIntersect(lhsRange, varRange);
      if (intersectRange &&
          getRangeSize(intersectRange) === getRangeSize(lhsRange)) {
        valid = true;
        break;
      }
    }

    if (!valid) {
      showError(ERR_INT_BIN_NOT_VARS());
      return;
    }
  }

  var constraint = new Constraint(lhs, rhs, rel);
  if (index === -1) {
    this.constraints.push(constraint);
  } else {
    this.constraints[index] = constraint;
  }
  setConstraints(this.constraints, this.sheet);
  return this;
};

Model.prototype.deleteConstraint = function(index) {
  this.constraints.splice(index, 1);
  setConstraints(this.constraints, this.sheet);
  return this;
};

Model.prototype.load = function() {
  this.constraints = getConstraints(this.sheet);
  this.variables = getVariables(this.sheet);
  this.objective = getObjective(this.sheet);
  this.objectiveSense = getObjectiveSense(this.sheet);
  this.objectiveVal = getObjectiveTargetValue(this.sheet);
  this.assumeNonNeg = getAssumeNonNegative(this.sheet);
  this.showStatus = getShowStatus(this.sheet);
  this.checkLinear = getCheckLinear(this.sheet);
  return this;
};

Model.prototype.updateObjective = function(objRange) {
  // Make sure objective cell is a single cell
  if (objRange.getNumColumns() !== 1 || objRange.getNumRows() !== 1) {
    showError(ERR_OBJ_NOT_SINGLE_CELL());
  } else {
    this.objective = getRangeNotation(this.sheet, objRange);
    setObjective(this.objective, this.sheet);
  }
  return this;
};

Model.prototype.deleteObjective = function() {
  return this.updateObjective(new MockRange([[0]]));
};

Model.prototype.updateObjectiveSense = function(objSense) {
  this.objectiveSense = objSense;
  setObjectiveSense(this.objectiveSense, this.sheet);
  return this;
};

Model.prototype.updateObjectiveTarget = function(objVal) {
  this.objectiveVal = objVal;
  setObjectiveTargetValue(this.objectiveVal, this.sheet);
  return this;
};

Model.prototype.addVariable = function(varRange) {
  return this.updateVariable(-1, varRange);
};

Model.prototype.updateVariable = function(index, varRange) {
  var varString = getRangeNotation(this.sheet, varRange);
  if (index >= 0) {
    this.variables[index] = varString;
  } else {
    this.variables.push(varString);
  }
  setVariables(this.variables, this.sheet);
  return this;
};

Model.prototype.deleteVariable = function(index) {
  this.variables.splice(index, 1);
  setVariables(this.variables, this.sheet);
  return this;
};

Model.prototype.updateAssumeNonNeg = function(nonNeg) {
  this.assumeNonNeg = nonNeg;
  setAssumeNonNegative(this.assumeNonNeg, this.sheet);
  return this;
};

Model.prototype.updateShowStatus = function(showStatus) {
  this.showStatus = showStatus;
  setShowStatus(this.showStatus, this.sheet);
  return this;
};

Model.prototype.updateCheckLinear = function(checkLinear) {
  this.checkLinear = checkLinear;
  setCheckLinear(this.checkLinear, this.sheet);
  return this;
};

Model.prototype.getSidebarData = function() {
  var escapedSheetName = escapeSheetName(this.sheet);
  return {
    constraints: this.constraints.map(function(constraint) {
      return {
        text:  constraint.displayText(escapedSheetName),
        value: constraint.displayValue(escapedSheetName)
      };
    }),
    variables: this.variables.map(function(variable) {
      return removeSheetNameFromRange(variable, escapedSheetName);
    }),
    objective:      removeSheetNameFromRange(this.objective, escapedSheetName),
    objectiveVal:   this.objectiveVal,
    objectiveSense: this.objectiveSense,
    disableVal:     this.objectiveSense != ObjectiveSenseType.TARGET,
    assumeNonNeg:   this.assumeNonNeg,
    showStatus:     this.showStatus,
    checkLinear:    this.checkLinear,
  };
};

Model.prototype.save = function() {
  setConstraints(this.constraints, this.sheet);
  setVariables(this.variables, this.sheet);
  setObjective(this.objective, this.sheet);
  setObjectiveSense(this.objectiveSense, this.sheet);
  setObjectiveTargetValue(this.objectiveTarget, this.sheet);
  setAssumeNonNegative(this.assumeNonNeg, this.sheet);
  setShowStatus(this.showStatus, this.sheet);
  setCheckLinear(this.checkLinear, this.sheet);
  return this;
};

