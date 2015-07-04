// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};
var currentModel;
var openSolver;

function getSidebarData(sheetId) {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();

  var currentSheet;
  if (sheetId) {
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() == sheetId) {
        currentSheet = sheets[i];
        break;
      }
    }
  }
  currentSheet = currentSheet || SpreadsheetApp.getActiveSheet();

  var sheetData = sheets
    .filter(function(sheet) { return !sheet.isSheetHidden(); })
    .map(function(sheet) { return { name: sheet.getName(), id: sheet.getSheetId() }; });

  currentModel = currentModel || OpenSolver.API.loadModelFromSheet(currentSheet);

  var sheetIndex = sheetData.map(function(sheet) { return sheet.id; }).indexOf(currentSheet.getSheetId());

  return {
    model: currentModel.getSidebarData(),
    sheets: sheetData,
    sheetIndex: sheetIndex
  };
}

function updateObjective() {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  var objRange = getSelectedRange();
  if (objRange) {
    return currentModel.updateObjective(objRange);
  } else {
    return null;
  }
}

function deleteObjective() {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  // Delete the objective and return the new text for the obj cell,
  // which should be '' if deleted successfully.
  return currentModel.deleteObjective();
}

function updateObjectiveSense(objSense) {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  currentModel.updateObjectiveSense(objSense);
}

function updateObjectiveTarget(objVal) {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  return currentModel.updateObjectiveTarget(objVal);
}

function addVariable() {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  var varRange = getSelectedRange();
  if (varRange) {
    return currentModel.addVariable(varRange);
  } else {
    return null;
  }
}

function updateVariable(index) {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  var varRange = getSelectedRange();
  if (varRange) {
    return currentModel.updateVariable(index, varRange);
  } else {
    return null;
  }
}

function deleteVariable(index) {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  currentModel.deleteVariable(index);
  return index;  // Return the index to delete. Set to -1 to abort.
}

function saveConstraint(LHSstring, RHSstring, RELstring, index) {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  return currentModel.saveConstraint(LHSstring, RHSstring, RELstring, index);
}

function deleteConstraint(index) {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  currentModel.deleteConstraint(index);
  return index;  // Return the index to delete. Set to -1 to abort.
}

function updateAssumeNonNeg(nonNeg) {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  currentModel.updateAssumeNonNeg(nonNeg);
}

function updateShowStatus(showStatus) {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  currentModel.updateShowStatus(showStatus);
}

function updateCheckLinear(checkLinear) {
  currentModel = currentModel || OpenSolver.API.loadModelFromSheet();
  currentModel.updateCheckLinear(checkLinear);
}

function getSelectedRange() {
  try {
    return SpreadsheetApp.getActiveRange();
  } catch (e) {
    OpenSolver.util.showMessage(e.message);
    return;
  }
}

function getSelectedRangeNotation() {
  return getSelectedRange().getA1Notation();
}

function solveModel() {
  openSolver = new OpenSolver.OpenSolver();
  return openSolver.solveModel();
}

function clearModel() {
  // This alert doesn't seem to be blocking: the client side executes the success
  // handler before the response is provided. This means we can't update the
  // sidebar correctly if the model is deleted, so we can't show a confirmation prompt.

//  var ui = SpreadsheetApp.getUi();
//  var result = ui.alert(
//      'Reset model?',
//      'This will clear all of the saved model information, and can\'t be undone.',
//      ui.ButtonSet.OK_CANCEL
//  );
//  if (result == ui.Button.OK)
//    return OpenSolver.clearModel();
//  else {
//    return null;
//  };

  return OpenSolver.API.clearModel(SpreadsheetApp.getActiveSheet()).getSidebarData();
}
