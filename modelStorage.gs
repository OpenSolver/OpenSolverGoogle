function setCheckLinear(checkLinear, sheet) {
  setOpenSolverProperty(sheet, 'checkLinear', checkLinear);
}

function getCheckLinear(sheet) {
  var properties = getAllProperties();
  return properties[sheet.getSheetId() + '!openSolver_checkLinear'] === 'true';
}

function setShowStatus(showStatus, sheet) {
  setOpenSolverProperty(sheet, 'showStatus', showStatus);
}

function getShowStatus(sheet) {
  var properties = getAllProperties();
  return properties[sheet.getSheetId() + '!openSolver_showStatus'] === 'true';
}

function setAssumeNonNegative(assumeNonNeg, sheet) {
  setSolverProperty(sheet, 'neg', assumeNonNegFromBoolean(assumeNonNeg).toString());
}

function getAssumeNonNegative(sheet) {
  var properties = getAllProperties();
  var nonNeg = properties[sheet.getSheetId() + '!solver_neg'];
  if (nonNeg !== undefined) {
    return assumeNonNegToBoolean(nonNeg);
  } else {
    return true;
  }
}

function setVariables(variables, sheet) {
  if (variables.length > 0) {
    setSolverProperty(sheet, 'adj', variables.join(','));
  } else {
    deleteSolverProperty(sheet, 'adj');
  }
}

function getVariables(sheet) {
  var properties = getAllProperties();
  var varString = properties[sheet.getSheetId() + '!solver_adj'];
  if (varString !== undefined) {
    return varString.split(',');
  } else {
    return [];
  }
}

function setObjective(objectiveString, sheet) {
  if (objectiveString) {
    setSolverProperty(sheet, 'opt', objectiveString);
  } else {
    deleteSolverProperty(sheet, 'opt');
  }
}

function getObjective(sheet) {
  var properties = getAllProperties();
  try {
    return properties[sheet.getSheetId() + '!solver_opt'];
  } catch(e) {
    return '';
  }
}

function setObjectiveTargetValue(objectiveTargetValue, sheet) {
  setSolverProperty(sheet, 'val', objectiveTargetValue);
}

function getObjectiveTargetValue(sheet) {
  var properties = getAllProperties();
  var targetVal = properties[sheet.getSheetId() + '!solver_val'];
  if (targetVal !== undefined) {
    return targetVal;
  } else {
    return 0.0;
  }
}

function setObjectiveSense(objectiveSense, sheet) {
  setSolverProperty(sheet, 'typ', objectiveSense.toString());
}

function getObjectiveSense(sheet) {
  var properties = getAllProperties();
  var objSense = properties[sheet.getSheetId() + '!solver_typ'];
  if (objSense !== undefined) {
    return objSense;
  } else {
    var defaultSense = ObjectiveSenseType.MINIMISE;
    setObjectiveSense(defaultSense, sheet);
    return defaultSense;
  }
}

function setConstraints(constraints, sheet) {
  var currentNum = parseInt(getSolverProperty(sheet, 'num'), 10);

  properties = {};
  for (var i = 0; i < constraints.length; i++) {
    properties['lhs'.concat(i)] = constraints[i].lhs;
    properties['rhs'.concat(i)] = constraints[i].rhs;
    properties['rel'.concat(i)] = constraints[i].rel.toString();
  }
  properties['num'] = constraints.length.toString();
  setSolverProperties(sheet, properties);

  // Clean up old constraint info
  for (var i = constraints.length; i < currentNum; i++) {
    deleteSolverProperty(sheet, 'lhs'.concat(i));
    deleteSolverProperty(sheet, 'rhs'.concat(i));
    deleteSolverProperty(sheet, 'rel'.concat(i));
  }
}

function getConstraints(sheet) {
  var constraints = [];
  var properties = getAllProperties();
  if (properties[sheet.getSheetId() + '!solver_num']) {
    for (var i = 0; i < properties[sheet.getSheetId() + '!solver_num']; i++) {
      var lhs = properties[sheet.getSheetId() + '!solver_lhs'.concat(i)];
      var rhs = properties[sheet.getSheetId() + '!solver_rhs'.concat(i)];
      var rel = parseInt(properties[sheet.getSheetId() + '!solver_rel'.concat(i)]);
      constraints.push(new Constraint(lhs, rhs, rel));
    }
  }
  return constraints;
}

function clearModel(sheet) {
  var model = new Model(sheet);
  model.save();
  return model;
}

function loadModelFromSheet(sheet) {
  sheet = sheet || SpreadsheetApp.getActiveSheet();
  var model = new Model(sheet);
  model.load();
  return model;
}

  // Converts a range parameter into the proper string for storage
function getRangeNotation(sheet, range) {
  // TODO add in sheet prefixing here
  return range.getA1Notation();
};
