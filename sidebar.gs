// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};
var currentModel;
var openSolver

function getModelData() {
  currentModel = currentModel || OpenSolver.loadModel();
  return currentModel.getSidebarData();
}

function updateObjective() {
  currentModel = currentModel || OpenSolver.loadModel();
  test();
  return currentModel.updateObjective();
}

function deleteObjective() {
  currentModel = currentModel || OpenSolver.loadModel();
  return currentModel.deleteObjective();
}

function updateObjectiveSense(objSense) {
  currentModel = currentModel || OpenSolver.loadModel();
  currentModel.updateObjectiveSense(objSense);
}

function updateObjectiveTarget(objVal) {
  currentModel = currentModel || OpenSolver.loadModel();
  return currentModel.updateObjectiveTarget(objVal);
}

function addVariable() {
  currentModel = currentModel || OpenSolver.loadModel();
  return currentModel.addVariable();
}

function updateVariable(index) {
  currentModel = currentModel || OpenSolver.loadModel();
  return currentModel.updateVariable(index);
}

function deleteVariable(index) {
  currentModel = currentModel || OpenSolver.loadModel();
  currentModel.deleteVariable(index);
}

function saveConstraint(LHSstring, RHSstring, RELstring, index) {
  currentModel = currentModel || OpenSolver.loadModel();
  return currentModel.saveConstraint(LHSstring, RHSstring, RELstring, index);
}

function deleteConstraint(index) {
  currentModel = currentModel || OpenSolver.loadModel();
  currentModel.deleteConstraint(index);
}

function updateAssumeNonNeg(nonNeg) {
  currentModel = currentModel || OpenSolver.loadModel();
  currentModel.updateAssumeNonNeg(nonNeg);
}

function updateShowStatus(showStatus) {
  currentModel = currentModel || OpenSolver.loadModel();
  currentModel.updateShowStatus(showStatus);
}

function updateCheckLinear(checkLinear) {
  currentModel = currentModel || OpenSolver.loadModel();
  currentModel.updateCheckLinear(checkLinear);
}

/**
 * Gets the text the user has selected. If there is no selection,
 * this function displays an error message.
 *
 * @return {Array.<string>} The selected text.
 */
function getSelectedRange() {
  var selection = SpreadsheetApp.getActiveRange();
  if (selection) {
    return selection.getA1Notation();
  } else {
    throw 'Please select a cell.';
  }
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

  return OpenSolver.clearModel(SpreadsheetApp.getActiveSheet()).getSidebarData();
}
