var NEOS_SERVER = 'http://www.neos-server.org';
var NEOS_PORT = 3332;
var NEOS_URL = NEOS_SERVER + ':' + NEOS_PORT;
var TIME_BETWEEN_CHECKS = 10;

// TODO move me
function createMplModel(openSolver) {
  var lines = [];

  for (var i = 0; i < openSolver.numVars; i++) {
    var varString = 'var v' + openSolver.varKeys[i];

    if (openSolver.varTypes[i] === VariableType.BINARY) {
      varString += ', binary';
    } else {
      if (openSolver.lowerBoundedVariables[i] !== undefined &&
          openSolver.assumeNonNegativeVars) {
        varString += ', >= 0';
      }
      if (openSolver.varTypes[i] === VariableType.INTEGER) {
        varString += ', integer';
      }
    }
    varString += ';';
    lines.push(varString);


  }
  var costLine = '  ';
  for (var objVar = 0; objVar < openSolver.costCoeffs.count(); objVar++) {
    var objConVarKey = openSolver.varKeys[openSolver.costCoeffs.index(objVar)];
    var objConVarCoeff = openSolver.costCoeffs.coeff(objVar);
    costLine += objConVarCoeff + ' * v' + objConVarKey + ' + ';
  }
  costLine += openSolver.objectiveConstant;

  // Add in objective coefficients unless we are seeking a target value
  if (openSolver.objectiveSense === ObjectiveSenseType.TARGET) {
    lines.push('var objValue;');
    lines.push('subject to set_objective:');
    costLine += ' == objValue;';
    lines.push(costLine);
    lines.push('var difference, >= 0;');
    lines.push('subject to set_difference_1: difference >= + objValue - ' +
               openSolver.objectiveTarget + ';');
    lines.push('subject to set_difference_2: difference >= - objValue + ' +
               openSolver.objectiveTarget + ';');
    lines.push('minimize total_difference: difference;');
  } else {
    var objectiveLine = '';
    if (openSolver.objectiveSense === ObjectiveSenseType.MINIMISE) {
      objectiveLine += 'minimize';
    } else {
      objectiveLine += 'maximize';
    }
    objectiveLine += ' total_cost:';
    lines.push(objectiveLine);
    costLine += ';';
    lines.push(costLine);
  }

  for (var row = 0; row < openSolver.numRows; row++) {
    var currConstraint = openSolver.sparseA[row];

    // Skip over any empty constraint, we have already verified it holds
    if (currConstraint.count() === 0) {
      continue;
    }

    var constraintHeader = 'subject to c' + row + ':';
    lines.push(constraintHeader);

    var constraintLine = '  ';
    for (var i = 0; i < currConstraint.count(); i++) {
      var index = currConstraint.index(i);
      var coeff = currConstraint.coeff(i);
      constraintLine += coeff + ' * v' + openSolver.varKeys[index];
      if (i < currConstraint.count() - 1) {
        constraintLine += ' + ';
      }
    }

    var rel = openSolver.relation[openSolver.rowToConstraint[row]];
    constraintLine += ' ' + relationConstToAmpl(rel);
    constraintLine += ' ' + openSolver.rhs[row] + ';';
    lines.push(constraintLine);
  }
  return lines;
}

function createAmplModel(openSolver) {
  var lines = createMplModel(openSolver);

  lines.push('option solver cbc;');
  lines.push('solve;');

  for (var i = 0; i < openSolver.numVars; i++) {
    lines.push('_display v' + openSolver.varKeys[i] + ';');
  }
  if (openSolver.objectiveSense !== ObjectiveSenseType.TARGET) {
    lines.push('_display total_cost;');
  } else {
    lines.push('_display 1;');
  }
  lines.push('display solve_result_num, solve_result;');

  return lines.join('\n');
}

function createGmplModel(openSolver) {
  var lines = createMplModel(openSolver);
  lines.push('end;');
  lines.push('');  // Avoid warning message about not finishing with blank line
  return lines.join('\n');
}

function submitJob(amplModel) {
  /*
  <document>
    <category>milp</category>
    <solver>Cbc</solver>
    <inputMethod>AMPL</inputMethod>

    <model><![CDATA[
    ...Insert Value Here...
    ]]></model>

    <data><![CDATA[
    ...Insert Value Here...
    ]]></data>

    <commands><![CDATA[
    ...Insert Value Here...
    ]]></commands>

    <comments><![CDATA[
    ...Insert Value Here...
    ]]></comments>
  </document>
  */
  var document = XmlService.createElement('document');

  document.addContent(XmlService.createElement('category').setText('milp'));
  document.addContent(XmlService.createElement('solver').setText('Cbc'));
  document.addContent(XmlService.createElement('inputMethod').setText('AMPL'));

  document.addContent(XmlService.createElement('model')
                          .addContent(XmlService.createCdata(amplModel)));

  document.addContent(XmlService.createElement('data')
                          .addContent(XmlService.createCdata('')));
  document.addContent(XmlService.createElement('commands')
                          .addContent(XmlService.createCdata('')));
  document.addContent(XmlService.createElement('comments')
                          .addContent(XmlService.createCdata('')));

  var job = XmlService.getPrettyFormat().format(document);
  Logger.log(job);

  var request = new XmlRpcRequest(NEOS_URL, 'submitJob');
  request.addParam(job);
  var response = request.send();
  var responseData = response.parseXML();

  var jobNumber = parseInt(responseData[0], 10);
  var jobPassword = responseData[1];

  if (jobNumber == 0) {
    throw(jobPassword);
  }

  return {
    jobNumber:   jobNumber,
    jobPassword: jobPassword
  };
}

function getJobStatus(jobNumber, jobPassword) {
  var request = new XmlRpcRequest(NEOS_URL, 'getJobStatus');
  request.addParam(jobNumber);
  request.addParam(jobPassword);
  var response = request.send();
  var responseData = response.parseXML();
  return responseData;
}

function getFinalResults(jobNumber, jobPassword) {
  var request = new XmlRpcRequest(NEOS_URL, 'getFinalResults');
  request.addParam(jobNumber);
  request.addParam(jobPassword);
  var response = request.send();
  var responseData = response.parseXML();
  var results = Utilities.newBlob(responseData.decode()).getDataAsString();
  return results;
}

function printQueue() {
  var request = new XmlRpcRequest(NEOS_URL, 'printQueue');
  var response = request.send();
  var responseData = response.parseXML();
  Logger.log(responseData);
  return responseData;
}

function getQueuePosition(jobNumber) {
  var queue = printQueue();
  var lines = queue.split('\n');
  var numLines = lines.length;

  // Find "Running:" line
  var i = 0;
  while (lines[i] != "Running:") {
    i++;
    if (i == numLines) {
      return null;
    }
  }

  // Advance to first running job
  i++;
  if (i == numLines) {
    return null;
  }

  // Advance over running jobs
  var numRunning = 0;
  while (lines[i]) {
    numRunning++;
    i++;
    if (i == numLines) {
      return null;
    }
  }

  // Advance to "Queued:" line
  while (lines[i] != "Queued:") {
    i++;
    if (i == numLines) {
      return null;
    }
  }

  // Advance to first queued job
  i++;
  if (i == numLines) {
    return null;
  }

  var queueStart = i - 1;
  var queuePosition = null;
  while (lines[i]) {
    if (lines[i].indexOf(jobNumber) >= 0) {
      queuePosition = i - queueStart;
    }

    i++;
    if (i == numLines) {
      return null;
    }
  }
  return queuePosition;
}

function waitForCompletion(jobNumber, jobPassword) {
  var timeElapsed = 0;
  while (true) {
    var jobStatus = getJobStatus(jobNumber, jobPassword);
    if (jobStatus == 'Done') {
      break;
    } else if (jobStatus == 'Waiting') {
      var queuePosition = getQueuePosition(jobNumber);
      var queueString = queuePosition ? '\nPosition in queue: ' + queuePosition
                                      : '';
      updateStatus('Time elapsed: ' + timeElapsed + ' seconds\n' +
                   'Waiting in queue to start...' + queueString,
                   'Solving model on NEOS...',
                   false,
                   TIME_BETWEEN_CHECKS);
    } else if (jobStatus == 'Running') {
      updateStatus('Time elapsed: ' + timeElapsed + ' seconds\n' +
                   'Model is solving...',
                   'Solving model on NEOS...',
                   false,
                   TIME_BETWEEN_CHECKS);
    } else {
      Logger.log(jobStatus);
      throw('An error occured while waiting for NEOS. NEOS returned: ' +
            jobStatus);
    }
    Utilities.sleep(TIME_BETWEEN_CHECKS * 1000);
    timeElapsed += TIME_BETWEEN_CHECKS;
  }
}
