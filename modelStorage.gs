// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

OpenSolver.updateSavedCheckLinear = function(checkLinear) {
  OpenSolver.util.setOpenSolverProperty('checkLinear', checkLinear);
};

OpenSolver.updateSavedShowStatus = function(showStatus) {
  OpenSolver.util.setOpenSolverProperty('showStatus', showStatus);
};

OpenSolver.updateSavedAssumeNonNeg = function(assumeNonNeg) {
  OpenSolver.util.setSolverProperty('neg', OpenSolver.util.assumeNonNegFromBoolean(assumeNonNeg).toString());
};

OpenSolver.updateSavedVariables = function(variables) {
  var varstring = variables.join(',');
  if (varstring) {
    OpenSolver.util.setSolverProperty('adj', varstring);
  } else {
    OpenSolver.util.deleteSolverProperty('adj');
  }
};

OpenSolver.updateSavedObjective = function(objRange) {
  var objString = objRange.getA1Notation();
  if (objString) {
    OpenSolver.util.setSolverProperty('opt', objString);
  } else {
    OpenSolver.util.deleteSolverProperty('opt');
  }
};

OpenSolver.updateSavedObjectiveTarget = function(objectiveVal) {
  OpenSolver.util.setSolverProperty('val', objectiveVal);
};

OpenSolver.updateSavedObjectiveSense = function(objectiveSense) {
  OpenSolver.util.setSolverProperty('typ', objectiveSense.toString());
};

OpenSolver.updateSavedConstraints = function(constraints) {
  var currentNum = parseInt(OpenSolver.util.getSolverProperty('num'), 10);

  properties = {};
  for (var i = 0; i < constraints.length; i++) {
    properties['lhs'.concat(i)] = constraints[i].lhs;
    properties['rhs'.concat(i)] = constraints[i].rhs;
    properties['rel'.concat(i)] = constraints[i].rel.toString();
  }
  properties['num'] = constraints.length.toString();
  OpenSolver.util.setSolverProperties(properties);

  // Clean up old constraint info
  for (var i = constraints.length; i < currentNum; i++) {
    OpenSolver.util.deleteSolverProperty('lhs'.concat(i));
    OpenSolver.util.deleteSolverProperty('rhs'.concat(i));
    OpenSolver.util.deleteSolverProperty('rel'.concat(i));
  }
};

OpenSolver.clearModel = function(sheet) {
  var model = new OpenSolver.Model(sheet);
  Logger.log(model.constraints);
  OpenSolver.updateSavedModel(model);
  return model;
};

OpenSolver.updateSavedModel = function(model) {
  OpenSolver.updateSavedConstraints(model.constraints);
  OpenSolver.updateSavedVariables(model.variables);
  OpenSolver.updateSavedObjective(model.objective);
  OpenSolver.updateSavedObjectiveSense(model.objectiveSense);
  OpenSolver.updateSavedObjectiveTarget(model.objectiveTarget);
  OpenSolver.updateSavedAssumeNonNeg(model.assumeNonNeg);
  OpenSolver.updateSavedShowStatus(model.showStatus);
  OpenSolver.updateSavedCheckLinear(model.checkLinear);
};
