IndexedCoeffs = function() {
  this.indices = [];
  this.values = [];
};

IndexedCoeffs.prototype.add = function(index, value) {
  this.indices.push(index);
  this.values.push(value);
};

IndexedCoeffs.prototype.index = function(i) {
  return this.indices[i];
};

IndexedCoeffs.prototype.coeff = function(i) {
  return this.values[i];
};

IndexedCoeffs.prototype.count = function() {
  return this.indices.length;
};

IndexedCoeffs.prototype.evaluate = function(varValues) {
  var maxValue = 0;
  var total = 0;
  for (var i = 0; i < this.count(); i++) {
    var coeff = this.coeff(i);
    var value = varValues[this.index(i)];
    total += coeff * value;
    maxValue = Math.max(maxValue,
                        Math.abs(value),
                        Math.abs(coeff), Math.abs(total));
  }
  return { value: total, max: maxValue };
};

IndexedCoeffs.prototype.loadFromCache = function(data) {
  var keys = Object.keys(data);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    this[key] = data[key];
  }
  return this;
};
