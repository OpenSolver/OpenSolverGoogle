// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

var CURRENT_VERSION = 10;
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
  showChangelog();
}

/**
 * Used for include() in HTML file
 */
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).getRawContent();
}

function showProperties() {
  OpenSolver.util.showMessage(JSON.stringify(OpenSolver.util.getAllProperties(), null, 4));
}

function clearProperties() {
  OpenSolver.util.clearAllProperties();
}

function showChangelog() {
  var props = PropertiesService.getDocumentProperties();
  var previousVersion = props.getProperty(VERSION_KEY);

  var versionIsCurrent = parseInt(previousVersion, 10) >= CURRENT_VERSION;
  if (!versionIsCurrent) {
      var changelogUi = HtmlService.createTemplateFromFile('changelog')
        .evaluate()
        .setHeight(200)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
      SpreadsheetApp.getUi()
        .showModalDialog(changelogUi, 'OpenSolver has been updated!');

    // Save current version to know we have shown this changelog
    props.setProperty(VERSION_KEY, CURRENT_VERSION);
  }
}

function detetePreviousVersion() {
  PropertiesService.getDocumentProperties().deleteProperty(VERSION_KEY);
}
