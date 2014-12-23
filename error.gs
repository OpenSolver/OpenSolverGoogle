// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

OpenSolver.error = {
  OBJ_NOT_NUMERIC: {
    title: 'OpenSolver Build Error',
    message: 'The objective cell does not appear to contain a numeric value. ' +
             'Please fix this and try again.'
  },

  OBJ_IS_ERROR: {
    title: 'OpenSolver Build Error',
    message: 'The objective cell appears to contain an error (eg #DIV/0! or ' +
             '#VALUE!). This could have occurred if there is a divide by zero ' +
             'error or if you have used the wrong function. Please fix this and ' +
             'try again.'
  },

  NO_VARS: {
    title: 'OpenSolver Model Error',
    message: 'No variable cells have been specified. Please fix this and try again'
  },

  CONSTRAINT_WRONG_DIMENSIONS: function(constraintSummary) {
    return {
      title: 'OpenSolver Model Error',
      message: 'The constraint ' + constraintSummary + ' has a different cell ' +
               'count on the left and the right. The model cannot be built. ' +
               'Please fix this and try again.'
    }
  },

  CONSTRAINT_CELL_IS_ERROR: function(constraintSummary, cellName) {
    return {
      title: 'OpenSolver Build Error',
      message: 'The cell ' + cellName + ' in constraint ' + constraintSummary +
               ' contains an error (eg #DIV/0! or #VALUE!). Please fix this ' +
               'and try again.'
    }
  },

  CONSTRAINT_CELL_NOT_NUMERIC: function(constraintSummary, cellName) {
    return {
      title: 'OpenSolver Build Error',
      message: 'The cell ' + cellName + ' in constraint ' + constraintSummary +
               ' has a value which is not numeric. Please fix this and try again.'
    }
  },

  MODEL_NOT_BUILT: {
    title: 'OpenSolver Solve Error',
    message: 'The model cannot be solved as it has not yet been built'
  },

  OBJ_NOT_SINGLE_CELL: {
    title: 'OpenSolver Model Error',
    message: 'The objective cell must be a single cell. Please fix this and try again.'
  },

  LHS_NO_CELLS: {
    title: 'OpenSolver Model Error',
    message: 'The left side of the constraint contains no cells. Please fix this and ' +
             'try again.'
  },

  LHS_NOT_DECISION_VARS: {
    title: 'OpenSolver Model Error',
    message: 'An int/bin constraint has been set on cells that are not decision ' +
             'variables. Please fix this and try again.'
  },

  RHS_WRONG_SIZE: {
    title: 'OpenSolver Model Error',
    message: 'The right side of the constraint has more than one cell, and does not ' +
             'match the number of cells on the left side. Please fix this and try again.'
  },

  VAR_RANGE_ERROR: function(errorRange) {
    return {
      title: 'OpenSolver Model Error',
      message: 'A model was found but the decision variable cells (' + errorRange +
               ') could not be interpreted. Please redefine the decision variable ' +
               'cells, and try again.'
    }

  },

  OBJ_RANGE_ERROR: function(errorRange) {
    return {
      title: 'OpenSolver Model Error',
      message: 'A model was found but the objective cell (' + errorRange +
               ') could not be interpreted. Please redefine the objective ' +
               'cell, and try again.'
    }

  },

  CON_RANGE_ERROR: function(errorRange) {
    return {
      title: 'OpenSolver Model Error',
      message: 'A model was found but the constraint range ' + errorRange +
               ' could not be interpreted. Please redefine the constraint ' +
               'cells, and try again.'
    }

  },

  INT_BIN_LHS_NOT_ALL_VAR: function(constraintSummary, cellName) {
    return {
      title: 'OpenSolver Model Error',
      message: 'The cell ' + cellName + ' in constraint "' + constraintSummary +
               '" is not a decision variable. Please fix this and try again.'
    }
  }

}
