// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

OpenSolver.Model = function() {
  this.constraints = [];
  this.variables = [];
  this.objective = '';
  this.objectiveSense = OpenSolver.consts.objectiveSenseType.MINIMISE;
  this.objectiveVal = 0;
  this.assumeNonNeg = true;
  this.showStatus = false;
  this.checkLinear = true;
};

OpenSolver.Model.prototype.saveConstraint = function(lhs, rhs, rel, index) {
  var sheet = SpreadsheetApp.getActiveSheet();
  try {
    var lhsRange = sheet.getRange(lhs);
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
        rhsRange = sheet.getRange(rhs);
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
      var varRange = sheet.getRange(this.variables[i]);
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
  this.updateSavedConstraints();

  return {
    text: constraint.displayText(),
    value: constraint.displayValue(),
    index: index
  };
};

OpenSolver.Model.prototype.deleteConstraint = function(index) {
  this.constraints.splice(index, 1);
  this.updateSavedConstraints();
};

OpenSolver.Model.prototype.updateSavedConstraints = function() {
  var currentNum = parseInt(OpenSolver.util.getSolverProperty('num'), 10);

  properties = {};
  for (var i = 0; i < this.constraints.length; i++) {
    properties['lhs'.concat(i)] = this.constraints[i].lhs;
    properties['rhs'.concat(i)] = this.constraints[i].rhs;
    properties['rel'.concat(i)] = this.constraints[i].rel.toString();
  }
  properties['num'] = this.constraints.length.toString();
  OpenSolver.util.setSolverProperties(properties);

  // Clean up old constraint info
  for (var i = this.constraints.length; i < currentNum; i++) {
    OpenSolver.util.deleteSolverProperty('lhs'.concat(i));
    OpenSolver.util.deleteSolverProperty('rhs'.concat(i));
    OpenSolver.util.deleteSolverProperty('rel'.concat(i));
  }
};

OpenSolver.loadModel = function() {
  var sheet = SpreadsheetApp.getActiveSheet();

  var properties = OpenSolver.util.getAllProperties();
  var model = new OpenSolver.Model();

  if (properties['solver_num']) {
    for (var i = 0; i < properties['solver_num']; i++) {
      var lhs = properties['solver_lhs'.concat(i)];
      var rhs = properties['solver_rhs'.concat(i)];
      var rel = parseInt(properties['solver_rel'.concat(i)]);
      model.constraints.push(new OpenSolver.Constraint(lhs, rhs, rel));
    }
  }

  if (properties['solver_adj'] !== undefined) {
    model.variables = properties['solver_adj'].split(',');
  }

  if (properties['solver_opt'] !== undefined) {
    model.objective = properties['solver_opt'];
  }

  if (properties['solver_typ'] !== undefined) {
    model.objectiveSense = properties['solver_typ'];
  } else {
    model.updateObjectiveSense(model.objectiveSense);
  }

  if (properties['solver_val'] !== undefined) {
    model.objectiveVal = properties['solver_val'];
  }

  if (properties['solver_neg'] !== undefined) {
    model.assumeNonNeg = OpenSolver.util.assumeNonNegToBoolean(properties['solver_neg']);
  }

  if (properties['openSolver_showStatus'] !== undefined) {
    model.showStatus = (properties['openSolver_showStatus'] === 'true');
  }

  if (properties['openSolver_checkLinear'] !== undefined) {
    model.checkLinear = (properties['openSolver_checkLinear'] === 'true');
    Logger.log(model.checkLinear)
  }
  return model;
};

OpenSolver.clearModel = function() {
  var model = new OpenSolver.Model();

  model.updateSavedConstraints();
  model.updateSavedVariables();
  model.updateSavedObjective();
  model.updateSavedObjectiveSense();
  model.updateSavedObjectiveTarget();
  model.updateSavedAssumeNonNeg();
  model.updateSavedShowStatus();
  model.updateSavedCheckLinear();

  return model.getUiData();
};

OpenSolver.Model.prototype.updateObjective = function() {
  var sheet = SpreadsheetApp.getActiveSheet();
  try {
    var objRange = sheet.getActiveRange();
  } catch (e) {
    OpenSolver.util.showMessage(e.message);
    return;
  }

  // Make sure objective cell is a single cell
  if (objRange.getNumColumns() !== 1 || objRange.getNumRows() !== 1) {
    OpenSolver.util.showError(OpenSolver.error.OBJ_NOT_SINGLE_CELL);
    return;
  }

  var objString = objRange.getA1Notation();
  this.objective = objString;
  this.updateSavedObjective();
  return objString;
};

OpenSolver.Model.prototype.deleteObjective = function() {
  this.objective = '';
  this.updateSavedObjective();
};

OpenSolver.Model.prototype.updateObjectiveSense = function(objSense) {
  this.objectiveSense = objSense;
  this.updateSavedObjectiveSense();
};

OpenSolver.Model.prototype.updateSavedObjectiveSense = function() {
  OpenSolver.util.setSolverProperty('typ', this.objectiveSense.toString());
};

OpenSolver.Model.prototype.updateObjectiveTarget = function(objVal) {
  this.objectiveVal = objVal;
  this.updateSavedObjectiveTarget();
};

OpenSolver.Model.prototype.updateSavedObjectiveTarget = function() {
  OpenSolver.util.setSolverProperty('val', this.objectiveVal);
};

OpenSolver.Model.prototype.updateSavedObjective = function() {
  if (this.objective) {
    OpenSolver.util.setSolverProperty('opt', this.objective);
  } else {
    OpenSolver.util.deleteSolverProperty('opt');
  }
};

OpenSolver.Model.prototype.addVariable = function() {
  return this.updateVariable(-1);
};

OpenSolver.Model.prototype.updateVariable = function(index) {
  var sheet = SpreadsheetApp.getActiveSheet();
  try {
    var varRange = sheet.getActiveRange();
  } catch (e) {
    OpenSolver.util.showMessage(e.message);
    return;
  }
  var varString = varRange.getA1Notation();
  if (index >= 0) {
    this.variables[index] = varString;
  } else {
    this.variables.push(varString);
  }
  this.updateSavedVariables();
  return varString;
};

OpenSolver.Model.prototype.deleteVariable = function(index) {
  this.variables.splice(index, 1);
  this.updateSavedVariables();
};

OpenSolver.Model.prototype.updateSavedVariables = function() {
  OpenSolver.util.setSolverProperty('adj', this.variables.join(','));
};

OpenSolver.Model.prototype.updateAssumeNonNeg = function(nonNeg) {
  this.assumeNonNeg = nonNeg;
  this.updateSavedAssumeNonNeg();
};

OpenSolver.Model.prototype.updateSavedAssumeNonNeg = function() {
  OpenSolver.util.setSolverProperty('neg', OpenSolver.util.assumeNonNegFromBoolean(this.assumeNonNeg).toString());
};

OpenSolver.Model.prototype.updateShowStatus = function(showStatus) {
  this.showStatus = showStatus;
  this.updateSavedShowStatus();
};

OpenSolver.Model.prototype.updateSavedShowStatus = function() {
  OpenSolver.util.setOpenSolverProperty('showStatus', this.showStatus);
};

OpenSolver.Model.prototype.updateCheckLinear = function(checkLinear) {
  this.checkLinear = checkLinear;
  this.updateSavedCheckLinear();
};

OpenSolver.Model.prototype.updateSavedCheckLinear = function() {
  OpenSolver.util.setOpenSolverProperty('checkLinear', this.checkLinear);
};

OpenSolver.Model.prototype.getUiData = function() {
  var model = {
    constraints: [],
    variables: this.variables
  };

  for (i = 0; i < this.constraints.length; i++) {
    model.constraints.push({
      text: this.constraints[i].displayText(),
      value: this.constraints[i].displayValue()
    });
  }

  model.objective = this.objective;
  model.objectiveVal = this.objectiveVal;
  model.objectiveSense = this.objectiveSense;
  model.disableVal = this.objectiveSense != OpenSolver.consts.objectiveSenseType.TARGET;
  model.assumeNonNeg = this.assumeNonNeg;
  model.showStatus = this.showStatus;
  model.checkLinear = this.checkLinear;
  return model;
};

