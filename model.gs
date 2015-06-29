// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

OpenSolver.Model = function(sheet) {
  if (!sheet) {
    return null;
  }
  this.sheet = sheet;
  this.constraints = [];
  this.variables = [];
  this.objective = new OpenSolver.MockRange([[0]]);  // empty objective cell that returns value zero
  this.objectiveSense = OpenSolver.consts.objectiveSenseType.MINIMISE;
  this.objectiveVal = 0;
  this.assumeNonNeg = true;
  this.showStatus = false;
  this.checkLinear = true;
};

OpenSolver.Model.prototype.saveConstraint = function(lhs, rhs, rel, index) {
  try {
    var lhsRange = this.sheet.getRange(lhs);
  } catch (e) {
    OpenSolver.util.showMessage(e.message);
    return;
  }

  if (OpenSolver.util.getRangeSize(lhsRange) === 0) {
    OpenSolver.util.showError(OpenSolver.error.LHS_NO_CELLS);
    return;
  }

  var rhsRange;
  switch (rel) {
    case OpenSolver.consts.relation.INT:
      rhs = 'integer';
      break;
    case OpenSolver.consts.relation.BIN:
      rhs = 'binary';
      break;
    case OpenSolver.consts.relation.ALLDIFF:
      rhs = 'alldiff';
      break;
    default:
      try {
        rhsRange = this.sheet.getRange(rhs);
      } catch (e) {
        OpenSolver.util.showMessage(e.message);
        return;
      }

      // Make sure range is compatible with LHS
      var lhsDims = OpenSolver.util.getRangeDims(lhsRange);
      var rhsDims = OpenSolver.util.getRangeDims(rhsRange);

      // Check for a RHS of size 1 or matching RHS and LHS dimensions
      if (!((OpenSolver.util.getRangeSize(rhsRange) === 1) ||
            (lhsDims.rows === rhsDims.rows && lhsDims.cols === rhsDims.cols) ||
            (lhsDims.cols === rhsDims.rows && lhsDims.rows === rhsDims.cols))) {
        OpenSolver.util.showError(OpenSolver.error.RHS_WRONG_SIZE);
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
      var intersectRange = OpenSolver.util.getRangeIntersect(lhsRange, varRange);
      if (intersectRange &&
          OpenSolver.util.getRangeSize(intersectRange) === OpenSolver.util.getRangeSize(lhsRange)) {
        valid = true;
        break;
      }
    }

    if (!valid) {
      OpenSolver.util.showError(OpenSolver.error.LHS_NOT_DECISION_VARS);
      return;
    }
  }

  var constraint = new OpenSolver.Constraint(lhs, rhs, rel);
  if (index === 0) {
    this.constraints.push(constraint);
  } else {
    this.constraints[index - 1] = constraint;
  }
  OpenSolver.API.setConstraints(this.constraints, this.sheet);

  return {
    text: constraint.displayText(),
    value: constraint.displayValue(),
    index: index
  };
};

OpenSolver.Model.prototype.deleteConstraint = function(index) {
  this.constraints.splice(index, 1);
  OpenSolver.API.setConstraints(this.constraints, this.sheet);
};

OpenSolver.Model.prototype.load = function() {
  this.constraints = OpenSolver.API.getConstraints(this.sheet);
  this.variables = OpenSolver.API.getVariables(this.sheet);
  this.objective = OpenSolver.API.getObjective(this.sheet);
  this.objectiveSense = OpenSolver.API.getObjectiveSense(this.sheet);
  this.objectiveVal = OpenSolver.API.getObjectiveTargetValue(this.sheet);
  this.assumeNonNeg = OpenSolver.API.getAssumeNonNegative(this.sheet);
  this.showStatus = OpenSolver.API.getShowStatus(this.sheet);
  this.checkLinear = OpenSolver.API.getCheckLinear(this.sheet);
};

OpenSolver.Model.prototype.updateObjective = function(objRange) {
  // Make sure objective cell is a single cell
  if (objRange.getNumColumns() !== 1 || objRange.getNumRows() !== 1) {
    OpenSolver.util.showError(OpenSolver.error.OBJ_NOT_SINGLE_CELL);
    return;
  }

  this.objective = OpenSolver.API.getRangeNotation(this.sheet, objRange);
  OpenSolver.API.setObjective(this.objective, this.sheet);
  return objRange.getA1Notation();
};

OpenSolver.Model.prototype.deleteObjective = function() {
  this.updateObjective(new OpenSolver.MockRange([[0]]));
  return this.objective;
};

OpenSolver.Model.prototype.updateObjectiveSense = function(objSense) {
  this.objectiveSense = objSense;
  OpenSolver.API.setObjectiveSense(this.objectiveSense, this.sheet);
};

OpenSolver.Model.prototype.updateObjectiveTarget = function(objVal) {
  this.objectiveVal = objVal;
  OpenSolver.API.setObjectiveTargetValue(this.objectiveVal, this.sheet);
};

OpenSolver.Model.prototype.addVariable = function(varRange) {
  return this.updateVariable(-1, varRange);
};

OpenSolver.Model.prototype.updateVariable = function(index, varRange) {
  var varString = OpenSolver.API.getRangeNotation(this.sheet, varRange);
  if (index >= 0) {
    this.variables[index] = varString;
  } else {
    this.variables.push(varString);
  }
  OpenSolver.API.setVariables(this.variables, this.sheet);
  return varRange.getA1Notation();
};

OpenSolver.Model.prototype.deleteVariable = function(index) {
  this.variables.splice(index, 1);
  OpenSolver.API.setVariables(this.variables, this.sheet);
};

OpenSolver.Model.prototype.updateAssumeNonNeg = function(nonNeg) {
  this.assumeNonNeg = nonNeg;
  OpenSolver.API.setAssumeNonNegative(this.assumeNonNeg, this.sheet);
};

OpenSolver.Model.prototype.updateShowStatus = function(showStatus) {
  this.showStatus = showStatus;
  OpenSolver.API.setShowStatus(this.showStatus, this.sheet);
};

OpenSolver.Model.prototype.updateCheckLinear = function(checkLinear) {
  this.checkLinear = checkLinear;
  OpenSolver.API.setCheckLinear(this.checkLinear, this.sheet);
};

OpenSolver.Model.prototype.getSidebarData = function() {
  Logger.log(this.objective)
  return {
    constraints: this.constraints.map(function(constraint) {
      return {
        text:  constraint.displayText(),
        value: constraint.displayValue()
      };
    }),
    variables:      this.variables,
    objective:      this.objective,
    objectiveVal:   this.objectiveVal,
    objectiveSense: this.objectiveSense,
    disableVal:     this.objectiveSense != OpenSolver.consts.objectiveSenseType.TARGET,
    assumeNonNeg:   this.assumeNonNeg,
    showStatus:     this.showStatus,
    checkLinear:    this.checkLinear,
  };
};

OpenSolver.Model.prototype.save = function() {
  OpenSolver.API.setConstraints(this.constraints, this.sheet);
  OpenSolver.API.setVariables(this.variables, this.sheet);
  OpenSolver.API.setObjective(this.objective, this.sheet);
  OpenSolver.API.setObjectiveSense(this.objectiveSense, this.sheet);
  OpenSolver.API.setObjectiveTargetValue(this.objectiveTarget, this.sheet);
  OpenSolver.API.setAssumeNonNegative(this.assumeNonNeg, this.sheet);
  OpenSolver.API.setShowStatus(this.showStatus, this.sheet);
  OpenSolver.API.setCheckLinear(this.checkLinear, this.sheet);
};

