Model = function(sheet, loadFromSheet) {
  if (!sheet) {
    return null;
  }
  if (loadFromSheet === undefined || !isBool(loadFromSheet)) {
    loadFromSheet = true;
  }

  this.sheet = sheet;

  // Load the model data on the sheet if requested
  var data = getHiddenSheetData(this.sheet, !loadFromSheet);

  this.assumeNonNeg =   getSavedBool(   data, solverName("neg"), true);
  this.showStatus =     getSavedBool(   data, solverName("sho"), true);
  this.objective =      getSavedString( data, solverName("obj"), '');
  this.objectiveVal =   getSavedDouble( data, solverName("val"), 0);
  this.objectiveSense = getSavedInteger(data, solverName("typ"),
                                        ObjectiveSenseType.MINIMISE);

  this.constraints = [];
  var numConstraints = getSavedInteger(data, solverName("num"), 0);
  for (var i = 0; i < numConstraints; i++) {
    var lhs = getSavedString( data, solverName("lhs" + i));
    var rel = getSavedInteger(data, solverName("rel" + i));
    var rhs = getSavedString( data, solverName("rhs" + i));
    this.constraints.push(new Constraint(lhs, rhs, rel));
  }

  this.variables = [];
  // Load a default length of 1 so that we always look for solver_adj
  var numVariables = getSavedInteger(data, openSolverName("AdjNum"), 1);
  for (var j = 0; j < numVariables; j++) {
    var adj = getSavedString(data, solverName("adj" + variableIndex(j)), '');
    if (adj) {
      this.variables.push(adj);
    }
  }

  this.checkLinear = getSavedBool(data, openSolverName("LinearityCheck"), true);

  return this;
};

Model.prototype.save = function() {
  data = {};
  if (this.objective) {
    setSavedString( data, solverName("obj"), this.objective);
  }
  setSavedInteger(  data, solverName("typ"), this.objectiveSense);
  setSavedDouble(   data, solverName("val"), this.objectiveVal);
  setSavedBool(     data, solverName("neg"), this.assumeNonNeg);
  setSavedBool(     data, solverName("sho"), this.showStatus);
  setSavedInteger(  data, solverName("num"), this.constraints.length);

  for (var i = 0; i < this.constraints.length; i++) {
    setSavedString( data, solverName('lhs' + i), this.constraints[i].lhs);
    setSavedString( data, solverName('rhs' + i), this.constraints[i].rhs);
    setSavedInteger(data, solverName('rel' + i), this.constraints[i].rel);
  }

  for (var j = 0; j < this.variables.length; j++) {
    setSavedString( data, solverName('adj' + variableIndex(j)),
                    this.variables[j]);
  }

  setSavedInteger(  data, openSolverName("AdjNum"), this.variables.length);
  setSavedBool(     data, openSolverName("LinearityCheck"), this.checkLinear);

  insertHiddenSheetData(this.sheet, data);

  return this;
};

// Constraint API

Model.prototype.addConstraint = function(lhs, rhs, rel) {
  return this.updateConstraint(-1, lhs, rhs, rel);
};

Model.prototype.updateConstraint = function(lhs, rhs, rel, index) {
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
  return this;
};

Model.prototype.deleteConstraint = function(index) {
  this.constraints.splice(index, 1);
  return this;
};

// Variable API

Model.prototype.addVariable = function(varString) {
  return this.updateVariable(-1, varString);
};

Model.prototype.updateVariable = function(index, varString) {
  if (index >= 0) {
    this.variables[index] = varString;
  } else {
    this.variables.push(varString);
  }
  return this;
};

Model.prototype.deleteVariable = function(index) {
  this.variables.splice(index, 1);
  return this;
};

// Objective API

Model.prototype.updateObjective = function(obj) {
  if (obj) {
    var objRange = this.sheet.getRange(obj);
    // Make sure objective cell is a single cell
    if (objRange.getNumColumns() !== 1 || objRange.getNumRows() !== 1) {
      showError(ERR_OBJ_NOT_SINGLE_CELL());
    } else {
      this.objective = obj;
    }
  } else {
    this.objective = '';
  }
  return this;
};

Model.prototype.deleteObjective = function() {
  return this.updateObjective('');
};

// Other APIs

Model.prototype.updateObjectiveSense = function(objSense) {
  this.objectiveSense = objSense;
  return this;
};

Model.prototype.updateObjectiveTarget = function(objVal) {
  this.objectiveVal = objVal;
  return this;
};

Model.prototype.updateAssumeNonNeg = function(nonNeg) {
  this.assumeNonNeg = nonNeg;
  return this;
};

Model.prototype.updateShowStatus = function(showStatus) {
  this.showStatus = showStatus;
  return this;
};

Model.prototype.updateCheckLinear = function(checkLinear) {
  this.checkLinear = checkLinear;
  return this;
};

// Info needed for sidebar

Model.prototype.getSidebarData = function() {
  this.save();
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



