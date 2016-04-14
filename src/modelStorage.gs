// All functions related to model storage on the hidden sheet

var HIDDEN_SHEET_NAME = "__OpenSolver__";

// Used for caching between load/save
var _LAST_ROW;
var _SHEET_COL;
var _HIDDEN_SHEET;

/**
 * Returns the hidden sheet containing model information, creating if needed.
 * @return {Sheet}
 */
function getHiddenSheet() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var hiddenSheet = book.getSheetByName(HIDDEN_SHEET_NAME);

  if (hiddenSheet === null) {
    // We didn't find the hidden sheet, create it
    hiddenSheet = book.insertSheet(HIDDEN_SHEET_NAME);
    hiddenSheet.hideSheet();
  }

  return hiddenSheet;
}

/**
 * Returns all formulas on the hidden sheet.
 */
function getHiddenSheetValues(hiddenSheet) {
  // Cache value of getLastRow()
  var lastRow = hiddenSheet.getLastRow();
  _LAST_ROW = lastRow;

  // Check whether there is any data in the sheet
  if (lastRow > 0) {
    return hiddenSheet
        .getRange(1, 1, lastRow, hiddenSheet.getLastColumn())
        .getFormulas();
  } else {
    return [[]];
  }
}

/**
 * Returns the column in the hidden sheet values for the specified sheet.
 * Returns -1 if there is no match
 */
function getSheetColumn(sheet, values) {
  // Only check if there is data in the sheet
  if (values.length > 0) {
    var sheetName = sheet.getName();
    for (var col = 0; col < values[0].length; col++) {
      var value = String(values[0][col]);
      var entryValues = splitHiddenSheetEntry(value);
      if (entryValues !== null) {
        var entryName = getSheetNameFromRange(entryValues[1]);
        if (entryValues[0] === "ModelSheet" &&
            (entryName === sheetName || entryName === "'" + sheetName + "'")) {
          return col;
        }
      }
    }
  }

  // Didn't find a column for the sheet
  return -1;
}

/**
 * Returns column in the hidden sheet to insert data for the specified sheet.
 */
function getSheetColumnForInsertion(col, hiddenSheet) {
  if (col < 0) {
    // Insert after all current data
    col = hiddenSheet.getLastColumn();
    if (hiddenSheet.getMaxColumns() <= col) {
      hiddenSheet.insertColumnAfter(col);
    }
  }
  return col;
}

/**
 * Inserts data for the specified sheet into the hidden sheet.
 */
function insertHiddenSheetData(sheet, data) {
  // Make the array to write
  var valuesToWrite = [];
  valuesToWrite.push(createHiddenSheetEntry("ModelSheet",
                                            sheet.getName() + "!A:Z"));

  var keys = Object.keys(data).sort();
  for (var i = 0; i < keys.length; i++) {
    valuesToWrite.push(createHiddenSheetEntry(keys[i], data[keys[i]]));
  }

  // Load cached data
  var col = _SHEET_COL;
  var hiddenSheet = _HIDDEN_SHEET;
  var lastRow = _LAST_ROW;
  // Get the range to write
  col = getSheetColumnForInsertion(col, hiddenSheet);
  var numNames = valuesToWrite.length;
  var rangeToWrite = hiddenSheet.getRange(1, col + 1, numNames, 1);

  // Clear column and write values
  if (lastRow > 0) {
    hiddenSheet.getRange(1, col + 1, lastRow, 1).clear();
  }
  rangeToWrite.setValues(valuesToWrite);
}

/**
 * Returns all data for the specified sheet from the hidden sheet.
 */
function getHiddenSheetData(sheet, loadCacheOnly) {
  var hiddenSheet = getHiddenSheet();
  var values = getHiddenSheetValues(hiddenSheet);
  var col = getSheetColumn(sheet, values);

  // Cache results for future use this execution
  _SHEET_COL = col;
  _HIDDEN_SHEET = hiddenSheet;

  // Return no data if hidden sheet doesn't contain the specified sheet.
  if (col === -1 || loadCacheOnly) {
    return {};
  }

  // Load the data using the sheet values
  var data = {};
  for (var i = 1; i < values.length; i++) {
    var value = values[i][col];
    if (value === "") {
      break;  // Stop if we find an empty cell
    }
    var entryValues = splitHiddenSheetEntry(value);
    if (entryValues !== null) {  // Skip malformed records
      data[entryValues[0]] = entryValues[1];
    }
  }

  return data;
}

/**
 * Format key/value pair for hidden sheet output
 */
function createHiddenSheetEntry(key, value) {
  return ["=" + key + "=" + value];
}

/**
 * Convert hidden sheet entry to array with key and value
 */
function splitHiddenSheetEntry(entry) {
  entryValues = String(entry).split("=");
  if (entryValues.length === 3 && entryValues[0] === "") {
    return [entryValues[1], entryValues[2]];
  } else {
    return null;
  }
}

// Getters for accessing the key/value data

function getSavedBool(data, name, defaultValue) {
  var value = integerToBool(getSavedDouble(data, name));
  Logger.log('Get bool: ' + name + ', got ' + value);
  if (value === null && defaultValue !== undefined) {
    value = defaultValue;
  }
  return value;
}


function getSavedInteger(data, name, defaultValue) {
  var value = getSavedDouble(data, name);
  if (!isInt(value)) {
    Logger.log(defaultValue);
    if (defaultValue !== undefined) {
      value = defaultValue;
    } else {
      value = null;
    }
  }
  return value;
}

function getSavedDouble(data, name, defaultValue) {
  var value = parseFloat(getSavedString(data, name), 10);
  if (!isNumber(value)) {
    if (defaultValue !== undefined) {
      value = defaultValue;
    } else {
      value = null;
    }
  }
  return value;
}

function getSavedString(data, name, defaultValue) {
  var value = data[name];
  if (value === undefined && defaultValue !== undefined) {
    value = defaultValue;
  }
  return value;
}

// Setters for creating the key/value data

function setSavedBool(data, name, value) {
  if (isBool(value)) {
    setSavedInteger(data, name, boolToInteger(value));
  } else {
    throw 'Value not boolean';
  }
}

function setSavedInteger(data, name, value) {
  if (isInt(value)) {
    setSavedDouble(data, name, value);
  } else {
    Logger.log('Not integer: ' + name + ', ' + value);
    throw 'Value not integer';
  }
}

function setSavedDouble(data, name, value) {
  if (isNumber(value)) {
    setSavedString(data, name, value);
  } else {
    throw 'Value not numeric';
  }
}

function setSavedString(data, name, value) {
  data[name] = value;
}

// Conversion helpers

function boolToInteger(value) {
  if (isBool(value)) {
    return value ? 1 : 0;
  } else {
    return null;
  }
}

function integerToBool(value) {
  if (isInt(value)) {
    return value === 1;
  } else {
    return null;
  }
}

// Name helpers
function solverName(name) { return 'solver_' + name; }
function openSolverName(name) { return 'OpenSolver_' + name; }

/**
 * Returns the suffix for the jth variable entry, which is blank if j is zero
 * and j otherwise.
 */
function variableIndex(j) {
  return j > 0 ? j : '';
}
