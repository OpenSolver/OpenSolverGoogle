// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

function solverGoogleTest() {

QUnit.module('solverGoogle');

var googleStatuses = [
  'ABNORMAL',
  'FEASIBLE',
  'INFEASIBLE',
  'MODEL_INVALID',
  'NOT_SOLVED',
  'OPTIMAL',
  'UNBOUNDED'
];

var openSolverStatuses = [
  'ERROR_OCCURRED',
  'TIME_LIMITED_SUB_OPTIMAL',
  'INFEASIBLE',
  'ERROR_OCCURRED',
  'UNSOLVED',
  'OPTIMAL',
  'UNBOUNDED'
];

var loadSolutions = [
  false,
  true,
  false,
  false,
  false,
  true,
  false
];

OpenSolver.MockLinearOptimizationSolution = function(status) {
  this.status = status;
};

OpenSolver.MockLinearOptimizationSolution.prototype.getStatus = function() { return this.status; };
OpenSolver.MockLinearOptimizationSolution.prototype.isValid = function() {
  return this.status === LinearOptimizationService.Status.FEASIBLE ||
         this.status === LinearOptimizationService.Status.OPTIMAL;
};

QUnit.test('getStatus', googleStatuses.length * 2, function(assert) {
  for (var i = 0; i < googleStatuses.length; i++) {
    var solver = new OpenSolver.SolverGoogle();
    solver.solution = new OpenSolver.MockLinearOptimizationSolution(LinearOptimizationService.Status[googleStatuses[i]]);
    var result = solver.getStatus();

    assert.equal(result.solveStatus,
                 OpenSolver.consts.openSolverResult[openSolverStatuses[i]],
                 'solveStatus: ' + googleStatuses[i] + rightArrow + openSolverStatuses[i]);
    assert.equal(result.loadSolution,
                 loadSolutions[i],
                 'loadSolution: ' + googleStatuses[i] + rightArrow + loadSolutions[i]);
  }
});

}
