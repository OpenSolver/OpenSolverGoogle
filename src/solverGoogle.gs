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
      if (openSolver.lowerBoundedVariables[i] !== true && openSolver.assumeNonNegativeVars) {
        tempLowerBound = 0;
      }
      Logger.log(openSolver.lowerBoundedVariables[i] !== true);
      Logger.log('adding var ' + i + ' with lower bound ' + tempLowerBound);

      if (openSolver.varTypes[i] === VariableType.INTEGER) {
        Logger.log(openSolver.varKeys[i] + ' ' + tempLowerBound + ' ' + upperBound);
        this.engine.addVariable(openSolver.varKeys[i], tempLowerBound, upperBound, LinearOptimizationService.VariableType.INTEGER);
      } else { // VariableType.CONTINUOUS:
        this.engine.addVariable(openSolver.varKeys[i], tempLowerBound, upperBound);
      }
    }

    // Add in objective coefficients unless we are seeking a target value
    if (openSolver.objectiveSense != ObjectiveSenseType.TARGET) {
      this.engine.setObjectiveCoefficient(openSolver.varKeys[i], openSolver.costCoeffs[i]);
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

  // Add constraint forcing objective == target if we are seeking a value
  if (openSolver.objectiveSense == ObjectiveSenseType.TARGET) {
    var targetValue = openSolver.objectiveTarget - openSolver.objectiveConstant;
    Logger.log(targetValue);
    var constraint = this.engine.addConstraint(targetValue, targetValue);
    for (var i = 0; i < openSolver.numVars; i++) {
      constraint.setCoefficient(openSolver.varKeys[i], openSolver.costCoeffs[i]);
      Logger.log([openSolver.varKeys[i], openSolver.costCoeffs[i]]);
    }
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
