var DEBUG = false;

function makeError(message) {
  return { title: 'OpenSolver Error', message: message };
}

var ERR_OBJ_NOT_NUMERIC = function() {
  return makeError(
    'The objective cell does not appear to contain a numeric value. ' +
    'Please fix this and try again.'
  );
};

var ERR_OBJ_IS_ERROR = function() {
  return makeError(
    'The objective cell appears to contain an error (eg #DIV/0! or ' +
    '#VALUE!). This could have occurred if there is a divide by zero ' +
    'error or if you have used the wrong function. Please fix this and ' +
    'try again.'
  );
};

var ERR_NO_VARS = function() {
  return makeError(
    'No variable cells have been specified. Please fix this and try again.'
  );
};

var ERR_LHS_BLANK = function() {
  return makeError(
    'No left-hand side has been specified for the constraint. Please fix ' +
    'this and try again.'
  );
};

var ERR_RHS_BLANK = function() {
  return makeError(
    'No right-hand side has been specified for the constraint. Please fix ' +
    'this and try again.'
  );
};

var ERR_CON_WRONG_DIMS = function(constraintSummary) {
  return makeError(
    'The constraint ' + constraintSummary + ' has a different cell ' +
    'count on the left and the right. The model cannot be built. Please ' +
    'fix this and try again.'
  );
};

var ERR_CON_CELL_IS_ERROR = function(constraintSummary, cellName) {
  return makeError(
    'The cell ' + cellName + ' in constraint ' + constraintSummary + ' ' +
    'contains an error (eg #DIV/0! or #VALUE!). Please fix this and try ' +
    'again.'
  );
};

var ERR_CON_CELL_NOT_NUMERIC = function(constraintSummary, cellName) {
  return makeError(
    'The cell ' + cellName + ' in constraint ' + constraintSummary + ' ' +
    'has a value which is not numeric. Please fix this and try again.'
  );
};

var ERR_MODEL_NOT_BUILT = function() {
  return makeError(
    'The model cannot be solved as it has not yet been built.'
  );
};

var ERR_OBJ_NOT_SINGLE_CELL = function() {
  return makeError(
    'The objective cell must be a single cell. Please fix this and try ' +
    'again.'
  );
};

var ERR_LHS_NO_CELLS = function() {
  return makeError(
    'The left side of the constraint contains no cells. Please fix this ' +
    'and try again.'
  );
};

var ERR_INT_BIN_NOT_VARS = function() {
  return makeError(
    'An int/bin constraint has been set on cells that are not decision ' +
    'variables. Please fix this and try again.'
  );
};

var ERR_INT_BIN_NOT_ALL_VARS = function(constraintSummary, cellName) {
  return makeError(
    'The cell ' + cellName + ' in constraint ' + constraintSummary + ' ' +
    'is not a decision variable. Please fix this and try again.'
  );
};

var ERR_RHS_WRONG_SIZE = function() {
  return makeError(
    'The right side of the constraint has more than one cell, and does ' +
    'not match the number of cells on the left side. Please fix this ' +
    'and try again.'
  );
};

var ERR_VAR_RANGE_ERROR = function(range) {
  return makeError(
    'A model was found but the decision variable cells (' + range + ') ' +
    'could not be interpreted. Please redefine the decision variable ' +
    'cells, and try again.'
  );
};

var ERR_OBJ_RANGE_ERROR = function(range) {
  return makeError(
    'A model was found but the objective cell (' + range + ') could not ' +
    'be interpreted. Please redefine the objective cell, and try again.'
  );
};

var ERR_CON_RANGE_ERROR = function(range) {
  return makeError(
    'A model was found but the constraint range (' + range + ') could ' +
    'not be interpreted. Please redefine the constraint cells, and try ' +
    'again.'
  );
};
