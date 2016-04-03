Solver = function() {};

Solver.prototype.getStatus = function() {
  return {
    solveStatus: OpenSolverResult.NOT_SOLVED,
    solveStatusString: 'The model has not yet been solved.',
    loadSolution: false
  };
};

Solver.prototype.getObjectiveValue = function() {
  return NaN;
};

Solver.prototype.getVariableValue = function(varKey) {
  return NaN;
};

Solver.prototype.solve = function(openSolver) {
  return this.getStatus;
};

Solver.prototype.loadFromCache = function() {
  return this;
};
