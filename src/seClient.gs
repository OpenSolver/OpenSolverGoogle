var SE_SERVER = "https://solve.satalia.com/api/v1alpha";

SolveEngineClient = function(authToken) {
  if (!authToken || authToken == "") {
    return null;
  }
  this.authToken = authToken;
  this.jobId = "";
  this.fileName = "openSolverProblem.mod";
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
    files: [
      { name: this.fileName }
    ]
  };

  var options = {
    method: "post",
    headers: {
      Authorization: "Bearer " + this.authToken,
    },
    payload: JSON.stringify(payload)
  };

  return this.doRequest("/jobs",  options);
}

SolveEngineClient.prototype.submitData = function(problem) {
  var blob = Utilities.newBlob(problem, "multipart/form-data");
  var options = {
    method: "put",
    headers: {
      Authorization: "Bearer " + this.authToken,
    },
    payload: {
     "file": blob.getAs("multipart/form-data")
    }
  };

  return this.doRequest("/jobs/" + this.jobId + "/files/" + this.fileName,
                        options);
}

SolveEngineClient.prototype.startJob = function() {
  var options = {
    method: "post",
    headers: {
      Authorization: "Bearer " + this.authToken,
    },
  };

  return this.doRequest("/jobs/" + this.jobId + "/start", options);
}

SolveEngineClient.prototype.getStatus = function() {
  var options = {
    method: "get",
    headers: {
      Authorization: "Bearer " + this.authToken,
    },
  };

  return this.doRequest("/jobs/" + this.jobId + "/status", options);
}

SolveEngineClient.prototype.getResults = function() {
  var options = {
    method: "get",
    headers: {
      Authorization: "Bearer " + this.authToken,
    },
  };

  return this.doRequest("/jobs/" + this.jobId + "/solution", options);
}
