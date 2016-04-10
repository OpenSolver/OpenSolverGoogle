var currentModel;
var openSolver;

// Utility functions for sidebar interaction

function getSheetFromId(sheetId) {
  // Force to NaN if not a number
  sheetId = parseInt(sheetId, 10);
  if (!isNaN(sheetId)) {
    var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    for (var i = 0; i < sheets.length; i++) {
      Logger.log(sheets[i].getSheetId() + ' ' + sheets[i].getSheetName());
      if (sheets[i].getSheetId() === sheetId) return sheets[i];
    }
  }
  Logger.log("getSheetFromId(" + sheetId + "): no sheet found");
  return null;
}

function getSheetFromIdWithDefault(sheetId) {
  return getSheetFromId(sheetId) || SpreadsheetApp.getActiveSheet();
}

function getModelFromSheetIdWithDefault(sheetId) {
  return getModelFromSheetWithDefault(getSheetFromIdWithDefault(sheetId));
}

function getModelFromSheetWithDefault(sheet) {
  sheet = sheet || SpreadsheetApp.getActiveSheet();
  return new Model(sheet);
}

function getSelectedRange() {
  try {
    return SpreadsheetApp.getActiveRange();
  } catch (e) {
    showMessage(e.message);
    return null;
  }
}

function getSelectedRangeNotation() {
  return getRangeNotation(SpreadsheetApp.getActiveSheet(), getSelectedRange());
}

// Sidebar API functions - depend on Sheet ID to get the sheet containing model

function getSidebarData(sheetId) {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();

  var sheetData = sheets
      .filter(
        function(sheet) {
          return !sheet.isSheetHidden();
        })
      .map(
        function(sheet) {
          return {
            name: sheet.getName(),
            id: sheet.getSheetId()
          };
        });

  var currentSheet = getSheetFromIdWithDefault(sheetId);
  currentModel = getModelFromSheetWithDefault(currentSheet);

  var sheetIndex = sheetData.map(function(sheet) { return sheet.id; })
                            .indexOf(currentSheet.getSheetId());

  return {
    model: currentModel.getSidebarData(),
    sheets: sheetData,
    sheetIndex: sheetIndex,
    escapedSheetName: escapeSheetName(currentSheet)
  };
}

function updateObjective(sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel
      .updateObjective(getSelectedRangeNotation())
      .getSidebarData();
}

function deleteObjective(sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel.deleteObjective().getSidebarData();
}

function updateObjectiveSense(objSense, sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel.updateObjectiveSense(objSense).getSidebarData();
}

function updateObjectiveTarget(objVal, sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel.updateObjectiveTarget(objVal).getSidebarData();
}

function addVariable(sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel
      .addVariable(getSelectedRangeNotation())
      .getSidebarData();
}

function updateVariable(index, sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel
      .updateVariable(index, getSelectedRangeNotation())
      .getSidebarData();
}

function deleteVariable(index, sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel.deleteVariable(index).getSidebarData();
}

function saveConstraint(LHSstring, RHSstring, RELstring, index, sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel
      .updateConstraint(LHSstring, RHSstring, RELstring, index)
      .getSidebarData();
}

function deleteConstraint(index, sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel.deleteConstraint(index).getSidebarData();
}

function updateAssumeNonNeg(nonNeg, sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel.updateAssumeNonNeg(nonNeg).getSidebarData();
}

function updateShowStatus(showStatus, sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel.updateShowStatus(showStatus).getSidebarData();
}

function updateCheckLinear(checkLinear, sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel.updateCheckLinear(checkLinear).getSidebarData();
}

function updateSolver(solverShortName, sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return currentModel.updateSolver(solverShortName).getSidebarData();
}

function updateConstraintSelection(sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  var value = getSelectedRangeNotation();
  var display = removeSheetNameFromRange(value,
                                         escapeSheetName(currentModel.sheet));
  return {
    value: value,
    display: display
  };
}

function checkChangeSolver(sheetId) {
  currentModel = getModelFromSheetIdWithDefault(sheetId);
  return showDialog('dialogChangeSolver', 'Choose a Solver', 200, 350);
}

function checkSolveModel() {
  var data = loadOpenSolverCache();
  if (data !== null) {
    var sheet = getSheetFromId(data.sheetId);
    if (sheet) {
      setCachedSheet(sheet);
      return showDialog('dialogResumeSolve', 'Resume Solve?', 170);
    }
  }
  return;
}

function solveModel(sheetId, loadFromCache) {
  openSolver = new OpenSolver(getSheetFromIdWithDefault(sheetId));

  if (loadFromCache === true) {
    openSolver.loadFromCache(loadOpenSolverCache());
  }

  return openSolver.solveModel();
}

function checkResetModel(sheetId) {
  return showDialog('dialogResetModel', 'Reset Model?', 78, 220);
}

function resetModel(sheetId) {
  return new Model(getSheetFromIdWithDefault(sheetId), false).getSidebarData();
}
