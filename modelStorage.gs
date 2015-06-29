// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

OpenSolver.API = {
  setCheckLinear: function(checkLinear, sheet) {
    OpenSolver.util.setOpenSolverProperty(sheet, 'checkLinear', checkLinear);
  },

  getCheckLinear: function(sheet) {
    var properties = OpenSolver.util.getAllProperties();
    return properties[sheet.getSheetId() + '!openSolver_checkLinear'] === 'true';
  },

  setShowStatus: function(showStatus, sheet) {
    OpenSolver.util.setOpenSolverProperty(sheet, 'showStatus', showStatus);
  },

  getShowStatus: function(sheet) {
    var properties = OpenSolver.util.getAllProperties();
    return properties[sheet.getSheetId() + '!openSolver_showStatus'] === 'true';
  },

  setAssumeNonNegative: function(assumeNonNeg, sheet) {
    OpenSolver.util.setSolverProperty(sheet, 'neg', OpenSolver.util.assumeNonNegFromBoolean(assumeNonNeg).toString());
  },

  getAssumeNonNegative: function(sheet) {
    var properties = OpenSolver.util.getAllProperties();
    var nonNeg = properties[sheet.getSheetId() + '!solver_neg']
    if (nonNeg !== undefined) {
      return OpenSolver.util.assumeNonNegToBoolean(nonNeg);
    } else {
      return true;
    }
  },

  setVariables: function(variables, sheet) {
    if (variables.length > 0) {
      OpenSolver.util.setSolverProperty(sheet, 'adj', variables.join(','));
    } else {
      OpenSolver.util.deleteSolverProperty(sheet, 'adj');
    }
  },

  getVariables: function(sheet) {
    var properties = OpenSolver.util.getAllProperties();
    var varString = properties[sheet.getSheetId() + '!solver_adj'];
    if (varString !== undefined) {
      return varString.split(',');
    } else {
      return [];
    }
  },

  setObjective: function(objectiveString, sheet) {
    if (objectiveString) {
      OpenSolver.util.setSolverProperty(sheet, 'opt', objectiveString);
    } else {
      OpenSolver.util.deleteSolverProperty(sheet, 'opt');
    }
  },

  getObjective: function(sheet) {
    var properties = OpenSolver.util.getAllProperties();
    try {
      return properties[sheet.getSheetId() + '!solver_opt'];
    } catch(e) {
      return '';
    }
  },

  setObjectiveTargetValue: function(objectiveTargetValue, sheet) {
    OpenSolver.util.setSolverProperty(sheet, 'val', objectiveTargetValue);
  },

  getObjectiveTargetValue: function(sheet) {
    var properties = OpenSolver.util.getAllProperties();
    var targetVal = properties[sheet.getSheetId() + '!solver_val'];
    if (targetVal !== undefined) {
      return targetVal;
    } else {
      return 0.0;
    }
  },

  setObjectiveSense: function(objectiveSense, sheet) {
    OpenSolver.util.setSolverProperty(sheet, 'typ', objectiveSense.toString());
  },

  getObjectiveSense: function(sheet) {
    var properties = OpenSolver.util.getAllProperties();
    var objSense = properties[sheet.getSheetId() + '!solver_typ'];
    if (objSense !== undefined) {
      return objSense;
    } else {
      var defaultSense = OpenSolver.consts.objectiveSenseType.MINIMISE;
      OpenSolver.API.setObjectiveSense(defaultSense, sheet);
      return defaultSense;
    }
  },

  setConstraints: function(constraints, sheet) {
    var currentNum = parseInt(OpenSolver.util.getSolverProperty(sheet, 'num'), 10);

    properties = {};
    for (var i = 0; i < constraints.length; i++) {
      properties['lhs'.concat(i)] = constraints[i].lhs;
      properties['rhs'.concat(i)] = constraints[i].rhs;
      properties['rel'.concat(i)] = constraints[i].rel.toString();
    }
    properties['num'] = constraints.length.toString();
    OpenSolver.util.setSolverProperties(sheet, properties);

    // Clean up old constraint info
    for (var i = constraints.length; i < currentNum; i++) {
      OpenSolver.util.deleteSolverProperty(sheet, 'lhs'.concat(i));
      OpenSolver.util.deleteSolverProperty(sheet, 'rhs'.concat(i));
      OpenSolver.util.deleteSolverProperty(sheet, 'rel'.concat(i));
    }
  },

  getConstraints: function(sheet) {
    var constraints = [];
    var properties = OpenSolver.util.getAllProperties();
    if (properties[sheet.getSheetId() + '!solver_num']) {
      for (var i = 0; i < properties[sheet.getSheetId() + '!solver_num']; i++) {
        var lhs = properties[sheet.getSheetId() + '!solver_lhs'.concat(i)];
        var rhs = properties[sheet.getSheetId() + '!solver_rhs'.concat(i)];
        var rel = parseInt(properties[sheet.getSheetId() + '!solver_rel'.concat(i)]);
        constraints.push(new OpenSolver.Constraint(lhs, rhs, rel));
      }
    }
    return constraints;
  },

  clearModel: function(sheet) {
    var model = new OpenSolver.Model(sheet);
    model.save();
    return model;
  },

  loadModelFromSheet: function(sheet) {
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSheet();
    }
    var model = new OpenSolver.Model(sheet);
    model.load();
    return model;
  },

  // Converts a range parameter into the proper string for storage
  getRangeNotation: function(sheet, range) {
    // TODO add in sheet prefixing here
    return range.getA1Notation();
  },
};
