function setCheckLinear(checkLinear, sheet) {
  setBoolAsSavedInteger(sheet, openSolverName('LinearityCheck'), checkLinear);
}

function getCheckLinear(sheet) {
  return getSavedIntegerAsBool(sheet, openSolverName('LinearityCheck'), true);
}

function setShowStatus(showStatus, sheet) {
  setBoolAsSavedInteger(sheet, solverName('sho'), showStatus);
}

function getShowStatus(sheet) {
  return getSavedIntegerAsBool(sheet, solverName('sho'), false);
}

function setAssumeNonNegative(assumeNonNeg, sheet) {
  setBoolAsSavedInteger(sheet, solverName('neg'), assumeNonNeg);
}

function getAssumeNonNegative(sheet) {
  return getSavedIntegerAsBool(sheet, solverName('neg'), true);
}

function setVariables(variables, sheet) {
  if (variables.length > 0) {
    setProperty(sheet, solverName('adj'), variables.join(','));
  } else {
    delProperty(sheet, solverName('adj'));
  }
}

function getVariables(sheet) {
  var varString = getProperty(sheet, solverName('adj'));
  if (varString !== undefined & varString !== null) {
    return varString.split(',');
  } else {
    return [];
  }
}

function setObjective(objectiveString, sheet) {
  if (objectiveString) {
    setProperty(sheet, solverName('opt'), objectiveString);
  } else {
    delProperty(sheet, solverName('opt'));
  }
}

function getObjective(sheet) {
  // TODO validation
  return getProperty(sheet, solverName('opt')) || '';
}

function setObjectiveTargetValue(objectiveTargetValue, sheet) {
  setProperty(sheet, solverName('val'), objectiveTargetValue);
}

function getObjectiveTargetValue(sheet) {
  return getSavedDouble(sheet, solverName('val'), 0.0);
}

function setObjectiveSense(objectiveSense, sheet) {
  setSavedInteger(sheet, solverName('typ'), objectiveSense);
}

function getObjectiveSense(sheet) {
  return getSavedInteger(sheet, solverName('typ'), ObjectiveSenseType.MINIMISE);
}

function setConstraints(constraints, sheet) {
  var currentNum = getNumConstraints(sheet);

  properties = {};
  for (var i = 0; i < constraints.length; i++) {
    properties[solverName('lhs' + i)] = constraints[i].lhs;
    properties[solverName('rhs' + i)] = constraints[i].rhs;
    properties[solverName('rel' + i)] = constraints[i].rel;
  }
  properties[solverName('num')] = constraints.length;
  setProperties(sheet, properties);

  // Clean up old constraint info
  for (var i = constraints.length; i < currentNum; i++) {
    delProperty(sheet, solverName('lhs' + i));
    delProperty(sheet, solverName('rhs' + i));
    delProperty(sheet, solverName('rel' + i));
  }
}

function getConstraints(sheet) {
  var constraints = [];
  for (var i = 0; i < getNumConstraints(sheet); i++) {
    var lhs = getProperty(sheet, solverName('lhs' + i));
    var rhs = getProperty(sheet, solverName('rhs' + i));
    var rel = getSavedInteger(sheet, solverName('rel' + i));
    constraints.push(new Constraint(lhs, rhs, rel));
  }
  return constraints;
}

function getNumConstraints(sheet) {
  return getSavedInteger(sheet, solverName('num'));
}

function resetModel(sheet) {
  // Save a blank model to the sheet to remove current model.
  return new Model(sheet).save();
}
