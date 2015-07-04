function testSolverGoogle() {

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

QUnit.test('getStatus', googleStatuses.length * 2, function(assert) {
  for (var i = 0; i < googleStatuses.length; i++) {
    var googleStatus = googleStatuses[i];
    var status = openSolverStatuses[i];
    var loadSol = loadSolutions[i];

    var solver = new SolverGoogle();
    solver.solution = new MockLinearOptimizationSolution(googleStatus);
    var result = solver.getStatus();

    assert.equal(result.solveStatus,
                 OpenSolverResult[status],
                 'solveStatus: ' + googleStatus + rightArrow + status);
    assert.equal(result.loadSolution,
                 loadSol,
                 'loadSolution: ' + googleStatus + rightArrow + loadSol);
  }
});

}
