var SE_CHECK_TIME = 2;  // Time between update checks in seconds

SolveEngine = function() {
  Solver.call(this);

  // solveEngine details
  this.jobId = null;
  this.authToken = null;
  this.client = null;

  // Result details
  this.solve_result_num = -1;
  this.status = "";
  this.objectiveValue = null;
  this.variableValues = {};

  return this;
};

SolveEngine.prototype = Object.create(Solver.prototype);
SolveEngine.prototype.constructor = SolveEngine;


SolveEngine.prototype.getObjectiveValue = function() {
  return this.objectiveValue;
};

SolveEngine.prototype.getVariableValue = function(varKey) {
Logger.log("Key: " + varKey + "Value: " + this.variableValues[varKey]);
  var value = this.variableValues[varKey];
  if (value === undefined) {
    value = null;
  }
  return value;
};

SolveEngine.prototype.getApiKey = function() {
  var key = getCachedSolveEngineApiKey();
  if(key){
    return key;
  } else {
    var id = showDialog('dialogSolveEngineApi', 'Enter API key', 150, 350);
    var state = getDialogState(id, true);
    while(state == DialogState.OPEN || state == DialogState.PENDING) {
      // wait
      state = getDialogState(id, true);
    }
    if(state !== DialogState.DONE){
     return null;
     } else {
       return getCachedSolveEngineApiKey();
     }
  }
}

SolveEngine.prototype.getStatus = function() {
var result;
  var solveString;
  var loadSolution = false;
  if (this.solve_result_num < 0) {
    result = OpenSolverResult.UNSOLVED;
    solveString = 'The model has not yet been solved.';

  } else if (this.solve_result_num = 100) {
    result = OpenSolverResult.OPTIMAL;
    solveString = 'Optimal';
    loadSolution = true;

  } else if (this.status == "infeasible") {
    result = OpenSolverResult.INFEASIBLE;
    solveString = 'No feasible solution was found.';

  } else if (this.status == "interupted" || this.solve_result_num == 400) {
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

}

SolveEngine.prototype.solve = function(openSolver) {
  // Skip submission if the solver has already submitted the job.
  // This happens if we are resuming a solve from the cache after timeout.

  if (!this.authToken) {
  Logger.log("getting auth token");
  var key = this.getApiKey();
   if(!key) {
     throw(makeError('Api key not set'));
   }
   this.authToken = key;
  }

  if(!this.client){
  this.client = new SEClient(this.authToken);
  }
Logger.log("Auth token: " + this.authToken);
 var err = this.submitJob(openSolver);
 if (err != null) {
   if(err.code == 401) {
     this.authToken = "";
     setCachedSolveEngineApiKey(null);
     return {
      solveStatus:       OpenSolverResult.UNAUTHORIZED,
      solveStatusString: "unauthorized",
      loadSolution:      false
    };
   }
   return err;
 }

 this.waitForCompletion();
 var finalResults = this.getFinalResults();
 this.extractResults(finalResults, openSolver.varKeys);

 return this.getStatus();
};

SolveEngine.prototype.extractResults = function(finalResults, varNames) {
  var results = finalResults.results;
  this.objectiveValue = results.objval;
  this.status = results.status;
  Logger.log(results.variables[0]);
  for (var i=0; i < results.variables.length; i++) {
  var variable = results.variables[i]
    Logger.log("Variable object: "  + variable.name);
    this.variableValues[variable.name.replace("v", "")]=variable.value;
  }
  Logger.log(this.variableValues);
  return this;
};

SolveEngine.prototype.submitJob = function(openSolver) {
  var gmplModel = createGmplModel(openSolver);
  updateStatus('Sending model to the SolveEngine', 'Solving model on the SolveEngine',
               true, TIME_BETWEEN_CHECKS);

  var resp = this.client.createJob(gmplModel);
  Logger.log("Create job response " + resp.code);
  var content = JSON.parse(resp.message);
  if(resp.code != 201) {
    return {
       "error": "Unexpected response code, while creating a job",
      "code":resp.code,
      "payload":content
    };
  }

  this.client.jobId = content.job_id
  resp = this.client.submitData(gmplModel);
  if(resp.code != 200) {
    return {
       "error": "Unexpected response code, while sending job data",
      "code":resp.code,
      "payload":content
    };
  }

  resp = this.client.startJob();
  if(resp.code != 201) {
    return {
       "error": "Unexpected response code, while sending job data",
      "code":resp.GetResponseCode(),
      "payload":content
    };
  }

  return null;
};

SolveEngine.prototype.loadFromCache = function(data) {
  var keys = data ? Object.keys(data) : [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    this[key] = data[key];
  }
  return this;
};

SolveEngine.prototype.getFinalResults = function() {
  var resp = this.client.getResults()
  if (resp.code == 200) {
    this.solve_result_num = 100
  } else if(resp.code == 400) {
    this.solve_result_num = 0
  } else {
    this.solve_result_num = 400
  }

  return JSON.parse(resp.message);
}

SolveEngine.prototype.waitForCompletion = function(){
 var timeElapsed = 0;
 updateStatus('Solving the model on the Solve Engine',
              'Solving model on SolveEngine...', false, SE_CHECK_TIME);
  while (true) {
    var resp = this.client.getStatus();
    Logger.log(resp);
    var content = JSON.parse(resp.message);
    Logger.log(content);
    jobStatus = content.status;
    if (jobStatus == "completed") {
      break;
    } else if (jobStatus == "translating") {
      updateStatus('Translating problem', 'Solving model on SolveEngine...',
                   false, SE_CHECK_TIME);
    } else if (jobStatus == "failed") {
      updateStatus('SolveEngine failed solving the problem',
                   'Solving model on SolveEngine...', false, SE_CHECK_TIME);
      throw('SolveEngine failed solving the problem');
    } else if (jobStatus == "started" || jobStatus == "starting") {
      updateStatus('Waiting for the SolveEngine\n' +
                   'Time elapsed: ' + timeElapsed + 'seconds',
                   'Solving model on SolveEngine...',
                   false,
                   SE_CHECK_TIME);
    }
    Utilities.sleep(SE_CHECK_TIME * 1000);
    timeElapsed += SE_CHECK_TIME;
  }
};
