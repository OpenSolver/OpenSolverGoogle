// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

OpenSolver.OpenSolver = function() {
  this.showStatus = false;
  this.minimiseUserInteraction = false;
  this.assumeNonNegativeVars = false;
  this.checkLinear = false;

  this.solveStatus = OpenSolver.consts.openSolverResult.UNSOLVED;
  this.solveStatusString = 'Unsolved';
  this.solveStatusStringComment = '';

  this.modelStatus = OpenSolver.consts.modelStatus.UNINITIALISED;

  this.linearityOffset = 0;

  this.numVariableAreas = 0;
  this.variableAreas = [];
  this.numVars = 0;

  this.varNames = [];
  this.varLocations = [];
  this.varKeys = [];
  this.varRangeSizes = [];
  this.varNameMap = {};
  this.varValues = [];

  this.objectiveSense = OpenSolver.consts.objectiveSenseType.UNKNOWN;
  this.objectiveTarget = null;
  this.objective = null;
  this.objectiveValue = 0;

  this.numConstraints = 0;
  this.numRows = 0;
  this.mappingRowsToConstraints = [];
  this.constraintSummary = [];
  this.lhsRange = [];
  this.lhsType = [];
  this.lhsOriginalValues = [];
  this.rhsRange = [];
  this.rhsType = [];
  this.rhsOriginalValues = [];
  this.relation = [];
  this.varTypes = {}; // Object to store sparsely

  this.sparseA = [];
  this.rhs = [];
  this.costCoeffs = [];
  this.lowerBoundedVariables = {}; // Object for sparse storage
};

OpenSolver.OpenSolver.prototype.solveModel = function() {
  try {
    this.buildModelFromSolverData();
    this.solve();
    this.reportAnySubOptimality();
  } catch (e) {
    this.solveStatus = OpenSolver.consts.openSolverResult.ERROR_OCCURRED;
    if (!(e.title && e.title.length >= 10 && e.title.substring(0, 10) == 'OpenSolver')) {
      e.message = 'An unexpected error occurred:\n\n' + e.message + '\n\n' +
                  'Let us know about this by using the "Report Issue" button from the OpenSolver Help menu. ' +
                  'Please include your contact details with the report so that we can follow up with you.';
      e.title = 'OpenSolver: Unexpected Error';
    }
    OpenSolver.util.showError(e);
  } finally {
    // Any cleanup we need
  }
};

OpenSolver.OpenSolver.prototype.buildModelFromSolverData = function(linearityOffset, minimiseUserInteraction) {
  this.linearityOffset = linearityOffset || this.linearityOffset;
  this.minimiseUserInteraction = minimiseUserInteraction || this.minimiseUserInteraction;

  // TODO incorporate sheet into name
  // maybe we have one model per sheet, in a dropdown box on the sidebar?
  this.sheet = SpreadsheetApp.getActiveSheet();

  // TODO get solver from user selection

  var model = OpenSolver.loadModel();
  this.showStatus = model.showStatus;
  this.checkLinear = model.checkLinear;

  if (model.variables.length === 0) {
    throw(OpenSolver.error.NO_VARS);
  }


  OpenSolver.util.updateStatus('Processing model', 'Solving Model', true);
  // Get decision variable ranges and set to offset value
  // TODO check for merged cells (check if this gives an error on Google?)
  this.numVariableAreas = model.variables.length;
  this.variableAreas = [];
  this.varRangeSizes = [];
  var variable = 0;
  for (var i = 0; i < this.numVariableAreas; i++) {
    try {
      var variableArea = this.sheet.getRange(model.variables[i]);
    } catch(e) { // Error getting range
      throw(OpenSolver.error.VAR_RANGE_ERROR(model.variables[i]));
    }
    variableArea.setValue(this.linearityOffset);
    this.variableAreas.push(variableArea);

    // Set name reference for each cell
    var currentSize = OpenSolver.util.getRangeDims(variableArea);
    this.varRangeSizes.push(currentSize);
    for (var j = 0; j < currentSize.rows; j++) {
      for (var k = 0; k < currentSize.cols; k++) {
        this.varLocations[variable] = [i, j, k];
        this.varKeys[variable] = this.varLocations[variable].join('_');
        this.varNames[variable] = variableArea.getCell(j + 1, k + 1).getA1Notation();
        this.varNameMap[this.varNames[variable]] = variable;
        variable++;
      }
    }
  }
  this.numVars = this.varKeys.length;
  // Make sure we have variables after all this
  if (this.numVars === 0) {
    throw(OpenSolver.error.NO_VARS);
  }

  // Objective setup
  this.objectiveSense = model.objectiveSense;
  if (model.objectiveSense == OpenSolver.consts.objectiveSenseType.TARGET) {
    this.objectiveTarget = model.objectiveVal;
  }

  if (model.objective) {
    try {
      this.objective = this.sheet.getRange(model.objective);
    } catch (e) {
      throw(OpenSolver.error.OBJ_RANGE_ERROR(model.variables[i]));
    }
  } else {
    // If there is no objective, we set a mock range that has value 0
    this.objective = new OpenSolver.MockRange([[0]]);
  }

  // Check that objective is a single cell
  if (this.objective.getNumColumns() !== 1 || this.objective.getNumRows() !== 1) {
    throw(OpenSolver.error.OBJ_NOT_SINGLE_CELL);
  }

  this.objectiveValue = this.getObjectiveValue();
  this.objectiveConstant = this.objectiveValue;

  // Model options
  this.assumeNonNegativeVars = model.assumeNonNeg;

  // Constraints setup
  this.numConstraints = model.constraints.length;

  OpenSolver.util.updateStatus('Processing constraints', 'Solving Model');
  this.numRows = 0;
  var row = 0;
  for (var constraint = 0; constraint < this.numConstraints; constraint++) {

    if (constraint % 10 == 0) {
      OpenSolver.util.updateStatus('Processing constraint ' + (constraint + 1) + '/' +
                                   this.numConstraints, 'Solving Model');
    }

    this.constraintSummary[constraint] = model.constraints[constraint].displayText();

    try {
      var lhsRange = this.sheet.getRange(model.constraints[constraint].lhs);
    } catch (e) {
      throw(OpenSolver.error.CON_RANGE_ERROR(model.constraints[constraint].lhs));
    }
    var rel = model.constraints[constraint].rel;

    // INT/BIN constraint - no rhs
    if (!OpenSolver.util.relationConstHasRHS(rel)) {
      var currentSize = OpenSolver.util.getRangeDims(lhsRange);
      for (var j = 0; j < currentSize.rows; j++) {
        for (var k = 0; k < currentSize.cols; k++) {
          var cellName = lhsRange.getCell(j + 1, k + 1).getA1Notation();
          var varIndex = this.varNameMap[cellName];
          if (varIndex === undefined) {
            throw(OpenSolver.error.INT_BIN_LHS_NOT_ALL_VAR(
                      this.constraintSummary[constraint],
                      cellName
            ));
          }
          var varType;
          switch (rel) {
            case OpenSolver.consts.relation.INT:
              varType = OpenSolver.consts.variableType.INTEGER;
              break;
            case OpenSolver.consts.relation.BIN:
              varType = OpenSolver.consts.variableType.BINARY;
              break;
          }
          if (varType) {
            this.varTypes[varIndex] = varType;
          }
        }
      }

      this.mappingRowsToConstraints[constraint] = this.numRows;

    // Other constraints with a RHS
    } else {
      try {
        var rhsRange = this.sheet.getRange(model.constraints[constraint].rhs);
      } catch(e) {
        throw(OpenSolver.error.CON_RANGE_ERROR(model.constraints[constraint].rhs));
      }

      var rhsCount = OpenSolver.util.getRangeSize(rhsRange);
      var rowCount = OpenSolver.util.getRangeSize(lhsRange);

      // Check we have a compatible constraint system.
      if (rowCount !== rhsCount && rowCount !== 1 && rhsCount !== 1) {
        throw(OpenSolver.error.CONSTRAINT_WRONG_DIMENSIONS(this.constraintSummary[constraint]));
      }

      // STORE CONSTRAINT IN MEMORY
      // Each constraint is stored as one row of lhsOriginalValues and
      // rhsOriginalValues which essentially become arrays of values.
      // lhsType and rhsType tell us what is stored in each row

      // Left hand side:
      this.lhsRange[constraint] = lhsRange;
      if (rowCount === 1) {
        this.lhsType[constraint] = OpenSolver.consts.solverInputType.SINGLE_CELL_RANGE;
      } else {
        this.lhsType[constraint] = OpenSolver.consts.solverInputType.MULTI_CELL_RANGE;
      }

      // Right hand side:
      this.rhsRange[constraint] = rhsRange;
      if (rhsCount === 1) {
        this.rhsType[constraint] = OpenSolver.consts.solverInputType.SINGLE_CELL_RANGE;
      } else {
        this.rhsType[constraint] = OpenSolver.consts.solverInputType.MULTI_CELL_RANGE;
      }

      // Store relations for these rows, keep track of how many rows we've added
      for (var i = 0; i < rowCount; i++) {
        this.relation[row + i] = rel;
      }
      row += rowCount;
      this.mappingRowsToConstraints[constraint] = this.numRows;
      this.numRows += rowCount;

      var values = this.getConstraintValues(constraint);
      this.lhsOriginalValues[constraint] = values.lhsValues;
      this.rhsOriginalValues[constraint] = values.rhsValues;
    }
  }

  if (!this.buildSparseA()) {
    // Building A failed
    Logger.log('build A failed');
    return;
  }

  this.modelStatus = OpenSolver.consts.modelStatus.BUILT;
};

OpenSolver.OpenSolver.prototype.getConstraintValues = function(constraint) {
  var lhsRange = this.lhsRange[constraint];
  var rhsRange = this.rhsRange[constraint];
  var constraintSummary = this.constraintSummary[constraint];

  var errorInvalid = function(cellName) {
    return OpenSolver.error.CONSTRAINT_CELL_IS_ERROR(constraintSummary, cellName);
  };
  var errorNotNumeric = function(cellName) {
    return OpenSolver.error.CONSTRAINT_CELL_NOT_NUMERIC(constraintSummary, cellName);
  };

  var lhsValues = OpenSolver.util.checkRangeValuesNumeric(lhsRange, errorInvalid, errorNotNumeric);
  var rhsValues = OpenSolver.util.checkRangeValuesNumeric(rhsRange, errorInvalid, errorNotNumeric);

  return {
    lhsValues: lhsValues,
    rhsValues: rhsValues
  };
};

OpenSolver.OpenSolver.prototype.getObjectiveValue = function() {
  return OpenSolver.util.checkValueIsNumeric(this.objective.getValue(),
                                             function() { return OpenSolver.error.OBJ_IS_ERROR },
                                             function() { return OpenSolver.error.OBJ_NOT_NUMERIC });
};

OpenSolver.OpenSolver.prototype.buildSparseA = function() {
  OpenSolver.util.updateStatus('Building model...', 'Solving Model');

  // Create SparseA
  for (var row = 0; row < this.numRows; row++) {
    this.sparseA[row] = new OpenSolver.IndexedCoeffs();
  }

  // Target value needs to be adjusted by any constants in the objective
  this.objectiveTarget -= this.objectiveValue;

  for (var i = 0; i < this.numVars; i++) {
    if (i % 10 == 0) {
      OpenSolver.util.updateStatus('Building variable ' + (i + 1) + '/' + this.numVars,
                                   'Solving Model');
    }

    var currentCell = this.getVariableByIndex(i);
    currentCell.setValue(this.linearityOffset + 1);


    // The objective function value change
    if (this.objective) {
      this.costCoeffs[i] = this.getObjectiveValue() - this.objectiveValue;
    }
    // The constraint changes
    var row = 0;
    for (var constraint = 0; constraint < this.numConstraints; constraint++) {
      // Skip Binary and Integer constraints
      if (!this.lhsRange[constraint]) {
        continue;
      }

      var originalLhsValues = this.lhsOriginalValues[constraint];
      var originalRhsValues = this.rhsOriginalValues[constraint];

      var values = this.getConstraintValues(constraint);
      var currentLhsValues = values.lhsValues;
      var currentRhsValues = values.rhsValues;

      // Extract changed coefficients
      for (j = 0; j < currentLhsValues.length; j++) {
        for (k = 0; k < currentLhsValues[j].length; k++) {
          var coeff = (currentLhsValues[j][k] - originalLhsValues[j][k]);
          if (this.rhsType[constraint] === OpenSolver.consts.solverInputType.MULTI_CELL_RANGE) {
            // Making it work for column LHS with row RHS and vice versa
            if (currentLhsValues.length === currentRhsValues.length) {
              coeff -= (currentRhsValues[j][k] - originalRhsValues[j][k]);
            } else {
              coeff -= (currentRhsValues[k][j] - originalRhsValues[k][j]);
            }
          } else { // this.rhsType[constraint] === OpenSolver.consts.solverInputType.SINGLE_CELL_RANGE
            coeff -= (currentRhsValues[0][0] - originalRhsValues[0][0]);
          }

          if (Math.abs(coeff) > OpenSolver.consts.EPSILON) {
            this.sparseA[row].add(i, coeff);
          }
          row += 1;
        }
      }
    }

    currentCell.setValue(this.linearityOffset);
  }
  // Add an 'end of data' entry
  if (this.numConstraints > 0) {
    this.mappingRowsToConstraints[this.numConstraints] = this.numRows;
  }

  // Create the rhs vector
  var row = 0;
  for (var constraint = 0; constraint < this.numConstraints; constraint++) {
    // Skip Binary and Integer constraints
    if (!this.lhsRange[constraint]) {
      continue;
    }

    var originalLhsValues = this.lhsOriginalValues[constraint];
    var originalRhsValues = this.rhsOriginalValues[constraint];
    for (m = 0; m < originalLhsValues.length; m++) {
      for (n = 0; n < originalLhsValues[m].length; n++) {
        var coeff = -originalLhsValues[m][n];
        if (this.rhsType[constraint] === OpenSolver.consts.solverInputType.MULTI_CELL_RANGE) {
          // Making it work for column LHS with row RHS and vice versa
          if (originalLhsValues.length === originalRhsValues.length) {
            coeff += originalRhsValues[m][n];
          } else {
            coeff += originalRhsValues[n][m];
          }
        } else { // this.rhsType[constraint] === OpenSolver.consts.solverInputType.SINGLE_CELL_RANGE
          coeff += originalRhsValues[0][0];
        }
        this.rhs[row] = coeff;
        row += 1;
      }
    }
  }
  Logger.log(this.mappingRowsToConstraints)
  // Check for explicit lower bounds
  for (var row = 0; row < this.numRows; row++) {
    if (this.sparseA[row].count() == 1) {
      var index = this.sparseA[row].index(0);
      var coeff = this.sparseA[row].coeff(0);
      var rel = this.relation[row];
      if (coeff >= 0 && rel === OpenSolver.consts.relation.GE) {
        var constraintData = this.getConstraintFromRow(row);
        var constraint = constraintData.constraint;
        var instance = constraintData.instance;
        Logger.log([constraint, instance])
        var position = this.getArrayPositionFromConstraintInstance(constraint, instance);
        var lhsRange = this.lhsRange[constraint].getCell(position.i, position.j);
        if (this.varNameMap[lhsRange.getA1Notation()] !== undefined) {
          this.lowerBoundedVariables[index] = true;
        }
      }
    }
  }

  return true;
};

OpenSolver.OpenSolver.prototype.solve = function() {
  // TODO Check that solver is available

  this.solveStatus = OpenSolver.consts.openSolverResult.UNSOLVED;
  this.solveStatusString = 'Unsolved';
  this.solveStatusStringComment = '';

  if (this.modelStatus !== OpenSolver.consts.modelStatus.BUILT) {
    throw(OpenSolver.error.MODEL_NOT_BUILT);
  }

  // TODO set up duals

  OpenSolver.util.updateStatus('Model is being solved by solver', 'Solving Model', true);
  var solver = new OpenSolver.SolverGoogle();
  var result = solver.solve(this);
  this.solveStatus = result.solveStatus;
  this.solveStatusString = result.solveStatusString;
  Logger.log(this.solveStatus);
  Logger.log(this.solveStatusString);

  // If we have a solution, even non-optimal, we load it into the sheet.
  if (result.loadSolution) {
    OpenSolver.util.updateStatus('Model solved, loading solution into sheet', 'Solving Model', true);
    Logger.log('Objective value: ' + solver.getObjectiveValue());

    var valuesToSet = new Array(this.numVariableAreas);
    for (var i = 0; i < this.numVariableAreas; i++) {
      var currentSize = this.varRangeSizes[i];
      valuesToSet[i] = OpenSolver.util.createArray(currentSize.rows, currentSize.cols);
    }

    for (var i = 0; i < this.numVars; i++) {
      var name = this.varKeys[i];
      this.varValues[i] = solver.getVariableValue(name);
      var coeffs = name.split('_').map(Number);
      valuesToSet[coeffs[0]][coeffs[1]][coeffs[2]] = this.varValues[i];
    }

    Logger.log(valuesToSet);
    for (var i = 0; i < this.numVariableAreas; i++) {
      this.variableAreas[i].setValues(valuesToSet[i]);
    }
  }

  // Perform linearity check if requested
  if (result.loadSolution && this.checkLinear) {
    if (this.quickLinearityCheck()) {
      this.solveStatus = OpenSolver.consts.openSolverResult.ABORTED_THRU_USER_ACTION;
      this.solveStatusString = "No solution found";
    }
  }

  // TODO write duals

};

OpenSolver.OpenSolver.prototype.getConstraintFromRow = function(row) {
  var constraint = 0;
  while (row >= this.mappingRowsToConstraints[constraint + 1]) {
    constraint++;
  }
  var instance = row - this.mappingRowsToConstraints[constraint];
  return {
    constraint: constraint,
    instance: instance
  };
}

OpenSolver.OpenSolver.prototype.getArrayPositionFromConstraintInstance = function(constraint, instance) {
  var dim = this.lhsOriginalValues[constraint][0].length;
  var i = 1 + parseInt(instance / dim, 10)
  j = 1 + (instance % dim)
  return {
    i: i,
    j: j
  }
}

OpenSolver.OpenSolver.prototype.getVariableByName = function(name) {
  return this.getVariableByLocation(name.split('_').map(Number));
};

OpenSolver.OpenSolver.prototype.getVariableByIndex = function(index) {
  return this.getVariableByLocation(this.varLocations[index]);
};

OpenSolver.OpenSolver.prototype.getVariableByLocation = function(coeffs) {
  return this.variableAreas[coeffs[0]].getCell(coeffs[1] + 1, coeffs[2] + 1);
};

OpenSolver.OpenSolver.prototype.reportAnySubOptimality = function() {
  if (this.solveStatus !== OpenSolver.consts.openSolverResult.OPTIMAL &&
      this.solveStatus !== OpenSolver.consts.openSolverResult.NOT_LINEAR &&
      this.solveStatus !== OpenSolver.consts.openSolverResult.ABORTED_THRU_USER_ACTION) {
    var message = this.solutionWasLoaded ? 'The solution generated has been loaded into the spreadsheet.'
                                         : 'No solution was available to load into the spreadsheet.';

    message = 'OpenSolver could not find an optimal solution, and reported: \n\n' +
              this.solveStatusString + '\n\n' +
              message;
    if (this.solveStatusComment) {
      message += '\n\n' + this.solveStatusComment;
    }
    OpenSolver.util.showMessage(message, 'OpenSolver Solve Result');
  }
};

OpenSolver.OpenSolver.prototype.validateEmptyConstraint = function(row) {
  if ((this.relation[row] === OpenSolver.consts.relation.GE && this.rhs[row] > OpenSolver.consts.EPSILON) ||
      (this.relation[row] === OpenSolver.consts.relation.LE && this.rhs[row] < -OpenSolver.consts.EPSILON) ||
      (this.relation[row] === OpenSolver.consts.relation.EQ && Math.abs(this.rhs[row]) > OpenSolver.consts.EPSILON)) {
    var constraintData = this.getConstraintFromRow(row);
    var constraint = constraintData.constraint;
    var instance = constraintData.instance;
    var position = this.getArrayPositionFromConstraintInstance(constraint, instance);
    var i = position.i - 1;
    var j = position.j - 1;
    var lhsValue = this.lhsOriginalValues[constraint][i][j];
    var rhsValue = this.rhsOriginalValues[constraint][i][j];
    var lhsRange = this.lhsRange[constraint].getCell(i + 1, j + 1);
    var rhsRange = this.rhsRange[constraint].getCell(i + 1, j + 1);

    this.solveStatusComment = 'The model contains a constraint in the group ' + this.constraintSummary[constraint] +
                              ' which does not depend on the decision variables and is not satisfied.\n\n' +
                              'Constraint specifies: \n' +
                              'LHS: ' + lhsRange.getA1Notation() + ' = ' + lhsValue + '\n' +
                              ' ' + OpenSolver.util.relationConstToString(this.relation[row]) + '\n' +
                              'RHS: ' + rhsRange.getA1Notation() + ' = ' + rhsValue;
    return {
      solveStatus: OpenSolver.consts.openSolverResult.INFEASIBLE,
      solveStatusString: 'Infeasible',
      loadSolution: false
    }
  } else {
    return false;
  }
};

OpenSolver.OpenSolver.prototype.quickLinearityCheck = function() {
  var nonLinearInfo = '';
  var nonLinearCount = 0;
  var rowIsNonLinear = {}; // Object for sparse storage

  Logger.log('start linearity check');

  var row = 0;
  for (var constraint = 0; constraint < this.numConstraints; constraint++) {
    if (this.lhsRange[constraint]) {
      var values = this.getConstraintValues(constraint);
      var currentLhsValues = values.lhsValues;
      var currentRhsValues = values.rhsValues;

      for (m = 0; m < currentLhsValues.length; m++) {
        for (n = 0; n < currentLhsValues[m].length; n++) {

          // Get current constraint value
          var solutionValue = currentLhsValues[m][n];
          if (this.rhsType[constraint] === OpenSolver.consts.solverInputType.MULTI_CELL_RANGE) {
            // Making it work for column LHS with row RHS and vice versa
            if (currentLhsValues.length === currentRhsValues.length) {
              solutionValue -= currentRhsValues[m][n];
            } else {
              solutionValue -= currentRhsValues[n][m];
            }
          } else { // this.rhsType[constraint] === OpenSolver.consts.solverInputType.SINGLE_CELL_RANGE
            solutionValue -= currentRhsValues[0][0];
          }


          // Get predicted value from Ax = b
          // Track largest value we encounter to get some idea of expected error
          var result = this.sparseA[row].evaluate(this.varValues);
          var expectedValue = result.value - this.rhs[row];
          var maxValue = Math.max(result.max, Math.abs(this.rhs[row]));

          Logger.log(Math.abs(expectedValue - solutionValue) / (1 + Math.abs(expectedValue)));
          Logger.log(maxValue)

          // Ratio test
          if (Math.abs(expectedValue - solutionValue) / (1 + Math.abs(expectedValue)) >
              Math.max(OpenSolver.consts.EPSILON, OpenSolver.consts.EPSILON * maxValue)) {
            nonLinearInfo = nonLinearInfo || 'The following constraint(s) do not appear to be linear: \n';
            if (nonLinearCount < 10) {
              nonLinearInfo += '\n' + this.constraintSummary[constraint];

              var constraintData = this.getConstraintFromRow(row);
              var constraint = constraintData.constraint;
              var instance = constraintData.instance;
              var position = this.getArrayPositionFromConstraintInstance(constraint, instance);
              var lhsCell = this.lhsRange[constraint].getCell(position.i, position.j).getA1Notation();
              var rhsCell = this.rhsRange[constraint].getCell(position.i, position.j).getA1Notation();

              if (this.lhsType[constraint] === OpenSolver.consts.solverInputType.MULTI_CELL_RANGE) {
                nonLinearInfo += ' (instance ' + (instance + 1) + ')';
              }
              nonLinearInfo += ': LHS=' + lhsCell + ', ';
              nonLinearInfo += 'RHS=' + rhsCell + ', ';
              nonLinearInfo += expectedValue.toPrecision(4)  + ' != ' + solutionValue.toPrecision(4);
            }
            nonLinearCount++;
            rowIsNonLinear[row] = true;
          }

          row++;
        }
      }
    }
  }

  if (nonLinearCount > 10) {
    nonLinearInfo += '\n' + 'and ' + (nonLinearCount - 10) + ' other constraints.';
  }

  var observedObj = this.getObjectiveValue();
  var expectedObj = this.calculateObjectiveValue(this.varValues);

  Logger.log('here');
  var objNonLinear = Math.abs(observedObj - expectedObj) / (1 + Math.abs(expectedObj)) > OpenSolver.consts.EPSILON;
  if (objNonLinear) {
    nonLinearInfo = 'The objective function is not linear.\n\n' + nonLinearInfo;
  }

  if (nonLinearInfo) {
    this.solveStatus = OpenSolver.consts.openSolverResult.NOT_LINEAR;
    if (!this.minimiseUserInteraction) {
      var ui = SpreadsheetApp.getUi();
      var response = ui.alert('OpenSolver Quick Linearity Check',
                              nonLinearInfo + '\n\n' + 'Would you like to run a full linearity check? This will ' +
                                                       'destroy the current solution.',
                              ui.ButtonSet.YES_NO);
      if (response === ui.Button.YES) {
        this.fullLinearityCheck();
        return true;
      }
    }
  }

  return false;
}

OpenSolver.OpenSolver.prototype.calculateObjectiveValue = function(values) {
  var total = 0;
  for (var i = 0; i < this.numVars; i++) {
    total += this.costCoeffs[i] * values[i];
  }
  return total;
};

OpenSolver.OpenSolver.prototype.fullLinearityCheck = function() {
  // Copy solution values into a new array
  this.originalValues = this.varValues.slice();

  // Build each matrix where the decision variables start at zero (ValueZero()), one (ValueOne())
  // and ten (ValueTen())

  var valueZero = this.sparseA.slice();
  var costCoeffsZero = this.costCoeffs.slice();
  var objectiveConstantZero = this.objectiveConstant;

  this.buildModelFromSolverData(1);
  var valueOne = this.sparseA.slice();
  var costCoeffsOne = this.costCoeffs.slice();
  var objectiveConstantOne = this.objectiveConstant;

  this.buildModelFromSolverData(10);
  var valueTen = this.sparseA.slice();
  var costCoeffsTen = this.costCoeffs.slice();
  var objectiveConstantTen = this.objectiveConstant;

  var constraint = 0;
  var nonLinearCount = 0;
  var nonLinearInfo = '';
  var rowIsNonLinear = {}; // Object for sparse storage

  for (var row = 0; row < this.numRows; row++) {
    var firstVar = true;
    var valueZeroCounter = valueZero[row].count();
    var valueOneCounter = valueOne[row].count();
    var valueTenCounter = valueTen[row].count();
    var numEntries = Math.max(valueZeroCounter, valueOneCounter, valueTenCounter);
    for (var i = 0; i < numEntries; i++) {
      var c1 = valueZero[row].coeff(i);
      var c2 = valueOne[row].coeff(i);
      var c3 = valueTen[row].coeff(i);

      Logger.log([c1, c2, c3])
      var test1 = c1 && c2 && Math.abs(c1 - c2) / (1 + Math.abs(c1)) > OpenSolver.consts.EPSILON;
      var test2 = c1 && c3 && Math.abs(c1 - c3) / (1 + Math.abs(c1)) > OpenSolver.consts.EPSILON;
      var test3 = c2 && c3 && Math.abs(c2 - c3) / (1 + Math.abs(c2)) > OpenSolver.consts.EPSILON;

      Logger.log([test1, test2, test3])
      if (test1 || test2 || test3) {
        // Non linear in this var
        var constraintData = this.getConstraintFromRow(row);
        var constraint = constraintData.constraint;
        var instance = constraintData.instance;
        var varName = this.varNames[valueZero[row].index(i)];

        if (!nonLinearInfo) {
          nonLinearInfo = 'The following constraint(s) do not appear to be linear:\n';
        }

        if (nonLinearCount <= 10) {
          if (firstVar) {
            nonLinearInfo += '\n' + this.constraintSummary[constraint];
            if (this.lhsType[constraint] === OpenSolver.consts.solverInputType.MULTI_CELL_RANGE) {
              nonLinearInfo += ' (instance ' + (instance + 1) + ')';
            }
            nonLinearInfo += ' is non-linear in variable(s): ' + varName;
          } else {
            nonLinearInfo += ', ' + varName;
          }
        }
        firstVar = false;
        rowIsNonLinear[row] = true;
        nonLinearCount++;
      }
    }
  }

  if (nonLinearCount > 10) {
    nonLinearInfo += '\n' + 'and ' + (nonLinearCount - 10) + ' other instances.';
  }

  var objNonLinear = false;
  for (var i = 0; i < this.numVars; i++) {
    var c1 = costCoeffsZero[i];
    var c2 = costCoeffsOne[i];
    var c3 = costCoeffsTen[i];
    Logger.log([c1, c2, c3])
    var test1 = c1 && c2 && Math.abs(c1 - c2) / (1 + Math.abs(c1)) > OpenSolver.consts.EPSILON;
    var test2 = c1 && c3 && Math.abs(c1 - c3) / (1 + Math.abs(c1)) > OpenSolver.consts.EPSILON;
    var test3 = c2 && c3 && Math.abs(c2 - c3) / (1 + Math.abs(c2)) > OpenSolver.consts.EPSILON;

    Logger.log([test1, test2, test3])
    if (test1 || test2 || test3) {
      // Objective is non-linear in this var
      var varName = this.varNames[i];
      if (!objNonLinear) {
        objNonLinear = true;
        nonLinearInfo += '\n\n' + 'The objective function appears to be non-linear in variable(s): ' + varName;
      } else {
        nonLinearInfo += ', ' + varName;
      }
    }
  }

  // TODO Put the solution back on the sheet

  if (nonLinearInfo) {
    if (!this.minimiseUserInteraction) {
      var ui = SpreadsheetApp.getUi();
      ui.alert('OpenSolver Full Linearity Check', nonLinearInfo, ui.ButtonSet.OK);
    }
  }

};
