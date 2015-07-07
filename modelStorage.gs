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
    return properties[sheet.getSheetId() + '!solver_opt'] || '';
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
  // TODO validation
  if (objSense === undefined) {
    objSense = ObjectiveSenseType.MINIMISE;
    setObjectiveSense(objSense, sheet);
  }
  return objSense;
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

function resetModel(sheet) {
  // Save a blank model to the sheet to remove current model.
  return new Model(sheet).save();
}

function loadModelFromSheet(sheet) {
  sheet = sheet || SpreadsheetApp.getActiveSheet();
  return new Model(sheet).load();
}

/**
 * Returns the name of a sheet for use in a range expression (Sheet!Range)
 *
 * @param {Sheet} sheet the sheet to get the name from
 * @return {String} the escaped name of the sheet
 */
function escapeSheetName(sheet) {
  // TODO escape this. figure out which characters force quoting
  return sheet.getSheetName();
}

function getRangeNotation(sheet, range) {
  return escapeSheetName(sheet) + '!' + range.getA1Notation();
}
