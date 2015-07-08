function getSavedIntegerAsBool(sheet, name, defaultValue) {
  var value = savedIntegerToBool(getSavedInteger(sheet, name));
  if (value === null && defaultValue !== undefined) {
    value = defaultValue;
    setBoolAsSavedInteger(sheet, name, defaultValue);
  }
  return value;
}

function setBoolAsSavedInteger(sheet, name, value) {
  if (isBool(value)) {
    setSavedInteger(sheet, name, boolToSavedInteger(value));
  } else {
    throw 'Value not boolean';
  }
}

function getSavedInteger(sheet, name, defaultValue) {
  var value = getSavedDouble(sheet, name);
  if (!isInt(value)) {
    if (defaultValue !== undefined) {
      value = defaultValue;
      setSavedInteger(sheet, name, value);
    } else {
      value = null;
    }
  }
  return value;
}

function setSavedInteger(sheet, name, value) {
  if (isInt(value)) {
    setSavedDouble(sheet, name, value);
  } else {
    throw 'Value not integer';
  }
}

function getSavedDouble(sheet, name, defaultValue) {
  var value = parseFloat(getProperty(sheet, name), 10);
  if (!isNumber(value)) {
    if (defaultValue !== undefined) {
      value = defaultValue;
      setSavedDouble(sheet, name, value);
    } else {
      value = null;
    }
  }
  return value;
}

function setSavedDouble(sheet, name, value) {
  if (isNumber(value)) {
    setProperty(sheet, name, value);
  } else {
    throw 'Value not numeric';
  }
}

function solverName(name) { return 'solver_' + name; }
function openSolverName(name) { return 'openSolver_' + name; }

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

function boolToSavedInteger(value) {
  if (isBool(value)) {
    return value ? 1 : 2;
  } else {
    return null;
  }
}

function savedIntegerToBool(value) {
  if (value == 1 || value == 2) {
    return value == 1;
  } else {
    return null;
  }
}
