var _cache;
var _cachedSheetName;
var _cachedSheetId;

var CACHE_KEY_OPENSOLVER = "CACHE_OPENSOLVER";

var CACHE_TIME = 3600;  // 1 hour

function updateOpenSolverCache(openSolver) {
  _cache = _cache || CacheService.getDocumentCache();
//  Logger.log(JSON.stringify(openSolver));
  _cache.put(CACHE_KEY_OPENSOLVER, JSON.stringify(openSolver), CACHE_TIME);
}

function deleteOpenSolverCache() {
  _cache = _cache || CacheService.getDocumentCache();
  _cache.remove(CACHE_KEY_OPENSOLVER);
}

function loadOpenSolverCache() {
  _cache = _cache || CacheService.getDocumentCache();
  var cached = _cache.get(CACHE_KEY_OPENSOLVER);
//  Logger.log(cached);
  return JSON.parse(cached);
}

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
