SolverNeos = function() {
  Solver.call(this);
  this.solve_result_num = -1;
  this.objectiveValue = null;
  this.variableValues = {};
};

SolverNeos.prototype = Object.create(Solver.prototype);
SolverNeos.prototype.constructor = SolverGoogle;

SolverNeos.prototype.getStatus = function() {
  var result;
  var solveString;
  var loadSolution = false;
  if (this.solve_result_num < 0) {
    result = OpenSolverResult.UNSOLVED;
    solveString = 'The model has not yet been solved.';

  } else if (this.solve_result_num < 100) {
    result = OpenSolverResult.OPTIMAL;
    solveString = 'Optimal';
    loadSolution = true;

  } else if (this.solve_result_num < 200) {
    throw('Returned status: solved?');

  } else if (this.solve_result_num < 300) {
    result = OpenSolverResult.INFEASIBLE;
    solveString = 'No feasible solution was found.';

  } else if (this.solve_result_num < 400) {
    result = OpenSolverResult.UNBOUNDED;
    solveString = 'No solution found (Unbounded)';

  } else if (this.solve_result_num < 500) {
    result = OpenSolverResult.TIME_LIMITED_SUB_OPTIMAL;
    solveString = 'An optimal solution was not found. A feasible solution ' +
                  'was loaded instead.';
    loadSolution = true;

  } else if (this.solve_result_num < 600) {
    result = OpenSolverResult.ERROR_OCCURRED;
    solveString = 'There was an error while solving the model.';

  } else {
    throw('Unknown solve result');
  }

  return {
    solveStatus:       result,
    solveStatusString: solveString,
    loadSolution:      loadSolution
  };
};

SolverNeos.prototype.getObjectiveValue = function() {
  return this.objectiveValue;
};

SolverNeos.prototype.getVariableValue = function(varKey) {
  var value = this.variableValues[varKey];
  if (value === undefined) {
    value = null;
  }
  return value;
};

SolverNeos.prototype.solve = function(openSolver) {
  var amplModel = createAmplModel(openSolver);
  Logger.log(amplModel);

  updateStatus('Sending model to NEOS server', 'Solving model on NEOS...');
  var jobInfo = submitJob(amplModel);

  var timeElapsed = 0;
  var TIME_INCREMENT = 10;
  while (true) {
    Utilities.sleep(TIME_INCREMENT * 1000);
    timeElapsed += TIME_INCREMENT;

    var jobStatus = getJobStatus(jobInfo.jobNumber, jobInfo.jobPassword);
    if (jobStatus == 'Done') {
      break;
    } else if (jobStatus == 'Waiting') {
      var queuePosition = getQueuePosition(jobInfo.jobNumber);
      var queueString = queuePosition ? '\nPosition in queue: ' + queuePosition
                                      : '';
      updateStatus('Time elapsed: ' + timeElapsed + ' seconds\n' +
                   'Waiting in queue to start...' + queueString,
                   'Solving model on NEOS...');
    } else if (jobStatus == 'Running') {
      updateStatus('Time elapsed: ' + timeElapsed + ' seconds\n' +
                   'Model is solving...',
                   'Solving model on NEOS...');
    } else {
      Logger.log(jobStatus);
      throw('An error occured while waiting for NEOS. NEOS returned: ' +
            jobStatus);
    }
  }

  var finalResults = getFinalResults(jobInfo.jobNumber, jobInfo.jobPassword);
  this.extractResults(finalResults, openSolver.varKeys);

  return this.getStatus();
};

SolverNeos.prototype.extractResults = function(finalResults, varNames) {
  var NUM_STRING = 'solve_result_num = ';

  var numStart = finalResults.indexOf(NUM_STRING) + NUM_STRING.length;

  if (numStart < 0) {
    this.solve_result_num = 500;
    return;
  }

  var numEnd = finalResults.indexOf('\n', numStart);
  var numString = finalResults.substring(numStart, numEnd);

  var solve_result_num = parseInt(numString, 10);
  if (isNaN(solve_result_num)) {
    this.solve_result_num = 500;
    return;
  } else {
    Logger.log('found solve result num: ' + solve_result_num);
    this.solve_result_num = solve_result_num;
  }

  if (!this.getStatus().loadSolution) {
    return;
  }

  for (var i = 0; i < varNames.length; i++) {
    var varName = varNames[i];

    var varStart = finalResults.indexOf(varName) + varName.length + 1;

    if (varStart < 0) {
      this.solve_result_num = 500;
      this.values = [];
      return;
    }

    var varEnd = finalResults.indexOf('\n', varStart);

    var varValueString = finalResults.substring(varStart, varEnd);
    var varValue = parseFloat(varValueString, 10);

    Logger.log('found ' + varValue + ' for ' + varName);
    this.variableValues[varName] = varValue;
  }

  var OBJ_NAME = 'Total_Cost';
  var objStart = finalResults.indexOf(OBJ_NAME) + OBJ_NAME.length + 1;

  if (objStart < 0) {
    this.solve_result_num = 500;
    this.values = [];
    return;
  }

  var objEnd = finalResults.indexOf('\n', objStart);
  var objValueString = finalResults.substring(objStart, objEnd);
  var objValue = parseFloat(objValueString, 10);
  Logger.log('found ' + objValueString + ' for objective');
  this.objectiveValue = objValue;

  Logger.log(this.variableValues);
};
