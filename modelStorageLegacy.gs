function loadLegacyModel(sheet) {
  var model = new Model(sheet, false);

  var props = PropertiesService.getDocumentProperties();
  var properties = props.getProperties();

  var obj = properties[solverName('opt')] || '';
  Logger.log('Loading objective: ' + obj);
  model.updateObjective(obj);

  var objSense = parseInt(properties[solverName('typ')], 10) ||
                 ObjectiveSenseType.MINIMISE;
  Logger.log('Loading objective sense: ' + objSense);
  model.updateObjectiveSense(objSense);

  var objVal = parseFloat(properties[solverName('val')], 10) || 0;
  Logger.log('Loading objective target: ' + objVal);
  model.updateObjectiveTarget(objVal);

  var varString = properties[solverName('adj')];
  Logger.log('Loading variable string: ' + varString);
  var varStrings = varString ? varString.split(',') : [];
  Logger.log('Variable strings: ' + varStrings);
  for (var j = 0; j < varStrings.length; j++) {
    Logger.log('Adding variable: ' + varStrings[j]);
    model.addVariable(varStrings[j]);
  }

  var numCons = parseInt(properties[solverName('num')] || 0, 10);
  Logger.log('Loading ' + numCons + ' constraints');
  for (var i = 0; i < numCons; i++) {
    var lhs = properties[solverName('lhs' + i)];
    var rhs = properties[solverName('rhs' + i)];
    var rel = parseInt(properties[solverName('rel' + i)]);
    Logger.log('Adding constraint:');
    Logger.log('LHS: ' + lhs);
    Logger.log('RHS: ' + rhs);
    Logger.log('rel: ' + rel);
    model.addConstraint(lhs, rhs, rel);
  }

  var assumeNonNeg = integerToBool(properties[solverName('neg')]) || true;
  Logger.log('Loading assume non negative: ' + assumeNonNeg);
  model.updateAssumeNonNeg(assumeNonNeg);

  var showStatus = (properties[openSolverName('showStatus')] || 'false') === 'true';
  Logger.log('Loading show status: ' + showStatus);
  model.updateShowStatus(showStatus);

  var checkLinear = (properties[openSolverName('checkLinear')] || 'true') === 'true';
  Logger.log('Loading check linear: ' + checkLinear);
  model.updateCheckLinear(checkLinear);

  return model;
}
