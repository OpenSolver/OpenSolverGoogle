var EPSILON = 1e-10; // A small number
var TOAST_TIMEOUT = 1; // How long (in seconds) to show status messages

var OpenSolverResult = {
  PENDING: -4,                  // Indicates that an async solve has yet to run.
  ABORTED_THRU_USER_ACTION: -3, // Indicates that a non-linearity check was made (losing the solution)
  ERROR_OCCURRED: -2,           // Indicates an error occured and has been reported to the user
  UNSOLVED: -1,                 // Indicates a model not yet solved
  OPTIMAL: 0,
  UNBOUNDED: 4,
  INFEASIBLE: 5,
  TIME_LIMITED_SUB_OPTIMAL: 10, // Solver stopped before finding an optimal/feasible/integer solution
  NOT_LINEAR: 7,                // Indicates non-linearity in model
  UNAUTHORIZED:401
};

var ModelStatus = {
  UNINITIALISED: 0,             // Model has not been loaded from sheet
  INITIALISED: 1,               // Model has loaded values from sheet but not finished construction
  BUILT: 2                      // Model has finished construction and is ready for solving
};

var Relation = {
  LE: 1,
  EQ: 2,
  GE: 3,
  INT: 4,
  BIN: 5,
  ALLDIFF: 6
};

var ObjectiveSenseType = {
  UNKNOWN: 0,
  MAXIMISE: 1,
  MINIMISE: 2,
  TARGET: 3
};

var VariableType = {
  CONTINUOUS: 0,
  INTEGER: 1,
  BINARY: 2
};

var AssumeNonNeg = {
  TRUE: 1,
  FALSE: 2
};

var SolverInputType = {
  SINGLE_CELL_RANGE: 1, // Valid for a LHS and a RHS
  MULTI_CELL_RANGE: 2,  // Valid for a LHS and a RHS
  FORMULA: 3,           // Valid for a RHS only
  CONSTANT: 4,          // Valid for a RHS only
};

var SolverType = {
  Google: {
      shortName:   'Google',
      longName:    'Google Apps Script Linear Optimization Service',
      sidebarName: 'Google Linear Solver',
      description: 'The Google Apps Script Linear Optimization Service uses the ' +
                   '<a href="https://developers.google.com/optimization/lp/glop">Glop</a> ' +
                   'solver for pure linear-optimization problems where all ' +
                   'variables can take on real values. If any variables are ' +
                   'constrained to integers, the service uses ' +
                   '<a href="http://scip.zib.de/">SCIP</a>' +
                   ', a commercial solver from Zuse-Institut Berlin.'
  },
  GLPK: {
      shortName:   'GLPK',
      longName:    'GNU Linear Programming Kit (GLPK)',
      sidebarName: 'GLPK',
      description: 'The ' +
                   '<a href="https://www.gnu.org/software/glpk/">GNU Linear Programming Kit (GLPK)</a> ' +
                   'is a software package intended for solving large-scale ' +
                   'linear programming (LP), mixed integer programming ' +
                   '(MIP), and other related problems. GLPK is free software ' +
                   'and licensed under the GNU General Public License 3.' +
                   '</p><p>' +
                   'OpenSolver uses ' +
                   '<a href="https://github.com/hgourvest/glpk.js">glpk.js</a>, ' +
                   'a Javascript port of GLPK by Henri Gourvest. This solver ' +
                   'runs on your machine rather than an external server, and ' +
                   'so is likely to be a faster option.'
  },
  NeosCBC: {
      shortName:   'NeosCBC',
      longName:    'COIN-OR Cbc via NEOS Optimization Server',
      sidebarName: 'Cbc via NEOS',
      description: 'The ' +
                   '<a href="http://www.neos-server.org">NEOS (Network-Enabled Optimization System) Server</a> ' +
                   'is a free Internet-based service for solving ' +
                   'optimization problems. Models sent to NEOS often have to ' +
                   'wait in a queue before they are solved, depending on the ' +
                   'current load on NEOS. For this reason, other solvers are ' +
                   'usually faster. Submitting a model to NEOS results in it ' +
                   'becoming publicly available. Use of NEOS is subject to ' +
                   'the ' +
                   '<a href="http://www.neos-server.org/neos/termofuse.html">NEOS Terms and Conditions</a>.' +
                   '</p><p>' +
                   'The ' +
                   '<a href="https://projects.coin-or.org/Cbc">COIN-OR Branch and Cut solver</a> ' +
                   '(Cbc) is an open-source mixed-integer linear program ' +
                   '(MILP) solver written in C++. Cbc is an active ' +
                   'open-source project led by John Forrest.'

  },
  SolveEngine: {
      shortName:   'SolveEngine',
      longName:    'Satalia Solve Engine',
      sidebarName: 'Satalia Solve Engine',
      description: 'The ' +
                   '<a href="https://solve.satalia.com">Solve Egine</a> ' +
                   'provides optimization as a service. It uses worlds ' +
                   'best algorithms from industry and academia to deliver' +
                   'rapid problem solving.  ' +
                   'To use the Solve Engine <a href="https://solve.satalia.com/register">here</a> for an API key ' +
                   ' and enter the key when prompted.'

  },
};

function getSolver(solverType) {
  return solver = SolverType[solverType] || SolverType.Google;
}

function createSolver(solverType) {
  switch(solverType) {
    case 'Google':
      return new SolverGoogle();
    case 'GLPK':
      return new SolverGlpk();
    case 'NeosCBC':
      return new SolverNeos();
    case 'SolveEngine':
      return new SolverSolveEngine();
    default:
      throw(makeError('Unknown solver: ' + solverType));
  }
}
