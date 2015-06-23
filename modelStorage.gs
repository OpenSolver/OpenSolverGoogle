// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

OpenSolver.API = {
  setCheckLinear: function(checkLinear) {
    OpenSolver.util.setOpenSolverProperty('checkLinear', checkLinear);
  },

  getCheckLinear: function() {
    var properties = OpenSolver.util.getAllProperties();
    return properties['openSolver_checkLinear'] === 'true';
  },

  setShowStatus: function(showStatus) {
    OpenSolver.util.setOpenSolverProperty('showStatus', showStatus);
  },

  getShowStatus: function() {
    var properties = OpenSolver.util.getAllProperties();
    return properties['openSolver_showStatus'] === 'true';
  },

  setAssumeNonNegative: function(assumeNonNeg) {
    OpenSolver.util.setSolverProperty('neg', OpenSolver.util.assumeNonNegFromBoolean(assumeNonNeg).toString());
  },

  getAssumeNonNegative: function() {
    var properties = OpenSolver.util.getAllProperties();
    if (properties['solver_neg'] !== undefined) {
      return OpenSolver.util.assumeNonNegToBoolean(properties['solver_neg']);
    } else {
      return true;
    }
  },

  setVariables: function(variables) {
    var varstring = variables.map(function(varRange) { return varRange.getA1Notation(); })
                             .join(',');
    if (varstring) {
      OpenSolver.util.setSolverProperty('adj', varstring);
    } else {
      OpenSolver.util.deleteSolverProperty('adj');
    }
  },

  getVariables: function(sheet) {
    var properties = OpenSolver.util.getAllProperties();
    if (properties['solver_adj'] !== undefined) {
      var varStrings = properties['solver_adj'].split(',');
      return varStrings.map(function(v) { return sheet.getRange(v); });
    } else {
      return [];
    }
  },

  setObjective: function(objectiveRange) {
    var objString = objectiveRange.getA1Notation();
    if (objString) {
      OpenSolver.util.setSolverProperty('opt', objString);
    } else {
      OpenSolver.util.deleteSolverProperty('opt');
    }
  },

  getObjective: function(sheet) {
    var properties = OpenSolver.util.getAllProperties();
    try {
      return sheet.getRange(properties['solver_opt']);
    } catch(e) {
      return new OpenSolver.MockRange([[0]]);
    }
  },

  setObjectiveTargetValue: function(objectiveTargetValue) {
    OpenSolver.util.setSolverProperty('val', objectiveTargetValue);
  },

  getObjectiveTargetValue: function() {
    var properties = OpenSolver.util.getAllProperties();
    if (properties['solver_val'] !== undefined) {
      return properties['solver_val'];
    } else {
      return 0.0;
    }
  },

  setObjectiveSense: function(objectiveSense) {
    OpenSolver.util.setSolverProperty('typ', objectiveSense.toString());
  },

  getObjectiveSense: function() {
    var properties = OpenSolver.util.getAllProperties();
    if (properties['solver_typ'] !== undefined) {
      return properties['solver_typ'];
    } else {
      var defaultSense = OpenSolver.consts.objectiveSenseType.MINIMIZE;
      OpenSolver.API.setObjectiveSense(defaultSense);
      return defaultSense;
    }
  },

  setConstraints: function(constraints) {
    var currentNum = parseInt(OpenSolver.util.getSolverProperty('num'), 10);

    properties = {};
    for (var i = 0; i < constraints.length; i++) {
      properties['lhs'.concat(i)] = constraints[i].lhs;
      properties['rhs'.concat(i)] = constraints[i].rhs;
      properties['rel'.concat(i)] = constraints[i].rel.toString();
    }
    properties['num'] = constraints.length.toString();
    OpenSolver.util.setSolverProperties(properties);

    // Clean up old constraint info
    for (var i = constraints.length; i < currentNum; i++) {
      OpenSolver.util.deleteSolverProperty('lhs'.concat(i));
      OpenSolver.util.deleteSolverProperty('rhs'.concat(i));
      OpenSolver.util.deleteSolverProperty('rel'.concat(i));
    }
  },

  getConstraints: function() {
    var constraints = [];
    var properties = OpenSolver.util.getAllProperties();
    if (properties['solver_num']) {
      for (var i = 0; i < properties['solver_num']; i++) {
        var lhs = properties['solver_lhs'.concat(i)];
        var rhs = properties['solver_rhs'.concat(i)];
        var rel = parseInt(properties['solver_rel'.concat(i)]);
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
  }
};
