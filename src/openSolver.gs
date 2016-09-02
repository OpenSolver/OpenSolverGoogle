OpenSolver = function(sheet) {
  this.sheet = sheet;
  this.sheetId = sheet.getSheetId();

  this.showStatus = false;
  this.minimiseUserInteraction = false;
  this.assumeNonNegativeVars = false;
  this.checkLinear = false;
  this.fastBuild = false;
  this.linearityOffset = 10.423;  // An uncommon magic number!

  this.solveStatus = OpenSolverResult.UNSOLVED;
  this.solveStatusString = 'Unsolved';
  this.solveStatusStringComment = '';

  this.modelStatus = ModelStatus.UNINITIALISED;

  // Solver variable information
  this.numVariableAreas = 0;
  this.variableAreaStrings = [];
  this.variableAreas = [];

  // LP variable information
  this.numVars = 0;
  this.varNames = [];
  this.varLocations = [];
  this.varKeys = [];
  this.varRangeSizes = [];
  this.varNameMap = {};
  this.varValues = [];
  this.varTypes = {}; // Object to store sparsely
  this.lowerBoundedVariables = {}; // Object for sparse storage

  // Objective information
  this.objectiveSense = ObjectiveSenseType.UNKNOWN;
  this.objectiveTarget = null;
  this.objectiveString = null;
  this.objective = null;

  // Mappings between solver constraints and LP rows
  this.numConstraints = 0;
  this.numRows = 0;
  this.rowToConstraint = [];  // Map row number to solver constraint
  this.constraintToRow = [];  // Map solver constraint to first LP row
  this.rowCount = [];         // Number of rows for each solver constraint

  // Constraint information
  this.constraintSummary = [];
  this.relation = [];
  this.lhsString = [];
  this.lhsRange = [];
  this.lhsRangeSizes = [];
  this.lhsType = [];
  this.rhsString = [];
  this.rhsRange = [];
  this.rhsType = [];

  // Model information filled in by model builder
  this.startVariable = 0;  // The last variable that was processed for resuming
  this.sparseA = [];
  this.rhs = [];
  this.costCoeffs = new IndexedCoeffs();
  this.objectiveConstant = 0;

  // Solver information
  this.solverShortName = null;
  this.solver = null;
  this.solutionWasLoaded = false;
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
    if (this.rhsString[i]) {
      this.lhsRange[i] = this.getConRangeFromString(this.lhsString[i]);
      this.rhsRange[i] = this.getConRangeFromString(this.rhsString[i]);
    }
  }

  for (var row = 0; row < this.sparseA.length; row++) {
    this.sparseA[row] = new IndexedCoeffs().loadFromCache(this.sparseA[row]);
  }
  this.costCoeffs = new IndexedCoeffs().loadFromCache(this.costCoeffs);

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
  try {
    return this.sheet.getRange(varArea);
  } catch(e) {
    throw(ERR_VAR_RANGE_ERROR(varArea));
  }
};

OpenSolver.prototype.solveModel = function() {
  try {
    if (this.modelStatus !== ModelStatus.BUILT) {
      this.buildModelFromSolverData();
    }

    // Only proceed with solve if we don't already have a result from building
    if (this.solveStatus === OpenSolverResult.UNSOLVED) {
      this.solve();
    }
    this.reportAnySubOptimality();

    // Don't empty the cache if the solve is going to finish later
    if (this.solveStatus !== OpenSolverResult.PENDING) {
      this.deleteCache();
    }
  } catch (e) {
    if (DEBUG) { throw e; }

    this.solveStatus = OpenSolverResult.ERROR_OCCURRED;
    if (!(e.title && e.title.length >= 10 && e.title.substring(0, 10) == 'OpenSolver')) {
      e.message = 'An unexpected error occurred:\n\n' + e.message + '\n' +
                  e.stack + '\n\n' +
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

  var model = new Model(this.sheet);
  this.showStatus = model.showStatus;
  this.checkLinear = model.checkLinear;
  this.fastBuild = model.fastBuild;

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
    var variableAreaString = model.variables[i];
    this.variableAreaStrings.push(variableAreaString);

    var variableArea = this.getVariableAreaFromString(variableAreaString);
    this.variableAreas.push(variableArea);

    // Set name reference for each cell
    var variableSize = getRangeDims(variableArea);
    this.varRangeSizes.push(variableSize);
    for (var j = 0; j < variableSize.rows; j++) {
      for (var k = 0; k < variableSize.cols; k++) {
        this.varLocations[variable] = [i, j, k];
        this.varKeys[variable] = this.varLocations[variable].join('_');
        this.varNames[variable] = variableArea.getCell(j + 1, k + 1).getA1Notation();
        // TODO check if the variable exists and if so skip the var
        // TODO include sheet name in variable name
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
  this.objectiveString = model.objective;
  this.getObjectiveFromString(this.objectiveString);
  this.objectiveSense = model.objectiveSense;
  if (model.objectiveSense == ObjectiveSenseType.TARGET) {
    this.objectiveTarget = model.objectiveVal;
    Logger.log('Loaded target: ' + this.objectiveTarget);
  }

  // Model options
  this.assumeNonNegativeVars = model.assumeNonNeg;

  // Constraints setup
  updateStatus('Processing constraints', 'Solving Model');
  this.numConstraints = model.constraints.length;
  this.numRows = 0;
  this.lhsRangeSizes = [];
  for (var constraint = 0; constraint < this.numConstraints; constraint++) {

    if (constraint % 10 === 0) {
      updateStatus('Processing constraint ' + (constraint + 1) + '/' +
                   this.numConstraints, 'Solving Model');
    }

    this.constraintSummary[constraint] = model.constraints[constraint]
                                              .displayText();

    this.lhsString[constraint] = model.constraints[constraint].lhs;
    var lhsRange = this.getConRangeFromString(this.lhsString[constraint]);
    this.lhsRange[constraint] = lhsRange;
    var lhsSize = getRangeDims(lhsRange);
    this.lhsRangeSizes.push(lhsSize);

    var rel = model.constraints[constraint].rel;
    this.relation[constraint] = rel;

    // INT/BIN constraint - no rhs
    if (!relationConstHasRHS(rel)) {
      this.rhsString[constraint] = '';

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
            // Don't override a binary with integer
            if (this.varTypes[varIndex] !== VariableType.BINARY) {
              this.varTypes[varIndex] = varType;
            }
          }
        }
      }
      this.rowCount[constraint] = 0;
      this.constraintToRow[constraint] = this.numRows;

    // Other constraints with a RHS
    } else {
      this.rhsString[constraint] = model.constraints[constraint].rhs;
      var rhsRange = this.getConRangeFromString(this.rhsString[constraint]);

      var lhsCount = getRangeSize(lhsRange);
      var rhsCount = getRangeSize(rhsRange);

      // Check we have a compatible constraint system.
      if (lhsCount !== rhsCount && lhsCount !== 1 && rhsCount !== 1) {
        throw(ERR_CON_WRONG_DIMS(this.constraintSummary[constraint]));
      }

      // STORE CONSTRAINT IN MEMORY
      // Each constraint is stored as one row of lhsOriginalValues and
      // rhsOriginalValues which essentially become arrays of values.
      // lhsType and rhsType tell us what is stored in each row

      // Left hand side:
      if (lhsCount === 1) {
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

      this.rowCount[constraint] = lhsCount;
      this.constraintToRow[constraint] = this.numRows;
      this.numRows += lhsCount;
    }
  }

  if (this.numRows > 0) {
    var row = 0;
    for (var con = 0; con < this.numConstraints; con++) {
      var rowCount = this.rowCount[con];
      for (var i = 0; i < rowCount; i++) {
        this.rowToConstraint[row + i] = con;
      }
      row += rowCount;
    }
  }

  this.modelStatus = ModelStatus.INITIALISED;

  Logger.log('Starting model builder');
  var t0 = new Date();

  if (this.fastBuild) {
    if (!this.doFastBuild()) {
      // Building A failed
      Logger.log('fast build failed');
      return;
    }
  } else {
    if (!this.processSolverModel(this.linearityOffset, this.checkLinear)) {
      // Building A failed
      Logger.log('build A failed');
      return;
    }
  }

  var t1 = new Date();
  Logger.log('Finished building model in ' + (t1 - t0) + ' ms');

  this.setAllVariableValues(0);

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

OpenSolver.prototype.processSolverModel = function(linearityOffset, checkLinear) {
  updateStatus('Building model...', 'Solving Model');

  // Don't do the setup if we are resuming a sparseA build
  if (this.startVariable === 0) {
    // Build RHS terms and objective constant
    if (!this.buildConstantTerms()) {
      return false;
    }
  }

  // Build sparseA and cost vector
  if (!this.buildVariableTerms(linearityOffset)) {
    return false;
  }

  if (!this.quickFeasibilityCheck()) {
    return false;
  }

  // Check for explicit lower bounds
  // TODO: use same rules as Excel
  for (var row = 0; row < this.numRows; row++) {
    if (this.sparseA[row].count() == 1) {
      Logger.log('checking lower bound at row ' + row);
      var index = this.sparseA[row].index(0);
      var coeff = this.sparseA[row].coeff(0);
      var constraint = this.rowToConstraint[row];
      var rel = this.relation[constraint];
      if (Math.abs(coeff) > 0 && rel === Relation.GE) {
        if (this.lowerBoundedVariables[index] !== undefined ||
            this.lowerBoundedVariables[index] > this.rhs[row]) {
          Logger.log('add lower bound for var ' + index + ': ' + this.rhs[row]);
          this.lowerBoundedVariables[index] = this.rhs[row];
        }
      }
    }
  }
  Logger.log('Lower bounded variables: ');
  Logger.log(this.lowerBoundedVariables);

  if (checkLinear) {
    this.quickLinearityCheck();
  }

  return true;
}

OpenSolver.prototype.setAllVariableValues = function(value) {
  for (var i = 0; i < this.numVariableAreas; i++) {
    this.variableAreas[i].setValue(value);
  }
}

OpenSolver.prototype.setAllBinaryVariableValues = function(value) {
  for (var constraint = 0; constraint < this.numConstraints; constraint++) {
    if (this.relation[constraint] === Relation.BIN) {
      this.lhsRange[constraint].setValue(value);
    }
  }
}

OpenSolver.prototype.buildConstantTerms = function() {
  // Zero all values
  this.setAllVariableValues(0);

  if (this.objective) {
    this.objectiveConstant = this.getObjectiveValue();
  }

  // Create the rhs vector
  var row = 0;
  for (var constraint = 0; constraint < this.numConstraints; constraint++) {
    // Skip Binary and Integer constraints
    if (!this.rhsRange[constraint]) {
      continue;
    }

    var values = this.getConstraintValues(constraint);
    var zeroedLhsValues = values.lhsValues;
    var zeroedRhsValues = values.rhsValues;

    for (m = 0; m < zeroedLhsValues.length; m++) {
      for (n = 0; n < zeroedLhsValues[m].length; n++) {
        var coeff = -zeroedLhsValues[m][n];
        if (this.rhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
          // Making it work for column LHS with row RHS and vice versa
          if (zeroedLhsValues.length === zeroedRhsValues.length) {
            coeff += zeroedRhsValues[m][n];
          } else {
            coeff += zeroedRhsValues[n][m];
          }
        } else { // SolverInputType.SINGLE_CELL_RANGE
          coeff += zeroedRhsValues[0][0];
        }
        this.rhs[row] = coeff;
        row += 1;
      }
    }
  }
  return true;
}

OpenSolver.prototype.buildVariableTerms = function(linearityOffset) {
  // Create SparseA
  for (var row = 0; row < this.numRows; row++) {
    // Don't overwrite if already present, e.g. when resuming
    this.sparseA[row] = this.sparseA[row] || new IndexedCoeffs();
  }
  // Create CostCoeffs
  // Don't overwrite if already present, e.g. when resuming
  this.costCoeffs = this.costCoeffs || new IndexedCoeffs();

  this.setAllVariableValues(linearityOffset);
  this.setAllBinaryVariableValues(0);

  // Get all values at the linearity offset
  var lhsOriginalValues = [];
  var rhsOriginalValues = [];
  for (var constraint = 0; constraint < this.numConstraints; constraint++) {
    if (!this.rhsRange[constraint]) {
      continue;
    }

    var originalValues = this.getConstraintValues(constraint);
    lhsOriginalValues[constraint] = originalValues.lhsValues;
    rhsOriginalValues[constraint] = originalValues.rhsValues;
  }

  var originalObjectiveValue;
  if (this.objective) {
    originalObjectiveValue = this.getObjectiveValue();
  }

  var start = this.startVariable;
  for (var i = this.startVariable; i < this.numVars; i++) {
    if (i % 10 === 0) {
      updateStatus('Building variable ' + (i + 1) + '/' + this.numVars,
                   'Solving Model');

      // Save progress to cache
      this.updateCache();

      // // For testing termination
      // if (i !== start) { throw(makeError('stop while building')); };
    }

    var currentCell = this.getVariableByIndex(i);
    var baseValue = this.varTypes[i] === VariableType.BINARY ? 0
                                                             : linearityOffset;
    currentCell.setValue(baseValue + 1);

    // The objective function value change
    if (this.objective) {
      var objCoeff = this.getObjectiveValue() - originalObjectiveValue;
      if (Math.abs(objCoeff) > EPSILON) {
        this.costCoeffs.add(i, objCoeff);
      }
    }
    // The constraint changes
    var row = 0;
    for (var constraint = 0; constraint < this.numConstraints; constraint++) {
      // Skip Binary and Integer constraints
      if (!this.rhsRange[constraint]) {
        continue;
      }

      var originalLhsValues = lhsOriginalValues[constraint];
      var originalRhsValues = rhsOriginalValues[constraint];

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

    currentCell.setValue(baseValue);
    this.startVariable = i + 1;
  }

  return true;
};

OpenSolver.prototype.quickFeasibilityCheck = function() {
  // Check all empty constraints are satisfied
  for (var row = 0; row < this.numRows; row++) {
    if (this.sparseA[row].count() === 0) {
      var constraint = this.rowToConstraint[row];
      var rel = this.relation[constraint];
      var rhs = this.rhs[row];
      Logger.log('Validate: row ' + row + ' relation ' + rel + ' rhs ' + rhs);
      if ((rel === Relation.GE && rhs > EPSILON) ||
          (rel === Relation.LE && rhs < -EPSILON) ||
          (rel === Relation.EQ && Math.abs(rhs) > EPSILON)) {
        var instance = this.getConstraintInstance(row, constraint);
        var position = this.getArrayPosition(constraint, instance);
        var i = position.i - 1;
        var j = position.j - 1;

        var lhsRange = this.lhsRange[constraint].getCell(position.i,
                                                         position.j);
        var lhsValue = lhsRange.getValue();

        var rhsRange;
        if (this.rhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
          rhsRange = this.rhsRange[constraint].getCell(position.i, position.j);
        } else {
          rhsRange = this.rhsRange[constraint].getCell(1, 1);
        }
        var rhsValue = rhsRange.getValue();

        this.solveStatus = OpenSolverResult.INFEASIBLE;
        this.solveStatusString = 'Infeasible';
        this.solveStatusComment =
            'The model contains a constraint in the group ' +
            this.constraintSummary[constraint] + ' ' +
            'which does not depend on the decision variables and is not ' +
            'satisfied.\n\n' +
            'Constraint specifies: \n' +
            'LHS: ' + lhsRange.getA1Notation() + ' = ' + lhsValue + '\n' +
            ' ' + relationConstToString(rel) + '\n' +
            'RHS: ' + rhsRange.getA1Notation() + ' = ' + rhsValue;
        return false;
      }
    }
  }

  // Check empty objective if it's a target
  if (this.objectiveSense == ObjectiveSenseType.TARGET) {
    if (this.costCoeffs.count() === 0 &&
        Math.abs(this.objectiveTarget - this.objectiveConstant) > EPSILON) {
      this.solveStatus = OpenSolverResult.INFEASIBLE;
      this.solveStatusString = 'Infeasible';
      this.solveStatusComment =
          'The objective cell does not depend on the adjustable cells and ' +
          'has a value different to the specified target value. ' +
          'This means the target value cannot be attained.'
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

  var t0 = new Date();

  this.solver = this.solver || createSolver(this.solverShortName);
  var result = this.solver.solve(this);

  var t1 = new Date();
  Logger.log("Solve took " + (t1 - t0) + " milliseconds.")

  this.solveStatus = result.solveStatus;
  this.solveStatusString = result.solveStatusString;
  Logger.log(this.solveStatus);
  Logger.log(this.solveStatusString);
  this.solutionWasLoaded = result.loadSolution;

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
      this.varValues[i] = this.solver.getVariableValue(name) || 0;
      var coeffs = name.split('_').map(Number);
      valuesToSet[coeffs[0]][coeffs[1]][coeffs[2]] = this.varValues[i];
    }
    Logger.log(valuesToSet);
    for (var i = 0; i < this.numVariableAreas; i++) {
      this.variableAreas[i].setValues(valuesToSet[i]);
    }
  }

  // TODO write duals

};

OpenSolver.prototype.getConstraintInstance = function(row, constraint) {
  return row - this.constraintToRow[constraint];
};

OpenSolver.prototype.getArrayPosition = function(constraint, instance) {
  var dim = this.lhsRangeSizes[constraint].cols;
  var i = 1 + parseInt(instance / dim, 10);
  var j = 1 + (instance % dim);
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
      this.solveStatus !== OpenSolverResult.ABORTED_THRU_USER_ACTION &&
      this.solveStatus !== OpenSolverResult.PENDING) {
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

OpenSolver.prototype.quickLinearityCheck = function() {
  Logger.log('start linearity check');

  // Do a better check for binary non-linearity - build from 0, check at 1
  this.setAllBinaryVariableValues(1);

  var varValues = [];
  for (var i = 0; i < this.numVars; i++) {
    varValues[i] = this.varTypes[i] == VariableType.BINARY
                       ? 1 : this.linearityOffset;
  }

  var nonLinearInfo = '';
  var nonLinearCount = 0;
  var rowIsNonLinear = {}; // Object for sparse storage
  var row = 0;
  for (var constraint = 0; constraint < this.numConstraints; constraint++) {
    if (!this.rhsRange[constraint]) {
      continue;
    }

    var values = this.getConstraintValues(constraint);
    var currentLhsValues = values.lhsValues;
    var currentRhsValues = values.rhsValues;

    for (m = 0; m < currentLhsValues.length; m++) {
      for (n = 0; n < currentLhsValues[m].length; n++) {
        // Get current constraint value
        var conObservedValue = currentLhsValues[m][n];
        if (this.rhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
          // Making it work for column LHS with row RHS and vice versa
          if (currentLhsValues.length === currentRhsValues.length) {
            conObservedValue -= currentRhsValues[m][n];
          } else {
            conObservedValue -= currentRhsValues[n][m];
          }
        } else { // SolverInputType.SINGLE_CELL_RANGE
          conObservedValue -= currentRhsValues[0][0];
        }

        // Get predicted value from Ax = b
        // Track largest value we encounter to get some idea of expected error
        var conResult = this.sparseA[row].evaluate(varValues);
        var conExpectedValue = conResult.value - this.rhs[row];
        var conMaxValue = Math.max(conResult.max, Math.abs(this.rhs[row]));
        var conThreshold = Math.max(EPSILON, EPSILON * conMaxValue);

        if (this.ratioTest(conObservedValue, conExpectedValue, conThreshold)) {
          var constraint = this.rowToConstraint[row];
          var instance = this.getConstraintInstance(row, constraint);
          var position = this.getArrayPosition(constraint, instance);
          var lhsCellNotation = this.lhsRange[constraint]
              .getCell(position.i, position.j)
              .getA1Notation();

          var rhsCell = this.rhsRange[constraint];
          if (this.rhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
            rhsCell = rhsCell.getCell(position.i, position.j);
          }
          var rhsCellNotation = rhsCell.getA1Notation();

          nonLinearInfo += '\n' + this.constraintSummary[constraint];
          if (this.lhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
            nonLinearInfo += ' (instance ' + (instance + 1) + ')';
          }
          nonLinearInfo += ': LHS=' + lhsCellNotation + ', RHS=' + rhsCellNotation + ', ' +
                           conExpectedValue.toPrecision(4)  + ' != ' +
                           conObservedValue.toPrecision(4);
          rowIsNonLinear[row] = true;
        }

        row++;
      }
    }
  }

  if (nonLinearInfo) {
    nonLinearInfo = 'The following constraint(s) do not appear to be linear: ' +
                     '\n' + nonLinearInfo + '\n\n';
  }

  var objNonLinear = false;
  if (this.objective) {
    var objObservedValue = this.getObjectiveValue();

    var objResult = this.costCoeffs.evaluate(varValues);
    var objExpectedValue = objResult.value + this.objectiveConstant;
    var objMaxValue = Math.max(objResult.max, Math.abs(this.objectiveConstant));
    var objThreshold = Math.max(EPSILON, EPSILON * objMaxValue)

    if (this.ratioTest(objObservedValue, objExpectedValue, objThreshold)) {
      objNonLinear = true;
      nonLinearInfo = 'The objective function is not linear. Expected ' +
                      objExpectedValue.toPrecision(4) + ', got ' +
                      objObservedValue.toPrecision(4) + '\n\n' + nonLinearInfo;
    }
  }

  if (nonLinearInfo) {
    this.solveStatus = OpenSolverResult.NOT_LINEAR;
    if (!this.minimiseUserInteraction) {
      var ui = SpreadsheetApp.getUi();
      var response = ui.alert(
          'OpenSolver Quick Linearity Check',
          nonLinearInfo + 'Would you like to run a full linearity check? ',
          ui.ButtonSet.YES_NO);
      if (response === ui.Button.YES) {
        this.fullLinearityCheck();
      }
      return false;
    }
  }

  return true;
};

OpenSolver.prototype.fullLinearityCheck = function() {
  // Build each matrix and cost vector where the decision variables start at
  // the base linearity offset, 1 and 10.
  var valueBase = this.sparseA.slice();
  var costCoeffsBase = this.costCoeffs;

  this.sparseA = [];
  this.costCoeffs = new IndexedCoeffs();
  this.startVariable = 0;
  this.buildVariableTerms(1);
  var valueOne = this.sparseA.slice();
  var costCoeffsOne = this.costCoeffs;

  this.sparseA = [];
  this.costCoeffs = new IndexedCoeffs();
  this.startVariable = 0;
  this.buildVariableTerms(10);
  var valueTen = this.sparseA.slice();
  var costCoeffsTen = this.costCoeffs;

  // Check constraint linearities
  var nonLinearInfo = '';
  var rowIsNonLinear = [];

  for (var row = 0; row < this.numRows; row++) {
    var nonLinearConVars = this.compareSparseVectors(valueBase[row],
                                                     valueOne[row],
                                                     valueTen[row]);
    Logger.log(nonLinearConVars);
    if (nonLinearConVars.length > 0) {
      // Constraint is non-linear
      var constraint = this.rowToConstraint[row];

      nonLinearInfo += '\n' + this.constraintSummary[constraint];
      if (this.lhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
        var instance = this.getConstraintInstance(row, constraint);
        nonLinearInfo += ' (instance ' + (instance + 1) + ')';
      }
      nonLinearInfo += ' is non-linear in variable(s): ' +
                       this.getVarNames(nonLinearConVars).join(', ');

      rowIsNonLinear.push(row);
    }
  }
  if (nonLinearInfo) {
    nonLinearInfo = 'The following constraint(s) do not appear to be linear: ' +
                    '\n' + nonLinearInfo;
  }

  // Check obj linearity
  var objNonLinear = false;
  var nonLinearObjVars = this.compareSparseVectors(costCoeffsBase,
                                                   costCoeffsOne,
                                                   costCoeffsTen);
  if (nonLinearObjVars.length > 0) {
    objNonLinear = true;
    if (nonLinearInfo !== "") {
      nonLinearInfo += '\n\n';
    }
    nonLinearInfo += 'The objective function appears to be non-linear in ' +
                     'variable(s): ' +
                     this.getVarNames(nonLinearObjVars).join(', ');
  }

  if (nonLinearInfo) {
    if (!this.minimiseUserInteraction) {
      var ui = SpreadsheetApp.getUi();
      ui.alert('OpenSolver Full Linearity Check', nonLinearInfo,
               ui.ButtonSet.OK);
    }
  }

};

// TODO lift me out of openSolver and test
OpenSolver.prototype.compareSparseVectors = function(v1, v2, v3) {
  var numEntries = Math.max(v1.count(), v2.count(), v3.count());
  var varIndices = [];

  for (var i = 0; i < numEntries; i++) {
    var varIndex = -1;
    // Check existence in all vectors
    if (v1.index(i) !== null && v2.index(i) !== null && v3.index(i) !== null) {
      if (this.ratioTest(v1.coeff(i), v2.coeff(i)) ||
          this.ratioTest(v1.coeff(i), v3.coeff(i))) {
        varIndex = v1.index(i);
        Logger.log('Different values for var ' + varIndex);
      }
    } else {
      varIndex = v1.index(i) || v2.index(i) || v3.index(i);
      Logger.log('Var ' + varIndex + ' not present in all');
    }

    if (varIndex > -1) {
      varIndices.push(varIndex);
    }
  }
  return varIndices;
};

OpenSolver.prototype.getVarNames = function(indices) {
  var varNames = [];
  for (var i = 0; i < indices.length; i++) {
    varNames.push(this.varNames[indices[i]]);
  }
  return varNames;
};

// TODO lift me out of opensolver and test
OpenSolver.prototype.ratioTest = function(c1, c2, threshold) {
  if (!isNumber(threshold)) {
    threshold = EPSILON;
  }
  var ratio = Math.abs(c1 - c2) / (1 + Math.abs(c1));
  return !isNumber(ratio) || ratio > threshold;
};

OpenSolver.prototype.updateCache = function() {
  updateOpenSolverCache(this);
};

OpenSolver.prototype.deleteCache = function() {
  deleteOpenSolverCache();
};

OpenSolver.prototype.doFastBuild = function() {
  try {
    // Pre-fetch all formulae and values at the same time so they are batched

    // Fetch the sheet values first, this will batch everything afterwards
    // Otherwise the smaller calls before this won't batch with it.
    var values = this.sheet.getSheetValues(1, 1, -1, -1);

    // Objective formula
    var objFormula = this.objective.getFormula();

    // LHS formulae and RHS values
    var allLhsFormulas = [];
    var allRhsValues = [];
    var row = 0;
    for (var constraint = 0; constraint < this.numConstraints; constraint++) {
      // Skip Binary and Integer constraints
      if (!this.rhsRange[constraint]) {
        continue;
      }

      allLhsFormulas[constraint] = this.lhsRange[constraint].getFormulas();
      allRhsValues[constraint] = this.getConstraintValues(constraint).rhsValues;
    }
    // End of pre-fetching

    // Objective
    this.costCoeffs = validateFormula(objFormula, this.varNameMap, values);

    // Constraints
    for (var constraint = 0; constraint < this.numConstraints; constraint++) {
      // Skip Binary and Integer constraints
      if (!this.rhsRange[constraint]) {
        continue;
      }

      var lhsFormulas = allLhsFormulas[constraint];
      var rhsValues = allRhsValues[constraint];

      for (var m = 0; m < lhsFormulas.length; m++) {
        for (var n = 0; n < lhsFormulas[m].length; n++) {
          // Get coefficients from LHS
          this.sparseA[row] = validateFormula(lhsFormulas[m][n],
                                              this.varNameMap, values);

          // Get constant from RHS
          var rhs;
          if (this.rhsType[constraint] === SolverInputType.MULTI_CELL_RANGE) {
            // Making it work for column LHS with row RHS and vice versa
            if (lhsFormulas.length === rhsValues.length) {
              rhs = rhsValues[m][n];
            } else {
              rhs = rhsValues[n][m];
            }
          } else { // SolverInputType.SINGLE_CELL_RANGE
            rhs = rhsValues[0][0];
          }
          this.rhs[row] = rhs;

          row += 1;
        }
      }
    }

//    // Now go through and pull in all values for the sumproduct ranges so they
//    // get batched
//    // Any vector that needs processing is NOT an IndexedCoeffs, but instead
//    // has properties `varIndices` and `constRange`. Use this to figure out
//    // which to process.
//
//    // Objective
//    if (this.costCoeffs.varIndices !== undefined) {
//      this.costCoeffs = processSumProduct(this.costCoeffs, this);
//    }
//
//    // Constraints
//    for (var row = 0; row < this.numRows; row++) {
//      if (this.sparseA[row].varIndices !== undefined) {
//        this.sparseA[row] = processSumProduct(this.sparseA[row], this);
//      }
//    }
  } catch(e) {
    throw makeError('There was an error while running Fast Build:\n' + e);
  }
  return true;
}
