function testSolverGoogle(test) {

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

test('solverGoogle - getStatus', function(t) {
  for (var i = 0; i < googleStatuses.length; i++) {
    var googleStatus = googleStatuses[i];
    var status = openSolverStatuses[i];
    var loadSol = loadSolutions[i];

    var solver = new SolverGoogle();
    solver.solution = new MockLinearOptimizationSolution(googleStatus);
    var result = solver.getStatus();

    t.equal(result.solveStatus,
            OpenSolverResult[status],
            'solveStatus: ' + googleStatus + rightArrow + status);
    t.equal(result.loadSolution,
            loadSol,
            'loadSolution: ' + googleStatus + rightArrow + loadSol);
  }
});

}
