var SE_SERVER = "https://solve.satalia.com/api/v2";
var TRACKING_ID = "bcf35f79de08ecaba1c470f31fca5ea97be72c37";
SolveEngineClient = function(authToken) {
  if (!authToken || authToken == "") {
    return null;
  }
  this.authToken = authToken;
  this.jobId = "";
  this.fileName = "openSolverProblem.mod";
  return this;
};

SolveEngineClient.prototype.makeHeaders = function() {
  return {
    'Authorization': "api-key " + this.authToken,
    'X-tracking-id': TRACKING_ID,
  };
};

SolveEngineClient.prototype.loadFromCache = function(data) {
  var keys = data ? Object.keys(data) : [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    this[key] = data[key];
  }

  // Make sure we only load a valid client
  if (!this.authToken || this.authToken == "") {
    return null;
  }

  return this;
};

SolveEngineClient.prototype.hashProblem = function(problem) {
  return Utilities.base64Encode(problem);
}

SolveEngineClient.prototype.doRequest = function(url, options) {
  options.muteHttpExceptions = true;
  resp = UrlFetchApp.fetch(SE_SERVER + url, options);
  return {
    message: resp.getContentText(),
    code: resp.getResponseCode()
  }
}

SolveEngineClient.prototype.createJob = function(problem) {
  var payload = {
    options: {
      translate: "lp"
    },
    problems: [
      {
        name: this.fileName,
        data: this.hashProblem(problem),
      }
    ]
  };

  var options = {
    method: "post",
    headers: this.makeHeaders(),
    payload: JSON.stringify(payload)
  };

  return this.doRequest("/jobs",  options);
}

SolveEngineClient.prototype.startJob = function() {
  var options = {
    method: "post",
    headers: this.makeHeaders(),
  };

  return this.doRequest("/jobs/" + this.jobId + "/schedule", options);
}

/*
Possible statuses:
- queued: the job has been created, but not started
- translating: the problem is being translated between formats
- started: the problem is being solved
- starting
- completed: the problem has been solved
- failed: failed to solve the problem
- stopped: the problem solving has been stopped by the user
- timeout: the job has timed out
*/
SolveEngineClient.prototype.getStatus = function() {
  var options = {
    method: "get",
    headers: this.makeHeaders(),
  };

  return this.doRequest("/jobs/" + this.jobId + "/status", options);
}

SolveEngineClient.prototype.getResults = function() {
  var options = {
    method: "get",
    headers: this.makeHeaders(),
  };

  return this.doRequest("/jobs/" + this.jobId + "/results", options);
}
