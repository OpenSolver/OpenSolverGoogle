var currentModel;
var openSolver;

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


function getSidebarData(sheetId) {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();

  var sheetData = sheets
      .filter(
        function(sheet) {
          return !sheet.isSheetHidden();
        })
      .map(
        function(sheet) {
          return { name: sheet.getName(), id: sheet.getSheetId() };
        });

  var currentSheet = getSheetFromIdWithDefault(sheetId);
  currentModel = loadModelFromSheet(currentSheet);

  var sheetIndex = sheetData.map(function(sheet) { return sheet.id; })
                            .indexOf(currentSheet.getSheetId());

  return {
    model: currentModel.getSidebarData(),
    sheets: sheetData,
    sheetIndex: sheetIndex
  };
}

function updateObjective(sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  var objRange = getSelectedRange();
  if (objRange) {
    return currentModel.updateObjective(objRange);
  } else {
    return null;
  }
}

function deleteObjective(sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  // Delete the objective and return the new text for the obj cell,
  // which should be '' if deleted successfully.
  return currentModel.deleteObjective();
}

function updateObjectiveSense(objSense, sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  currentModel.updateObjectiveSense(objSense);
}

function updateObjectiveTarget(objVal, sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  return currentModel.updateObjectiveTarget(objVal);
}

function addVariable(sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  var varRange = getSelectedRange();
  if (varRange) {
    return currentModel.addVariable(varRange);
  } else {
    return null;
  }
}

function updateVariable(index, sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  var varRange = getSelectedRange();
  if (varRange) {
    return currentModel.updateVariable(index, varRange);
  } else {
    return null;
  }
}

function deleteVariable(index, sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  currentModel.deleteVariable(index);
  return index;  // Return the index to delete. Set to -1 to abort.
}

function saveConstraint(LHSstring, RHSstring, RELstring, index, sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  return currentModel.saveConstraint(LHSstring, RHSstring, RELstring, index);
}

function deleteConstraint(index, sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  currentModel.deleteConstraint(index);
  return index;  // Return the index to delete. Set to -1 to abort.
}

function updateAssumeNonNeg(nonNeg, sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  currentModel.updateAssumeNonNeg(nonNeg);
}

function updateShowStatus(showStatus, sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  currentModel.updateShowStatus(showStatus);
}

function updateCheckLinear(checkLinear, sheetId) {
  currentModel = loadModelFromSheet(getSheetFromIdWithDefault(sheetId));
  currentModel.updateCheckLinear(checkLinear);
}

function getSelectedRange() {
  try {
    return SpreadsheetApp.getActiveRange();
  } catch (e) {
    showMessage(e.message);
    return;
  }
}

function getSelectedRangeNotation() {
  return getSelectedRange().getA1Notation();
}

function solveModel(sheetId) {
  openSolver = new OpenSolver(getSheetFromIdWithDefault(sheetId));
  return openSolver.solveModel();
}

function clearModel(sheetId) {
  // This alert doesn't seem to be blocking: the client side executes the success
  // handler before the response is provided. This means we can't update the
  // sidebar correctly if the model is deleted, so we can't show a confirmation prompt.
  // TODO: try this https://github.com/googlesamples/apps-script-dialog2sidebar

//  var ui = SpreadsheetApp.getUi();
//  var result = ui.alert(
//      'Reset model?',
//      'This will clear all of the saved model information, and can\'t be undone.',
//      ui.ButtonSet.OK_CANCEL
//  );
//  if (result == ui.Button.OK)
//    return clearModel(SpreadsheetApp.getActiveSheet()).getSidebarData();
//  else {
//    return null;
//  };

  return clearModel(getSheetFromIdWithDefault(sheetId)).getSidebarData();
}
