var CACHE_SHEET_NAME = "__OpenSolverCache__";
var _CACHE_SHEET;  // Used to cache the cache sheet
var _CACHE_CELL_SIZE = 50000;  // Max chars in single cell
var CACHE_KEY_SOLVEENGINE_APIKEY = "CACHE_SOLVEENGINE_API_KEY";

/**
 * Returns the cache sheet containing the cached model data, creating if needed.
 * @return {Sheet}
 */
function getCacheSheet() {
  // Load the results of any previous check
  if (_CACHE_SHEET !== undefined) {
    return _CACHE_SHEET;
  }

  var book = SpreadsheetApp.getActiveSpreadsheet();
  var cacheSheet = book.getSheetByName(CACHE_SHEET_NAME);

  if (cacheSheet === null) {
    // We didn't find the cache sheet, create it
    cacheSheet = book.insertSheet(CACHE_SHEET_NAME);
    cacheSheet.hideSheet();
  }

  // Save results for next call
  _CACHE_SHEET = cacheSheet;

  return cacheSheet;
}

function updateOpenSolverCache(openSolver) {
  var data = JSON.stringify(openSolver);

  var numCells = Math.ceil(data.length / _CACHE_CELL_SIZE);
  var valuesToWrite = [];

  for (i = 0; i < numCells; i++) {
    var cellData = data.substr(_CACHE_CELL_SIZE * i, _CACHE_CELL_SIZE);
    valuesToWrite.push([cellData]);
  }

  var cacheSheet = getCacheSheet();
  cacheSheet.getRange(1, 1, numCells).setValues(valuesToWrite);
}

function deleteOpenSolverCache() {
  var cacheSheet = getCacheSheet();
  cacheSheet.clear();
}

function loadOpenSolverCache() {
  var cacheSheet = getCacheSheet();
  var lastRow = cacheSheet.getLastRow();
  if (lastRow == 0) {
    return null;
  }
  Logger.log('Last row of cache sheet: ' + lastRow);
  var cacheValues = cacheSheet.getRange(1, 1, lastRow).getValues();
  return JSON.parse(cacheValues.join(""));
}

// Saving current sheet

var _cachedSheetName;
var _cachedSheetId;

function setCachedSheet(sheet) {
  _cachedSheetName = sheet.getName();
  _cachedSheetId   = sheet.getSheetId();
}
function getCachedSheetName() { return _cachedSheetName; }
function getCachedSheetId() {
  return _cachedSheetId || loadOpenSolverCache().sheetId;
}

// For solver change form

var CACHE_KEY_SOLVERSHORTNAME = "CACHE_SOLVERSHORTNAME";

function getCachedSolverShortName() {
  return CacheService.getDocumentCache().get(CACHE_KEY_SOLVERSHORTNAME);
}
function setCachedSolverShortName(solverShortName) {
  CacheService
      .getDocumentCache()
      .put(CACHE_KEY_SOLVERSHORTNAME, solverShortName);
}

// For solve engine api key

function getCachedSolveEngineApiKey() {
  return CacheService.getDocumentCache().get(CACHE_KEY_SOLVEENGINE_APIKEY);
}

function setCachedSolveEngineApiKey(apiKey) {
  CacheService
      .getDocumentCache()
      .put(CACHE_KEY_SOLVEENGINE_APIKEY, apiKey);
}
