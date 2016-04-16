SolverGlpk = function() {
  Solver.call(this);

  this.hasSolved = false;

  // Result details
  this.status = GlpkStatus.GLP_UNDEF;
  this.objectiveValue = null;
  this.variableValues = {};

  return this;
};

SolverGlpk.prototype = Object.create(Solver.prototype);
SolverGlpk.prototype.constructor = SolverGlpk;

var GlpkStatus = {
  GLP_UNDEF:  1,
  GLP_FEAS:   2,
  GLP_INFEAS: 3,
  GLP_NOFEAS: 4,
  GLP_OPT:    5,
  GLP_UNBND:  6,
};

SolverGlpk.prototype.getStatus = function() {
  var result;
  var solveString;
  var loadSolution = false;

  if (!this.hasSolved) {
    result = OpenSolverResult.PENDING;
    solveString = 'The solve has not yet completed';
  } else {
    switch (this.status) {
      case GlpkStatus.GLP_UNDEF:
        result = OpenSolverResult.UNSOLVED;
        solveString = 'The model has not yet been solved.';
        break;
      case GlpkStatus.GLP_FEAS:
        result = OpenSolverResult.TIME_LIMITED_SUB_OPTIMAL;
        solveString = 'An optimal solution was not found. The best feasible solution found was loaded instead.';
        loadSolution = true;
        break;
      case GlpkStatus.GLP_INFEAS:
        result = OpenSolverResult.INFEASIBLE;
        solveString = 'The model is infeasible.';
        break;
      case GlpkStatus.GLP_NOFEAS:
        result = OpenSolverResult.INFEASIBLE;
        solveString = 'No feasible solution was found.';
        break;
      case GlpkStatus.GLP_OPT:
        result = OpenSolverResult.OPTIMAL;
        solveString = 'Optimal';
        loadSolution = true;
        break;
      case GlpkStatus.GLP_UNBND:
        result = OpenSolverResult.UNBOUNDED;
        solveString = 'No solution found (Unbounded)';
        break;
    }
  }

  return {
    solveStatus:       result,
    solveStatusString: solveString,
    loadSolution:      loadSolution
  };
};

SolverGlpk.prototype.getObjectiveValue = function() {
  return this.objectiveValue;
};

SolverGlpk.prototype.getVariableValue = function(varKey) {
  var value = this.variableValues[varKey];
  if (value === undefined) {
    value = null;
  }
  return value;
};

SolverGlpk.prototype.solve = function(openSolver) {
  if (!this.hasSolved) {
    // If we haven't solved the model, start the solve client-side
    this.startJob(openSolver);
  } else {
    // Otherwise the results have already been loaded in
  }

  return this.getStatus();
};

SolverGlpk.prototype.startJob = function(openSolver) {
  var gmplModel = createGmplModel(openSolver);

  var HEIGHT = 480;
  var t = HtmlService.createTemplateFromFile('glpkRunner');
  t.height = HEIGHT;
  t.gmplModel = gmplModel;
  t.autoClose = !openSolver.showStatus;
  var glpkRunner = t.evaluate()
    .setHeight(HEIGHT)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi()
    .showModalDialog(glpkRunner, 'Solving model using GLPK');
};

SolverGlpk.prototype.loadFromCache = function(data) {
  var keys = data ? Object.keys(data) : [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    this[key] = data[key];
  }
  return this;
};

SolverGlpk.prototype.insertResults = function(results) {
  this.hasSolved = true;
  this.status = results.status;
  this.objectiveValue = results.objectiveValue;
  this.variableValues = results.variableValues;
};
