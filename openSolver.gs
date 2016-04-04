OpenSolver = function(sheet) {
  this.sheet = sheet;
  this.sheetId = sheet.getSheetId();

  this.showStatus = false;
  this.minimiseUserInteraction = false;
  this.assumeNonNegativeVars = false;
  this.checkLinear = false;

  this.solveStatus = OpenSolverResult.UNSOLVED;
  this.solveStatusString = 'Unsolved';
  this.solveStatusStringComment = '';

  this.modelStatus = ModelStatus.UNINITIALISED;

  this.linearityOffset = 0;

  this.numVariableAreas = 0;
  this.variableAreaStrings = [];
  this.variableAreas = [];
  this.numVars = 0;

  this.varNames = [];
  this.varLocations = [];
  this.varKeys = [];
  this.varRangeSizes = [];
  this.varNameMap = {};
  this.varValues = [];

  this.objectiveSense = ObjectiveSenseType.UNKNOWN;
  this.objectiveTarget = null;
  this.objectiveString = null;
  this.objective = null;
  this.objectiveValue = 0;

  this.numConstraints = 0;
  this.numRows = 0;
  this.mappingRowsToConstraints = [];
  this.constraintSummary = [];

  this.lhsString = [];
  this.lhsRange = [];
  this.lhsType = [];
  this.lhsOriginalValues = [];

  this.rhsString = [];
  this.rhsRange = [];
  this.rhsType = [];
  this.rhsOriginalValues = [];
  this.relation = [];
  this.varTypes = {}; // Object to store sparsely

  this.sparseA = [];
  this.startVariable = 0;
  this.rhs = [];
  this.costCoeffs = [];
  this.lowerBoundedVariables = {}; // Object for sparse storage

  this.solverShortName = null;
  this.solver = null;
};

OpenSolver.prototype.toJSON = function() {
  // Don't write out properties in this blacklist
  var excluded = [
    'sheet',
    'variableAreas',
    'lhsRange',
    'rhsRange'
  ];

  var out = {};
  var keys = Object.keys(this);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (excluded.indexOf(key) < 0) {
      out[key] = this[key];
    }
  }
  return out;
};

OpenSolver.prototype.loadFromCache = function(data) {
  var keys = Object.keys(data);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    this[key] = data[key];
  }

  for (var i = 0; i < this.numVariableAreas; i++) {
    var area = this.getVariableAreaFromString(this.variableAreaStrings[i]);
    this.variableAreas.push(area);
  }

  this.getObjectiveFromString(this.objectiveString);

  for (var i = 0; i < this.numConstraints; i++) {
    this.lhsRange[i] = this.getConRangeFromString(this.lhsString[i]);
    this.rhsRange[i] = this.getConRangeFromString(this.rhsString[i]);
  }

  for (var row = 0; row < this.sparseA.length; row++) {
    this.sparseA[row] = new IndexedCoeffs().loadFromCache(this.sparseA[row]);
  }

  this.solver = createSolver(this.solverShortName).loadFromCache(this.solver);
  return this;
};

OpenSolver.prototype.getObjectiveFromString = function(objString) {
  if (objString) {
    try {
      this.objective = this.sheet.getRange(objString);
    } catch (e) {
      throw(ERR_OBJ_RANGE_ERROR(objString));
    }
  } else {
    // If there is no objective, we set a mock range that has value 0
    this.objective = new MockRange([[0]]);
  }

  // Check that objective is a single cell
  if (this.objective.getNumColumns() !== 1 || this.objective.getNumRows() !== 1) {
    throw(ERR_OBJ_NOT_SINGLE_CELL());
  }
  return this.objective;
};

OpenSolver.prototype.getConRangeFromString = function(conString) {
  try {
    return conString ? this.sheet.getRange(conString) : null;
  } catch (e) {
    throw(ERR_CON_RANGE_ERROR(conString));
  }
};

OpenSolver.prototype.getVariableAreaFromString = function(varArea) {
  return this.sheet.getRange(varArea)
};

OpenSolver.prototype.solveModel = function() {
  try {
    if (this.modelStatus !== ModelStatus.BUILT) {
      this.buildModelFromSolverData();
    }
    this.solve();
    this.reportAnySubOptimality();
    this.deleteCache();
  } catch (e) {
    this.solveStatus = OpenSolverResult.ERROR_OCCURRED;
    if (!(e.title && e.title.length >= 10 && e.title.substring(0, 10) == 'OpenSolver')) {
      e.message = 'An unexpected error occurred:\n\n' + e.message + '\n\n' +
                  'Let us know about this by using the "Report Issue" button from the OpenSolver Help menu. ' +
                  'Please include your contact details with the report so that we can follow up with you.';
      e.title = 'OpenSolver: Unexpected Error';
    }
    showError(e);
  } finally {
    // Any cleanup we need
  }
};

OpenSolver.prototype.buildModelFromSolverData = function(linearityOffset, minimiseUserInteraction) {
  this.linearityOffset = linearityOffset || this.linearityOffset;
  this.minimiseUserInteraction = minimiseUserInteraction || this.minimiseUserInteraction;

  // TODO get solver from user selection

  var model = new Model(this.sheet);
  this.showStatus = model.showStatus;
  this.checkLinear = model.checkLinear;

  this.solverShortName = model.solver.shortName;

  if (model.variables.length === 0) {
    throw(ERR_NO_VARS());
  }

  updateStatus('Processing model', 'Solving Model', true);
  // Get decision variable ranges and set to offset value
  // TODO check for merged cells (check if this gives an error on Google?)
  this.numVariableAreas = model.variables.length;
  this.variableAreas = [];
  this.varRangeSizes = [];
  var variable = 0;
  for (var i = 0; i < this.numVariableAreas; i++) {
//    try {
//      var variableArea = this.sheet.getRange(model.variables[i]);
//    } catch(e) { // Error getting range
//      throw(ERR_VAR_RANGE_ERROR(model.variables[i]));
//    }
    var variableAreaString = model.variables[i];
    this.variableAreaStrings.push(variableAreaString);

    var variableArea = this.getVariableAreaFromString(variableAreaString);
    variableArea.setValue(this.linearityOffset);
    this.variableAreas.push(variableArea);

    // Set name reference for each cell
    var variableSize = getRangeDims(variableArea);
    this.varRangeSizes.push(variableSize);
    for (var j = 0; j < variableSize.rows; j++) {
      for (var k = 0; k < variableSize.cols; k++) {
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
    throw(ERR_NO_VARS());
  }

  // Objective setup
  this.objectiveSense = model.objectiveSense;
  if (model.objectiveSense == ObjectiveSenseType.TARGET) {
    this.objectiveTarget = model.objectiveVal;
  }

  this.objectiveString = model.objective;
  this.getObjectiveFromString(this.objectiveString);

  this.objectiveValue = this.getObjectiveValue();
  this.objectiveConstant = this.objectiveValue;

  // Model options
  this.assumeNonNegativeVars = model.assumeNonNeg;

  // Constraints setup
  this.numConstraints = model.constraints.length;

  updateStatus('Processing constraints', 'Solving Model');
  this.numRows = 0;
  var row = 0;
  for (var constraint = 0; constraint < this.numConstraints; constraint++) {

    if (constraint % 10 === 0) {
      updateStatus('Processing constraint ' + (constraint + 1) + '/' +
                                   this.numConstraints, 'Solving Model');
    }

    this.constraintSummary[constraint] = model.constraints[constraint].displayText();

    this.lhsString[constraint] = model.constraints[constraint].lhs;
    var lhsRange = this.getConRangeFromString(this.lhsString[constraint]);

    var rel = model.constraints[constraint].rel;

    // INT/BIN constraint - no rhs
    if (!relationConstHasRHS(rel)) {
      this.rhsString[constraint] = '';

      var lhsSize = getRangeDims(lhsRange);
      for (var j = 0; j < lhsSize.rows; j++) {
        for (var k = 0; k < lhsSize.cols; k++) {
          var cellName = lhsRange.getCell(j + 1, k + 1).getA1Notation();
          var varIndex = this.varNameMap[cellName];
          if (varIndex === undefined) {
            throw(ERR_INT_BIN_NOT_ALL_VARS(
              this.constraintSummary[constraint],
              cellName
            ));
          }
          var varType;
          switch (rel) {
            case Relation.INT:
              varType = VariableType.INTEGER;
              break;
            case Relation.BIN:
              varType = VariableType.BINARY;
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
      this.rhsString[constraint] = model.constraints[constraint].rhs;
      var rhsRange = this.getConRangeFromString(this.rhsString[constraint]);

      var rhsCount = getRangeSize(rhsRange);
      var rowCount = getRangeSize(lhsRange);

      // Check we have a compatible constraint system.
      if (rowCount !== rhsCount && rowCount !== 1 && rhsCount !== 1) {
        throw(ERR_CON_WRONG_DIMS(this.constraintSummary[constraint]));
      }

      // STORE CONSTRAINT IN MEMORY
      // Each constraint is stored as one row of lhsOriginalValues and
      // rhsOriginalValues which essentially become arrays of values.
      // lhsType and rhsType tell us what is stored in each row

      // Left hand side:
      this.lhsRange[constraint] = lhsRange;
      if (rowCount === 1) {
        this.lhsType[constraint] = SolverInputType.SINGLE_CELL_RANGE;
      } else {
        this.lhsType[constraint] = SolverInputType.MULTI_CELL_RANGE;
      }

      // Right hand side:
      this.rhsRange[constraint] = rhsRange;
      if (rhsCount === 1) {
        this.rhsType[constraint] = SolverInputType.SINGLE_CELL_RANGE;
      } else {
        this.rhsType[constraint] = SolverInputType.MULTI_CELL_RANGE;
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

  this.modelStatus = ModelStatus.INITIALISED;

  if (!this.buildSparseA()) {
    // Building A failed
    Logger.log('build A failed');
    return;
  }

  this.modelStatus = ModelStatus.BUILT;
  this.updateCache();
};

OpenSolver.prototype.getConstraintValues = function(constraint) {
  var lhsRange = this.lhsRange[constraint];
  var rhsRange = this.rhsRange[constraint];
  var constraintSummary = this.constraintSummary[constraint];

  var errorInvalid = function(cellName) {
    return ERR_CON_CELL_IS_ERROR(constraintSummary, cellName);
  };
  var errorNotNumeric = function(cellName) {
    return ERR_CON_CELL_NOT_NUMERIC(constraintSummary, cellName);
  };

  var lhsValues = checkRangeValuesNumeric(lhsRange, errorInvalid, errorNotNumeric);
  var rhsValues = checkRangeValuesNumeric(rhsRange, errorInvalid, errorNotNumeric);

  return {
    lhsValues: lhsValues,
    rhsValues: rhsValues
  };
};

OpenSolver.prototype.getObjectiveValue = function() {
  return checkValueIsNumeric(this.objective.getValue(),
                             ERR_OBJ_IS_ERROR,
                             ERR_OBJ_NOT_NUMERIC);
};

OpenSolver.prototype.buildSparseA = function() {
  updateStatus('Building model...', 'Solving Model');

  // Create SparseA
  for (var row = 0; row < this.numRows; row++) {
    this.sparseA[row] = this.sparseA[row] || new IndexedCoeffs();
  }

  // Target value needs to be adjusted by any constants in the objective
  this.objectiveTarget -= this.objectiveValue;

  var start = this.startVariable;
  for (var i = this.startVariable; i < this.numVars; i++) {
    if (i % 10 === 0) {
      updateStatus('Building variable ' + (i + 1) + '/' + this.numVars,
                   'Solving Model');

      // Save progress to cache
      this.updateCache();

      // For testing termination
      if (i !== start) { throw(makeError('stop while building')); };
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
          if (this.rhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
            // Making it work for column LHS with row RHS and vice versa
            if (currentLhsValues.length === currentRhsValues.length) {
              coeff -= (currentRhsValues[j][k] - originalRhsValues[j][k]);
            } else {
              coeff -= (currentRhsValues[k][j] - originalRhsValues[k][j]);
            }
          } else { // this.rhsType[constraint] === SolverInputType.SINGLE_CELL_RANGE
            coeff -= (currentRhsValues[0][0] - originalRhsValues[0][0]);
          }

          if (Math.abs(coeff) > EPSILON) {
            this.sparseA[row].add(i, coeff);
          }
          row += 1;
        }
      }
    }

    currentCell.setValue(this.linearityOffset);
    this.startVariable = i + 1;
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
        if (this.rhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
          // Making it work for column LHS with row RHS and vice versa
          if (originalLhsValues.length === originalRhsValues.length) {
            coeff += originalRhsValues[m][n];
          } else {
            coeff += originalRhsValues[n][m];
          }
        } else { // this.rhsType[constraint] === SolverInputType.SINGLE_CELL_RANGE
          coeff += originalRhsValues[0][0];
        }
        this.rhs[row] = coeff;
        row += 1;
      }
    }
  }
  Logger.log(this.mappingRowsToConstraints);
  // Check for explicit lower bounds
  for (var row = 0; row < this.numRows; row++) {
    if (this.sparseA[row].count() == 1) {
      var index = this.sparseA[row].index(0);
      var coeff = this.sparseA[row].coeff(0);
      var rel = this.relation[row];
      if (coeff >= 0 && rel === Relation.GE) {
        var constraintData = this.getConstraintFromRow(row);
        var constraint = constraintData.constraint;
        var instance = constraintData.instance;
        Logger.log([constraint, instance]);
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

OpenSolver.prototype.solve = function() {
  // TODO Check that solver is available

  this.solveStatus = OpenSolverResult.UNSOLVED;
  this.solveStatusString = 'Unsolved';
  this.solveStatusStringComment = '';

  if (this.modelStatus !== ModelStatus.BUILT) throw(ERR_MODEL_NOT_BUILT());

  // TODO set up duals

  this.solver = this.solver || createSolver(this.solverShortName);
  var result = this.solver.solve(this);

  this.solveStatus = result.solveStatus;
  this.solveStatusString = result.solveStatusString;
  Logger.log(this.solveStatus);
  Logger.log(this.solveStatusString);

  // If we have a solution, even non-optimal, we load it into the sheet.
  if (result.loadSolution) {
    updateStatus('Model solved, loading solution into sheet', 'Solving Model', true);
    Logger.log('Objective value: ' + this.solver.getObjectiveValue());

    var valuesToSet = new Array(this.numVariableAreas);
    for (var i = 0; i < this.numVariableAreas; i++) {
      var currentSize = this.varRangeSizes[i];
      valuesToSet[i] = createArray(currentSize.rows, currentSize.cols);
    }

    for (var i = 0; i < this.numVars; i++) {
      var name = this.varKeys[i];
      this.varValues[i] = this.solver.getVariableValue(name);
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
      this.solveStatus = OpenSolverResult.ABORTED_THRU_USER_ACTION;
      this.solveStatusString = "No solution found";
    }
  }

  // TODO write duals

};

OpenSolver.prototype.getConstraintFromRow = function(row) {
  var constraint = 0;
  while (row >= this.mappingRowsToConstraints[constraint + 1]) {
    constraint++;
  }
  var instance = row - this.mappingRowsToConstraints[constraint];
  return {
    constraint: constraint,
    instance: instance
  };
};

OpenSolver.prototype.getArrayPositionFromConstraintInstance = function(constraint, instance) {
  var dim = this.lhsOriginalValues[constraint][0].length;
  var i = 1 + parseInt(instance / dim, 10);
  j = 1 + (instance % dim);
  return {
    i: i,
    j: j
  };
};

OpenSolver.prototype.getVariableByName = function(name) {
  return this.getVariableByLocation(name.split('_').map(Number));
};

OpenSolver.prototype.getVariableByIndex = function(index) {
  return this.getVariableByLocation(this.varLocations[index]);
};

OpenSolver.prototype.getVariableByLocation = function(coeffs) {
  return this.variableAreas[coeffs[0]].getCell(coeffs[1] + 1, coeffs[2] + 1);
};

OpenSolver.prototype.reportAnySubOptimality = function() {
  if (this.solveStatus !== OpenSolverResult.OPTIMAL &&
      this.solveStatus !== OpenSolverResult.NOT_LINEAR &&
      this.solveStatus !== OpenSolverResult.ABORTED_THRU_USER_ACTION) {
    var message = this.solutionWasLoaded ? 'The solution generated has been loaded into the spreadsheet.'
                                         : 'No solution was available to load into the spreadsheet.';

    message = 'OpenSolver could not find an optimal solution, and reported: \n\n' +
              this.solveStatusString + '\n\n' +
              message;
    if (this.solveStatusComment) {
      message += '\n\n' + this.solveStatusComment;
    }
    showMessage(message, 'OpenSolver Solve Result');
  }
};

OpenSolver.prototype.validateEmptyConstraint = function(row) {
  Logger.log('Validate: row ' + row + ' relation ' + this.relation[row] + ' rhs ' + this.rhs[row]);
  if ((this.relation[row] === Relation.GE && this.rhs[row] > EPSILON) ||
      (this.relation[row] === Relation.LE && this.rhs[row] < -EPSILON) ||
      (this.relation[row] === Relation.EQ && Math.abs(this.rhs[row]) > EPSILON)) {
    var constraintData = this.getConstraintFromRow(row);
    var constraint = constraintData.constraint;
    var instance = constraintData.instance;
    var position = this.getArrayPositionFromConstraintInstance(constraint, instance);
    var i = position.i - 1;
    var j = position.j - 1;

    var lhsRange;
    var lhsValue;
    if (this.lhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
      lhsRange = this.lhsRange[constraint].getCell(i + 1, j + 1);
      lhsValue = this.lhsOriginalValues[constraint][i][j];
    } else {
      lhsRange = this.lhsRange[constraint].getCell(1, 1);
      lhsValue = this.lhsOriginalValues[constraint][0][0];
    }
    var rhsRange;
    var rhsValue;
    if (this.rhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
      rhsRange = this.rhsRange[constraint].getCell(i + 1, j + 1);
      rhsValue = this.rhsOriginalValues[constraint][i][j];
    } else {
      rhsRange = this.rhsRange[constraint].getCell(1, 1);
      rhsValue = this.rhsOriginalValues[constraint][0][0];
    }

    this.solveStatusComment = 'The model contains a constraint in the group ' + this.constraintSummary[constraint] +
                              ' which does not depend on the decision variables and is not satisfied.\n\n' +
                              'Constraint specifies: \n' +
                              'LHS: ' + lhsRange.getA1Notation() + ' = ' + lhsValue + '\n' +
                              ' ' + relationConstToString(this.relation[row]) + '\n' +
                              'RHS: ' + rhsRange.getA1Notation() + ' = ' + rhsValue;
    return {
      solveStatus: OpenSolverResult.INFEASIBLE,
      solveStatusString: 'Infeasible',
      loadSolution: false
    };
  } else {
    return false;
  }
};

OpenSolver.prototype.quickLinearityCheck = function() {
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
          if (this.rhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
            // Making it work for column LHS with row RHS and vice versa
            if (currentLhsValues.length === currentRhsValues.length) {
              solutionValue -= currentRhsValues[m][n];
            } else {
              solutionValue -= currentRhsValues[n][m];
            }
          } else { // this.rhsType[constraint] === SolverInputType.SINGLE_CELL_RANGE
            solutionValue -= currentRhsValues[0][0];
          }


          // Get predicted value from Ax = b
          // Track largest value we encounter to get some idea of expected error
          var result = this.sparseA[row].evaluate(this.varValues);
          var expectedValue = result.value - this.rhs[row];
          var maxValue = Math.max(result.max, Math.abs(this.rhs[row]));

          Logger.log(Math.abs(expectedValue - solutionValue) / (1 + Math.abs(expectedValue)));
          Logger.log(maxValue);

          // Ratio test
          if (Math.abs(expectedValue - solutionValue) / (1 + Math.abs(expectedValue)) >
              Math.max(EPSILON, EPSILON * maxValue)) {
            nonLinearInfo = nonLinearInfo || 'The following constraint(s) do not appear to be linear: \n';
            if (nonLinearCount < 10) {
              nonLinearInfo += '\n' + this.constraintSummary[constraint];

              var constraintData = this.getConstraintFromRow(row);
              var constraint = constraintData.constraint;
              var instance = constraintData.instance;
              var position = this.getArrayPositionFromConstraintInstance(constraint, instance);
              var lhsCell = this.lhsRange[constraint].getCell(position.i, position.j).getA1Notation();
              var rhsCell = this.rhsRange[constraint].getCell(position.i, position.j).getA1Notation();

              if (this.lhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
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
  if (nonLinearInfo) {
    nonLinearInfo += '\n\n';
  }

  var observedObj = this.getObjectiveValue();
  var expectedObj = this.calculateObjectiveValue(this.varValues);

  Logger.log('here');
  var objNonLinear = Math.abs(observedObj - expectedObj) / (1 + Math.abs(expectedObj)) > EPSILON;
  if (objNonLinear) {
    nonLinearInfo = 'The objective function is not linear. Expected ' + expectedObj.toPrecision(4) + ', got ' + observedObj.toPrecision(4) + '\n\n' + nonLinearInfo;
  }

  if (nonLinearInfo) {
    this.solveStatus = OpenSolverResult.NOT_LINEAR;
    if (!this.minimiseUserInteraction) {
      var ui = SpreadsheetApp.getUi();
      var response = ui.alert('OpenSolver Quick Linearity Check',
                              nonLinearInfo + 'Would you like to run a full linearity check? This will ' +
                                              'destroy the current solution.',
                              ui.ButtonSet.YES_NO);
      if (response === ui.Button.YES) {
        this.fullLinearityCheck();
        return true;
      }
    }
  }

  return false;
};

OpenSolver.prototype.calculateObjectiveValue = function(values) {
  var total = 0;
  for (var i = 0; i < this.numVars; i++) {
    total += this.costCoeffs[i] * values[i];
  }
  total += this.objectiveValue;
  return total;
};

OpenSolver.prototype.fullLinearityCheck = function() {
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

      Logger.log([c1, c2, c3]);
      var test1 = c1 && c2 && Math.abs(c1 - c2) / (1 + Math.abs(c1)) > EPSILON;
      var test2 = c1 && c3 && Math.abs(c1 - c3) / (1 + Math.abs(c1)) > EPSILON;
      var test3 = c2 && c3 && Math.abs(c2 - c3) / (1 + Math.abs(c2)) > EPSILON;

      Logger.log([test1, test2, test3]);
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
            if (this.lhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
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
    Logger.log([c1, c2, c3]);
    var test1 = c1 && c2 && Math.abs(c1 - c2) / (1 + Math.abs(c1)) > EPSILON;
    var test2 = c1 && c3 && Math.abs(c1 - c3) / (1 + Math.abs(c1)) > EPSILON;
    var test3 = c2 && c3 && Math.abs(c2 - c3) / (1 + Math.abs(c2)) > EPSILON;

    Logger.log([test1, test2, test3]);
    if (test1 || test2 || test3) {
      // Objective is non-linear in this var
      var varName = this.varNames[i];
      if (!objNonLinear) {
        objNonLinear = true;
        if (nonLinearInfo !== "") {
          nonLinearInfo += '\n\n';
        }
        nonLinearInfo += 'The objective function appears to be non-linear in variable(s): ' + varName;
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

OpenSolver.prototype.updateCache = function() {
  updateOpenSolverCache(this);
};

OpenSolver.prototype.deleteCache = function() {
  deleteOpenSolverCache();
};
