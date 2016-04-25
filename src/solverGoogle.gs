SolverGoogle = function() {
  Solver.call(this);
  this.solution = new MockLinearOptimizationSolution('NOT_SOLVED');
};

SolverGoogle.prototype = Object.create(Solver.prototype);
SolverGoogle.prototype.constructor = SolverGoogle;

SolverGoogle.prototype.getStatus = function() {
  var result;
  var solveString;
  switch (this.solution.getStatus()) {
    case LinearOptimizationService.Status.ABNORMAL:
      result = OpenSolverResult.ERROR_OCCURRED;
      solveString = 'The solver failed to find a solution for unknown reasons.';
      break;
    case LinearOptimizationService.Status.FEASIBLE:
      result = OpenSolverResult.TIME_LIMITED_SUB_OPTIMAL;
      solveString = 'An optimal solution was not found. A feasible solution was loaded instead.';
      break;
    case LinearOptimizationService.Status.INFEASIBLE:
      result = OpenSolverResult.INFEASIBLE;
      solveString = 'No feasible solution was found.';
      break;
    case LinearOptimizationService.Status.MODEL_INVALID:
      result = OpenSolverResult.ERROR_OCCURRED;
      solveString = 'The solver failed to find a solution because the model was invalid.';
      break;
    case LinearOptimizationService.Status.NOT_SOLVED:
      result = OpenSolverResult.UNSOLVED;
      solveString = 'The model has not yet been solved.';
      break;
    case LinearOptimizationService.Status.OPTIMAL:
      result = OpenSolverResult.OPTIMAL;
      solveString = 'Optimal';
      break;
    case LinearOptimizationService.Status.UNBOUNDED:
      result = OpenSolverResult.UNBOUNDED;
      solveString = 'No solution found (Unbounded)';
      break;
  }

  return {
    solveStatus: result,
    solveStatusString: solveString,
    loadSolution: this.solution ? this.solution.isValid() : false
  };
};

SolverGoogle.prototype.getObjectiveValue = function() {
  return this.solution ? this.solution.getObjectiveValue() : null;
};

SolverGoogle.prototype.getVariableValue = function(varKey) {
  return this.solution ? this.solution.getVariableValue(varKey) : null;
};

SolverGoogle.prototype.solve = function(openSolver) {
  updateStatus('Model is being solved by solver', 'Solving Model', true);

  this.engine = LinearOptimizationService.createEngine();

  var lowerBound = -Infinity;
  var upperBound = Infinity;

  for (var i = 0; i < openSolver.numVars; i++) {
    if (openSolver.varTypes[i] === VariableType.BINARY) {
      this.engine.addVariable(openSolver.varKeys[i], 0, 1, LinearOptimizationService.VariableType.INTEGER);
    } else {
      // Check if explicit lower bound is present
      var tempLowerBound = lowerBound;
      if (openSolver.lowerBoundedVariables[i] === undefined &&
          openSolver.assumeNonNegativeVars) {
        tempLowerBound = 0;
      }
      Logger.log('adding var ' + i + ' with lower bound ' + tempLowerBound);

      if (openSolver.varTypes[i] === VariableType.INTEGER) {
        Logger.log(openSolver.varKeys[i] + ' ' + tempLowerBound + ' ' + upperBound);
        this.engine.addVariable(openSolver.varKeys[i], tempLowerBound, upperBound, LinearOptimizationService.VariableType.INTEGER);
      } else { // VariableType.CONTINUOUS:
        this.engine.addVariable(openSolver.varKeys[i], tempLowerBound, upperBound);
      }
    }
  }

  if (openSolver.objectiveSense == ObjectiveSenseType.MAXIMISE) {
    this.engine.setMaximization();
  } else {
    this.engine.setMinimization();
  }

  for (var row = 0; row < openSolver.numRows; row++) {
    var currConstraint = openSolver.sparseA[row];

    // Skip over any empty constraint, we have already verified it holds
    if (currConstraint.count() === 0) {
      continue;
    }

    var lowerBound = openSolver.rhs[row];
    var upperBound = openSolver.rhs[row];
    var rel = openSolver.relation[openSolver.rowToConstraint[row]];
    if (rel == Relation.GE) {
      upperBound = Infinity;
    } else if (rel == Relation.LE) {
      lowerBound = -Infinity;
    }
    Logger.log(openSolver.rhs);
    Logger.log(lowerBound);
    Logger.log(upperBound);
    var constraint = this.engine.addConstraint(lowerBound, upperBound);
    for (var i = 0; i < currConstraint.count(); i++) {
      var index = currConstraint.index(i);
      var coeff = currConstraint.coeff(i);
      constraint.setCoefficient(openSolver.varKeys[index], coeff);
    }
  }

  if (openSolver.objectiveSense != ObjectiveSenseType.TARGET) {
    // Add in objective coefficients unless we are seeking a target value
    for (var objVar = 0; objVar < openSolver.costCoeffs.count(); objVar++) {
      this.engine.setObjectiveCoefficient(
          openSolver.varKeys[openSolver.costCoeffs.index(objVar)],
          openSolver.costCoeffs.coeff(objVar)
      );
    }
  } else {
    // Minimize abs(objective - target) if we are seeking a value
    this.engine.addVariable('objValue', -Infinity, Infinity);
    this.engine.addVariable('difference', 0, Infinity);

    // Add constraint `objValue = <objective function>`
    var constraint = this.engine.addConstraint(openSolver.objectiveConstant,
                                               openSolver.objectiveConstant);
    for (var objVar = 0; objVar < openSolver.costCoeffs.count(); objVar++) {
      var objConVarKey = openSolver.varKeys[openSolver.costCoeffs.index(objVar)];
      var objConVarCoeff = openSolver.costCoeffs.coeff(objVar);
      constraint.setCoefficient(objConVarKey, objConVarCoeff);
      Logger.log([objConVarKey, objConVarCoeff]);
    }
    constraint.setCoefficient('objValue', -1);

    var targetValue = openSolver.objectiveTarget;
    Logger.log(targetValue);

    // Add constraint for `difference >= objValue - targetValue`
    var constraint = this.engine.addConstraint(-targetValue, Infinity);
    constraint.setCoefficient('difference', 1);
    constraint.setCoefficient('objValue', -1);

    // Add constraint for `difference >= -objValue + targetValue`
    var constraint = this.engine.addConstraint(targetValue, Infinity);
    constraint.setCoefficient('difference', 1);
    constraint.setCoefficient('objValue', 1);

    // Minimize `difference`
    this.engine.setMinimization();
    this.engine.setObjectiveCoefficient('difference', 1)
  }

  updateStatus('Solving model...', 'Solving Model');

  this.solution = this.engine.solve();
  return this.getStatus();
};

MockLinearOptimizationSolution = function(status) {
  this.status = LinearOptimizationService.Status[status];
};

MockLinearOptimizationSolution.prototype.getStatus = function() {
  return this.status;
};

MockLinearOptimizationSolution.prototype.isValid = function() {
  return this.status === LinearOptimizationService.Status.FEASIBLE ||
         this.status === LinearOptimizationService.Status.OPTIMAL;
};
