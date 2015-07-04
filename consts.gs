var EPSILON = 1e-10; // A small number
var TOAST_TIMEOUT = 1; // How long (in seconds) to show status messages

var OpenSolverResult = {
  ABORTED_THRU_USER_ACTION: -3, // Indicates that a non-linearity check was made (losing the solution)
  ERROR_OCCURRED: -2,           // Indicates an error occured and has been reported to the user
  UNSOLVED: -1,                 // Indicates a model not yet solved
  OPTIMAL: 0,
  UNBOUNDED: 4,
  INFEASIBLE: 5,
  TIME_LIMITED_SUB_OPTIMAL: 10, // Solver stopped before finding an optimal/feasible/integer solution
  NOT_LINEAR: 7                 // Indicates non-linearity in model
};

var ModelStatus = {
  UNINITIALISED: 0,
  BUILT: 1
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

