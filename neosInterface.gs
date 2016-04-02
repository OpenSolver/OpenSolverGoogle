var NEOS_SERVER = 'http://www.neos-server.org';
var NEOS_PORT = 3332;
var NEOS_URL = NEOS_SERVER + ':' + NEOS_PORT;

// TODO move me
function createAmplModel(openSolver) {
  var lines = [];

  var costLine = '  ';

  for (var i = 0; i < openSolver.numVars; i++) {
    var varString = 'var ' + openSolver.varKeys[i];

    if (openSolver.varTypes[i] === VariableType.BINARY) {
      varString += ', binary';
    } else {
      if (openSolver.lowerBoundedVariables[i] !== true &&
          openSolver.assumeNonNegativeVars) {
        varString += ', >= 0';
      }
      if (openSolver.varTypes[i] === VariableType.INTEGER) {
        varString += ', integer';
      }
    }
    varString += ';';
    lines.push(varString);

    costLine += openSolver.costCoeffs[i] + '*' + openSolver.varKeys[i];
    if (i < openSolver.numVars - 1) {
      costLine += ' + ';
    }
  }

  // Add in objective coefficients unless we are seeking a target value
  if (openSolver.objectiveSense === ObjectiveSenseType.TARGET) {
    lines.push('subject to TargetConstr:');
    costLine += ' = ' + openSolver.objectiveTarget + ';';
    lines.push(costLine);
  } else {
    var objectiveLine = '';
    if (openSolver.objectiveSense === ObjectiveSenseType.MINIMISE) {
      objectiveLine += 'minimize';
    } else {
      objectiveLine += 'maximize';
    }
    objectiveLine += ' Total_Cost:';
    lines.push(objectiveLine);
    costLine += ';';
    lines.push(costLine);
  }

  for (var row = 0; row < openSolver.numRows; row++) {
    var currConstraint = openSolver.sparseA[row];

    if (currConstraint.count() === 0) {
      var invalid = openSolver.validateEmptyConstraint(row);
      if (invalid !== false) {
        return invalid;
      }
    } else {
      var constraintHeader = 'subject to c' + row + ':';
      lines.push(constraintHeader);

      var constraintLine = '  ';
      for (var i = 0; i < currConstraint.count(); i++) {
        var index = currConstraint.index(i);
        var coeff = currConstraint.coeff(i);
        constraintLine += coeff + ' * ' + openSolver.varKeys[index];
        if (i < currConstraint.count() - 1) {
          constraintLine += ' + ';
        }
      }

      constraintLine += ' ' + relationConstToString(openSolver.relation[row]);
      constraintLine += ' ' + openSolver.rhs[row] + ';';
      lines.push(constraintLine);
    }
  }

  lines.push('option solver cbc;');
  lines.push('solve;');

  for (var i = 0; i < openSolver.numVars; i++) {
    lines.push('_display ' + openSolver.varKeys[i] + ';');
  }
  if (openSolver.objectiveSense !== ObjectiveSenseType.TARGET) {
    lines.push('_display Total_Cost;');
  } else {
    lines.push('_display 1;');
  }
  lines.push('display solve_result_num, solve_result;');

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

  return {
    jobNumber:   parseInt(responseData[0], 10),
    jobPassword: responseData[1]
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

function test() {
  Logger.log(getQueuePosition(4414739));
}
