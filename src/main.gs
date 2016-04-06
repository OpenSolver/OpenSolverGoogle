var CURRENT_VERSION = 10;
var CURRENT_VERSION_STRING = '2.0';
var CURRENT_VERSION_DATE = '07.04.16';
var VERSION_KEY = 'OpenSolver_CurrentVersion';


/**
 * Creates a menu entry in the Google Sheets UI when the document is opened.
 *
 * @param {object} e The event parameter for a simple onOpen trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode.
 */
function onOpen(e) {
  SpreadsheetApp.getUi().createAddonMenu()
      .addItem('Open sidebar', 'showSidebar')
      .addSeparator()
      .addItem('Import previous model', 'importLegacyModel')
      .addItem('Show previous model data', 'showProperties')
      .addSeparator()
      .addItem('View changelog', 'showChangelog')
      .addToUi();
}

/**
 * Runs when the add-on is installed.
 *
 * @param {object} e The event parameter for a simple onInstall trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode. (In practice, onInstall triggers always
 *     run in AuthMode.FULL, but onOpen triggers may be AuthMode.LIMITED or
 *     AuthMode.NONE.)
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Opens a sidebar in the document containing the add-on's user interface.
 */
function showSidebar() {
  var ui = HtmlService.createTemplateFromFile('sidebarUi').evaluate()
      .setTitle('OpenSolver')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showSidebar(ui);
  checkShowChangelog();
}

/**
 * Converts a legacy (properties) model into sheet-storage model
 */
function importLegacyModel() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
      'Import legacy OpenSolver model?',
      'This will load a model from the previous version of OpenSolver as the ' +
      'model for the current sheet. It will replace any model on this sheet ' +
      'that was created by the current version of OpenSolver. The model ' +
      'from the previous version will not be affected. Do you want to proceed?',
      ui.ButtonSet.YES_NO);

  if (result == ui.Button.YES) {
    Logger.log('starting legacy load');
    var model = loadLegacyModel(SpreadsheetApp.getActiveSheet());
    model.save();
    showSidebar();
  }
}

/**
 * Used for include() in HTML file
 */
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).getRawContent();
}

function showProperties() {
  showMessage(JSON.stringify(getAllProperties(), null, 4));
}

function clearProperties() {
  clearAllProperties();
}

function showChangelog() {
  var changelogUi = HtmlService.createTemplateFromFile('dialogChangelog')
    .evaluate()
    .setHeight(480)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi()
    .showModalDialog(changelogUi, 'OpenSolver has been updated!');
}

function checkShowChangelog() {
  var userProps = PropertiesService.getUserProperties();
  var previousVersion = userProps.getProperty(VERSION_KEY);

  var versionIsCurrent = parseInt(previousVersion, 10) >= CURRENT_VERSION;
  if (!versionIsCurrent) {
    showChangelog();

    // Save current version to know we have shown this changelog
    userProps.setProperty(VERSION_KEY, CURRENT_VERSION);
  }
}

function detetePreviousVersion() {
  PropertiesService.getUserProperties().deleteProperty(VERSION_KEY);
}
