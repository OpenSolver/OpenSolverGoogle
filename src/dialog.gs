// Adapted from https://github.com/googlesamples/apps-script-dialog2sidebar

/**
 * How long to wait for the dialog to check-in before assuming it's been
 * closed, in seconds.
 */
var DIALOG_TIMEOUT_SECONDS = 5;
var DIALOG_TIMEOUT_SECONDS_FIRST = 10;

/**
 * The various states the dialog can be in.
 */
var DialogState = {
  OPEN: 'open',        // Still open.
  ABORTED: 'aborted',  // Closed without being completed.
  LOST: 'lost',        // Hasn't checked-in in a while, assume closed via "X".
  DONE: 'done',        // The dialog has been completed and closed.
  PENDING: 'pending',  // The dialog hasn't checked in yet.
};

/**
 * The various proprties of a dialog we store.
 */
var DialogProperty = {
  STATE: 'state',               // State of the dialog. See DialogState.
  LAST_CHECK_IN: 'lastCheckIn'  // Timestamp of last time the dialog checked-in.
};

/**
 * Shows the dialog in the document.
 *
 * @param {String} templateName The name of the HTML file to show.
 * @param {String} title The title to assign to the dialog.
 * @param {Number} height The height to assign to the dialog.
 * @param {Number} width The width to assign to the dialog.
 * @return {String} The ID of the dialog for tracking state.
 */
function showDialog(templateName, title, height, width) {
  var dialogId = Utilities.base64Encode(Math.random());

  // Construct the library functions for managing the dialog
  var dialogFunctions = HtmlService.createTemplateFromFile('dialogJs');
  dialogFunctions.dialogId = dialogId;

  // Create the dialog UI and append the library functions
  var page = HtmlService.createTemplateFromFile(templateName)
      .evaluate()
      .append(dialogFunctions.evaluate().getContent())
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  if (height) page.setHeight(height);
  if (width)  page.setWidth(width);

  SpreadsheetApp.getUi().showModalDialog(page, title);
  checkIn(dialogId);
  Logger.log(dialogId);
  return dialogId;
}

/**
 * Records the last time a dialog checked-in with the server. The dialog should
 * call this function periodically (every few seconds).
 * @param {String} dialogId The ID of the dialog.
 */
function checkIn(dialogId) {
  var key = getCacheKey_(dialogId, DialogProperty.LAST_CHECK_IN);
  var timestamp = new Date().getTime();
  CacheService.getDocumentCache().put(key, timestamp);
}

/**
 * Sets the state of a dialog. The dialog should call this function before
 * it closes itself.
 * @param {String} dialogId The ID of the dialog.
 * @param {String} state The state of the dialog.
 */
function setDialogState(dialogId, state) {
  validateDialogState_(state);
  var key = getCacheKey_(dialogId, DialogProperty.STATE);
  CacheService.getDocumentCache().put(key, state);
}

/**
 * Gets the state of a dialog. The sidebar should call this function periodically
 * to determine when the dialog is closed.
 * @param {String} dialogId The ID of the dialog.
 * @return {String} The state of the dialog.
 */
function getDialogState(dialogId, firstTime) {
  var key = getCacheKey_(dialogId, DialogProperty.STATE);
  var status = CacheService.getDocumentCache().get(key);
  if (status !== null && (firstTime || status !== DialogState.OPEN)) {
    return status;
  } else {
    var lastCheckInKey = getCacheKey_(dialogId, DialogProperty.LAST_CHECK_IN);
    var lastCheckIn = parseInt(CacheService.getDocumentCache().get(lastCheckInKey));
    var now = new Date().getTime();
    var timeoutSeconds = firstTime ? DIALOG_TIMEOUT_SECONDS_FIRST
                                   : DIALOG_TIMEOUT_SECONDS;
    if (now - lastCheckIn > timeoutSeconds * 1000) {
      return DialogState.LOST;
    } else {
      return firstTime ? DialogState.PENDING : DialogState.OPEN;
    }
  }
}

/**
 * Validates that a given dialog state is valid, and throws an exception if it isn't.
 * @param {String} state The dialog state to validate.
 * @private
 */
function validateDialogState_(state) {
  var validStates = Object.keys(DialogState).map(function(key) {
    return DialogState[key];
  });
  if (validStates.indexOf(state) == -1) {
    throw 'Invalid dialog state: ' + state;
  }
}

/**
 * Gets the cache key for a given property of a dialog.
 * @param {String} dialogId The ID of the dialog.
 * @param {String} property The property of the dialog.
 * @return {String} The cache key.
 */
function getCacheKey_(dialogId, property) {
  return dialogId + '-' + property;
}
