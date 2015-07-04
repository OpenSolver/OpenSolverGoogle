// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};
var props;
var lastToastTime;

OpenSolver.util = {
  relationConstToString: function(relationConst) {
    switch(relationConst) {
      case OpenSolver.consts.relation.LE:
        return '<=';
        break;
      case OpenSolver.consts.relation.EQ:
        return '==';
        break;
      case OpenSolver.consts.relation.GE:
        return '>=';
        break;
      case OpenSolver.consts.relation.INT:
        return 'int';
        break;
      case OpenSolver.consts.relation.BIN:
        return 'bin';
        break;
      case OpenSolver.consts.relation.ALLDIFF:
        return 'alldiff';
        break;
      default:
        throw 'Unknown relation';
    }
  },

  relationConstHasRHS: function(relationConst) {
    switch(relationConst) {
      case OpenSolver.consts.relation.LE:
        return true;
        break;
      case OpenSolver.consts.relation.EQ:
        return true;
        break;
      case OpenSolver.consts.relation.GE:
        return true;
        break;
      case OpenSolver.consts.relation.INT:
        return false;
        break;
      case OpenSolver.consts.relation.BIN:
        return false;
        break;
      case OpenSolver.consts.relation.ALLDIFF:
        return false;
        break;
      default:
        throw 'Unknown relation';
    }
  },

  assumeNonNegToBoolean: function(nonNeg) {
    switch(parseInt(nonNeg, 10)) {
      case OpenSolver.consts.assumeNonNeg.TRUE:
        return true;
        break;
      case OpenSolver.consts.assumeNonNeg.FALSE:
        return false;
        break;
      default:
        throw 'Unknown non-negativity assumption';
    }
  },

  assumeNonNegFromBoolean: function(nonNeg) {
    switch(nonNeg) {
      case true:
        return OpenSolver.consts.assumeNonNeg.TRUE;
        break;
      case false:
        return OpenSolver.consts.assumeNonNeg.FALSE;
        break;
      default:
        throw 'Unknown non-negativity assumption';
    }
  },

  setSolverProperty: function(sheet, key, value) {
    props = props || PropertiesService.getDocumentProperties();
    props.setProperty(sheet.getSheetId() + '!solver_'.concat(key), value);
  },

  setOpenSolverProperty: function(sheet, key, value) {
    props = props || PropertiesService.getDocumentProperties();
    props.setProperty(sheet.getSheetId() + '!openSolver_'.concat(key), value);
  },

  setSolverProperties: function(sheet, properties) {
    props = props || PropertiesService.getDocumentProperties();
    var solverProps = {};
    for (var key in properties) {
      if (properties.hasOwnProperty(key)) {
        solverProps[sheet.getSheetId() + '!solver_'.concat(key)] = properties[key];
      }
    }
    props.setProperties(solverProps);
  },

  getSolverProperty: function(sheet, key) {
    props = props || PropertiesService.getDocumentProperties();
    return props.getProperty(sheet.getSheetId() + '!solver_'.concat(key));
  },

  getAllProperties: function() {
    props = props || PropertiesService.getDocumentProperties();
    return props.getProperties();
  },

  clearAllProperties: function() {
    props = props || PropertiesService.getDocumentProperties();
    props.deleteAllProperties();
  },

  deleteSolverProperty: function(sheet, key) {
    props = props || PropertiesService.getDocumentProperties();
    props.deleteProperty(sheet.getSheetId() + '!solver_'.concat(key))
  },

  showMessage: function(message, title) {
    var ui = SpreadsheetApp.getUi();
    if (title) {
      ui.alert(title, message, ui.ButtonSet.OK);
    } else {
      ui.alert(message);
    }
  },

  showError: function(e) {
    OpenSolver.util.showMessage(e.message, e.title);
  },

  getRangeDims: function(range) {
    return {
      rows: range.getNumRows(),
      cols: range.getNumColumns()
    };
  },

  getRangeSize: function(range) {
    return range.getNumRows() * range.getNumColumns();
  },

  checkRangeIntersect: function(range1, range2) {
    var result = false;
    if (range1 && range2 &&
        range1.getSheet().getName() === range2.getSheet().getName()) {
      var r1x1 = range1.getRow();
      var r1x2 = range1.getLastRow();
      var r1y1 = range1.getColumn();
      var r1y2 = range1.getLastColumn();
      var r2x1 = range2.getRow();
      var r2x2 = range2.getLastRow();
      var r2y1 = range2.getColumn();
      var r2y2 = range2.getLastColumn();

      result = !(r1x1 > r2x2 || r1x2 < r2x1 || r1y1 > r2y2 && r1y2 < r2y1);
    }
    return result;
  },

  getRangeIntersect: function(range1, range2) {
    var result = null;
    if (range1 && range2 &&
        range1.getSheet().getName() === range2.getSheet().getName()) {
      var r1x1 = range1.getRow();
      var r1x2 = range1.getLastRow();
      var r1y1 = range1.getColumn();
      var r1y2 = range1.getLastColumn();
      var r2x1 = range2.getRow();
      var r2x2 = range2.getLastRow();
      var r2y1 = range2.getColumn();
      var r2y2 = range2.getLastColumn();

      // find intersection:
      var xL = Math.max(r1x1, r2x1);
      var xR = Math.min(r1x2, r2x2);
      if (xR >= xL) {
        var yT = Math.max(r1y1, r2y1);
        var yB = Math.min(r1y2, r2y2);
        if (yB >= yT) {
          result = range1.getSheet().getRange(xL, yB, xR - xL + 1, yB - yT + 1);
        }
      }
    }
    return result;
  },

  valueIsError: function(value) {
    var errorValues = ['#DIV/0!', '#NUM!', '#N/A', '#VALUE!'];
    for (var i = 0; i < errorValues.length; i++) {
      if (value === errorValues[i]) {
        return true;
      }
    }
    return false;
  },

  createArray: function(length) {
    var arr = new Array(length || 0);
    var i = length;

    if (arguments.length > 1) {
      var args = Array.prototype.slice.call(arguments, 1);
      while(i--) arr[length-1 - i] = OpenSolver.util.createArray.apply(this, args);
    }

    return arr;
  },

  updateStatus: function(msg, title, priority) {
    if (openSolver && openSolver.showStatus) {
      lastToastTime = lastToastTime || 0;
      var now = new Date().getTime();
      if (now - lastToastTime > (OpenSolver.consts.TOAST_TIMEOUT) * 1000 || priority) {
        SpreadsheetApp.getActiveSpreadsheet().toast(msg, title);
        lastToastTime = now;
      }
    }
  },

  checkValueIsNumeric: function(value, errorInvalid, errorNotNumeric) {
    if (OpenSolver.util.valueIsError(value)) {
      throw(errorInvalid());
    } else if (typeof(value) !== 'number') {
      // An empty cell has value '' (the empty string)
      // This is different to Excel where empty cells had value 0
      // We set this to value 0 so that we don't run into issues later on
      if (value === '') {
        value = 0;
      } else {
        throw(errorNotNumeric());
      }
    }
    return value;
  },

  checkRangeValuesNumeric: function(range, errorInvalid, errorNotNumeric) {
    var values = range.getValues();
    for (var i = 0; i < values.length; i++) {
      for (var j = 0; j < values[i].length; j++) {
        values[i][j] = OpenSolver.util.checkValueIsNumeric(
                           values[i][j],
                           function() {
                             var cellName = range.getCell(i + 1, j + 1).getA1Notation();
                             return errorInvalid(cellName);
                           },
                           function() {
                             var cellName = range.getCell(i + 1, j + 1).getA1Notation();
                             return errorNotNumeric(cellName);
                           }
        );
      }
    }
    return values;
  }

};
