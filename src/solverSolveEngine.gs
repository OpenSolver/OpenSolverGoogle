var SE_CHECK_TIME = 2;  // Time between update checks in seconds

SolverSolveEngine = function() {
  Solver.call(this);

  this.client = null;
  this.started = false;  // whether the job has been started on SolveEngine

  // Result details
  this.status = "";
  this.objectiveValue = null;
  this.variableValues = {};

  return this;
};

SolverSolveEngine.prototype = Object.create(Solver.prototype);
SolverSolveEngine.prototype.constructor = SolverSolveEngine;


SolverSolveEngine.prototype.getObjectiveValue = function() {
  return this.objectiveValue;
};

SolverSolveEngine.prototype.getVariableValue = function(varKey) {
  Logger.log("Key: " + varKey + "Value: " + this.variableValues[varKey]);
  var value = this.variableValues[varKey];
  if (value === undefined) {
    value = null;
  }
  return value;
};

SolverSolveEngine.prototype.getApiKey = function() {
  var key = getCachedSolveEngineApiKey();
  if (key != '') {
    return key;
  } else {
    var id = showDialog('dialogSolveEngineApi', 'Enter API key', 150, 350);

    // Wait until dialog has loaded
    var state = getDialogState(id, true);
    while (state == DialogState.PENDING) {
      state = getDialogState(id, true);
    }

    // Wait for response
    while (state == DialogState.OPEN) {
      state = getDialogState(id, false);
    }

    // Exit if not properly loaded
    if (state !== DialogState.DONE) {
      return null;
    } else {
      return getCachedSolveEngineApiKey();
    }
  }
};

SolverSolveEngine.prototype.getStatus = function() {
var result;
  var solveString;
  var loadSolution = false;
  switch(this.status) {
    case '':
      result = OpenSolverResult.UNSOLVED;
      solveString = 'The model has not yet been solved.';
      break;

    case 'optimal':
      result = OpenSolverResult.OPTIMAL;
      solveString = 'Optimal';
      loadSolution = true;
      break;

    case 'infeasible':
      result = OpenSolverResult.INFEASIBLE;
      solveString = 'No feasible solution was found.';
      break;

    case 'interrupted':
      result = OpenSolverResult.ABORTED_THRU_USER_ACTION;
      solveString = 'Cancelled by user.';
      break;

    case 'failed':
      result = OpenSolverResult.ERROR_OCCURRED;
      solveString = 'There was an error while solving the model.';
      break;

    default:
      throw('Unknown solve result: ' + this.status);
  }

  return {
    solveStatus:       result,
    solveStatusString: solveString,
    loadSolution:      loadSolution
  };

};

SolverSolveEngine.prototype.solve = function(openSolver) {
  if (!this.client) {
    var key = this.getApiKey();
    if (key == '') {
      throw(makeError('SolveEngine API key not set'));
    }
    this.client = new SolveEngineClient(key);
  }
  Logger.log("Auth token: " + this.client.authToken);

  // Skip submission if the solver has already submitted the job.
  // This happens if we are resuming a solve from the cache after timeout.
  if (!this.started) {
    var err = this.submitJob(openSolver);
    if (err !== null) {
      // Something went wrong while submitting the job
      if (err.code == 401) {  // UNAUTHORIZED
        // Clear the invalid API key from the cache
        setCachedSolveEngineApiKey('');
        status = "The API key specified for the Solve Engine was invalid. " +
                 "Please try again with a valid API key.";
      } else {
        status = err.error + ": " + err.code + "\n\nThe response was:\n" +
                 JSON.stringify(err.payload, null, 4);
      }
      return {
        solveStatus:       OpenSolverResult.ERROR_OCCURRED,
        solveStatusString: status,
        loadSolution:      false
      };
    }
  }

  this.waitForCompletion();
  var finalResults = this.getFinalResults();
  this.extractResults(finalResults);

  return this.getStatus();
};

SolverSolveEngine.prototype.extractResults = function(finalResults) {
  if (finalResults.code == 200) {
    var message = JSON.parse(finalResults.message);
    var results = message.results;

    this.objectiveValue = results.objval;
    this.status = results.status;

    Logger.log(results.variables[0]);
    for (var i = 0; i < results.variables.length; i++) {
      var variable = results.variables[i];
      Logger.log("Variable object: "  + variable.name);
      this.variableValues[variable.name.replace("v", "")] = variable.value;
    }
    Logger.log(this.variableValues);
  } else {
    this.status = 'failed';
  }

  return this;
};

SolverSolveEngine.prototype.submitJob = function(openSolver) {
  var gmplModel = createGmplModel(openSolver);
  updateStatus('Sending model to the SolveEngine',
               'Solving model on the SolveEngine...', true, SE_CHECK_TIME);

  var resp = this.client.createJob(gmplModel);
  Logger.log("Create job response " + resp.code);
  if (resp.code != 201) {
    return {
      error: "Unexpected response code while creating a job",
      code: resp.code,
      payload: JSON.parse(resp.message)
    };
  }

  var content = JSON.parse(resp.message);
  this.client.jobId = content.job_id;

  resp = this.client.submitData(gmplModel);
  Logger.log("Submit data response " + resp.code);
  if (resp.code != 200) {
    return {
      error: "Unexpected response code while sending job data",
      code: resp.code,
      payload: JSON.parse(resp.message)
    };
  }

  resp = this.client.startJob();
  Logger.log("Start job response " + resp.code);
  if (resp.code != 201) {
    return {
      error: "Unexpected response code while sending job data",
      code: resp.code,
      payload: JSON.parse(resp.message)
    };
  }

  // This job has now been started successfully, so we shouldn't start it again
  this.started = true;

  return null;
};

SolverSolveEngine.prototype.loadFromCache = function(data) {
  var keys = data ? Object.keys(data) : [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    this[key] = data[key];
  }

  this.client = new SolveEngineClient().loadFromCache(this.client);
  return this;
};

SolverSolveEngine.prototype.getFinalResults = function() {
  return this.client.getResults();
};

SolverSolveEngine.prototype.waitForCompletion = function() {
 var timeElapsed = 0;
 updateStatus('Solving the model on the Solve Engine',
              'Solving model on SolveEngine...', false, SE_CHECK_TIME);
  while (true) {
    var resp = this.client.getStatus();
    Logger.log(resp);
    var content = JSON.parse(resp.message);
    Logger.log(content);
    var jobStatus = content.status;
    if (jobStatus == "completed" || jobStatus == "failed") {
      break;
    } else if (jobStatus == "translating") {
      updateStatus('Translating problem', 'Solving model on SolveEngine...',
                   false, SE_CHECK_TIME);
    } else if (jobStatus == "started" || jobStatus == "starting") {
      updateStatus('Waiting for the SolveEngine\n' +
                   'Time elapsed: ' + timeElapsed + ' seconds',
                   'Solving model on SolveEngine...',
                   false,
                   SE_CHECK_TIME);
    } else if (jobStatus == "queued") {
      updateStatus('Waiting in SolveEngine queue',
                   'Solving model on SolveEngine...',
                   false, SE_CHECK_TIME);
    } else {
      throw(MakeError('Unknown SolveEngine status: ' + jobStatus));
    }
    Utilities.sleep(SE_CHECK_TIME * 1000);
    timeElapsed += SE_CHECK_TIME;
  }
};
