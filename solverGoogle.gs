// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

OpenSolver.SolverGoogle = function() {
  OpenSolver.Solver.call(this);
};

OpenSolver.SolverGoogle.prototype = Object.create(OpenSolver.Solver.prototype);
OpenSolver.SolverGoogle.prototype.constructor = OpenSolver.SolverGoogle;

OpenSolver.SolverGoogle.prototype.getStatus = function() {
  var result;
  var solveString;
  switch (this.solution.getStatus()) {
    case LinearOptimizationService.Status.ABNORMAL:
      result = OpenSolver.consts.openSolverResult.ERROR_OCCURRED;
      solveString = 'The solver failed to find a solution for unknown reasons.';
      break;
    case LinearOptimizationService.Status.FEASIBLE:
      result = OpenSolver.consts.openSolverResult.TIME_LIMITED_SUB_OPTIMAL;
      solveString = 'An optimal solution was not found. A feasible solution was loaded instead.';
      break;
    case LinearOptimizationService.Status.INFEASIBLE:
      result = OpenSolver.consts.openSolverResult.INFEASIBLE;
      solveString = 'No feasible solution was found.';
      break;
    case LinearOptimizationService.Status.MODEL_INVALID:
      result = OpenSolver.consts.openSolverResult.ERROR_OCCURRED;
      solveString = 'The solver failed to find a solution because the model was invalid.';
      break;
    case LinearOptimizationService.Status.NOT_SOLVED:
      result = OpenSolver.consts.openSolverResult.UNSOLVED;
      solveString = 'The model has not yet been solved.';
      break;
    case LinearOptimizationService.Status.OPTIMAL:
      result = OpenSolver.consts.openSolverResult.OPTIMAL;
      solveString = 'Optimal';
      break;
    case LinearOptimizationService.Status.UNBOUNDED:
      result = OpenSolver.consts.openSolverResult.UNBOUNDED;
      solveString = 'No solution found (Unbounded)';
      break;
  }

  return {
    solveStatus: result,
    solveStatusString: solveString,
    loadSolution: this.solution.isValid()
  };
};

OpenSolver.SolverGoogle.prototype.getObjectiveValue = function() {
  return this.solution ? this.solution.getObjectiveValue() : null;
};

OpenSolver.SolverGoogle.prototype.getVariableValue = function(varKey) {
  return this.solution ? this.solution.getVariableValue(varKey) : null;
};

OpenSolver.SolverGoogle.prototype.solve = function(openSolver) {
  this.engine = LinearOptimizationService.createEngine();

  var lowerBound = -Infinity;
  var upperBound = Infinity;

  for (var i = 0; i < openSolver.numVars; i++) {
    if (openSolver.varTypes[i] === OpenSolver.consts.variableType.BINARY) {
      this.engine.addVariable(openSolver.varKeys[i], 0, 1, LinearOptimizationService.VariableType.INTEGER);
    } else {
      // Check if explicit lower bound is present
      var tempLowerBound = lowerBound;
      if (openSolver.lowerBoundedVariables[i] !== true && openSolver.assumeNonNegativeVars) {
        tempLowerBound = 0;
      }
      Logger.log(openSolver.lowerBoundedVariables[i] !== true)
      Logger.log('adding var ' + i + ' with lower bound ' + tempLowerBound);

      if (openSolver.varTypes[i] === OpenSolver.consts.variableType.INTEGER) {
        Logger.log(openSolver.varKeys[i] + ' ' + tempLowerBound + ' ' + upperBound);
        this.engine.addVariable(openSolver.varKeys[i], tempLowerBound, upperBound, LinearOptimizationService.VariableType.INTEGER);
      } else { // OpenSolver.consts.variableType.CONTINUOUS:
        this.engine.addVariable(openSolver.varKeys[i], tempLowerBound, upperBound);
      }
    }

    // Add in objective coefficients unless we are seeking a target value
    if (!(openSolver.objectiveSense == OpenSolver.consts.objectiveSenseType.TARGET)) {
      this.engine.setObjectiveCoefficient(openSolver.varKeys[i], openSolver.costCoeffs[i]);
    }
  }

  if (openSolver.objectiveSense == OpenSolver.consts.objectiveSenseType.MAXIMISE) {
    this.engine.setMaximization();
  } else {
    this.engine.setMinimization();
  }

  for (var row = 0; row < openSolver.numRows; row++) {
    var currConstraint = openSolver.sparseA[row];

    if (currConstraint.count() === 0) {
      var invalid = openSolver.validateEmptyConstraint(row);
      if (invalid !== false) {
        return invalid;
      }
    } else {
      var lowerBound = openSolver.rhs[row];
      var upperBound = openSolver.rhs[row];
      if (openSolver.relation[row] == OpenSolver.consts.relation.GE) {
        upperBound = Infinity;
      } else if (openSolver.relation[row] == OpenSolver.consts.relation.LE) {
        lowerBound = -Infinity;
      }
      Logger.log(openSolver.rhs)
      Logger.log(lowerBound)
      Logger.log(upperBound)
      var constraint = this.engine.addConstraint(lowerBound, upperBound);
      for (var i = 0; i < currConstraint.count(); i++) {
        var index = currConstraint.index(i);
        var coeff = currConstraint.coeff(i);
        constraint.setCoefficient(openSolver.varKeys[index], coeff);
      }
    }
  }

  // Add constraint forcing objective == target if we are seeking a value
  if (openSolver.objectiveSense == OpenSolver.consts.objectiveSenseType.TARGET) {
    Logger.log(openSolver.objectiveTarget)
    var constraint = this.engine.addConstraint(openSolver.objectiveTarget, openSolver.objectiveTarget);
    for (var i = 0; i < openSolver.numVars; i++) {
      constraint.setCoefficient(openSolver.varKeys[i], openSolver.costCoeffs[i]);
      Logger.log([openSolver.varKeys[i], openSolver.costCoeffs[i]]);
    }
  }

  OpenSolver.util.updateStatus('Solving model...', 'Solving Model');

  this.solution = this.engine.solve();
  return this.getStatus();
};
