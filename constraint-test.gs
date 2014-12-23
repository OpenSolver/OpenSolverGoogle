// Global namespace for OpenSolver
var OpenSolver = OpenSolver || {};

function constraintTest() {

QUnit.module('constraint');

var LHS = 'A1';
var RHS = 'A2';
var relations = ['GE', 'LE', 'EQ', 'INT', 'BIN', 'ALLDIFF'];
var texts = ['A1 >= A2', 'A1 <= A2', 'A1 == A2', 'A1 int', 'A1 bin', 'A1 alldiff'];
var values = ['A1;3;A2', 'A1;1;A2', 'A1;2;A2', 'A1;4;A2', 'A1;5;A2', 'A1;6;A2'];

QUnit.test('display', relations.length * 2, function(assert) {
  for (var i = 0; i < relations.length; i++) {
    var relation = relations[i];
    var text = texts[i];
    var value = values[i];
    var constraint = new OpenSolver.Constraint(LHS, RHS, OpenSolver.consts.relation[relation]);
    assert.equal(constraint.displayText(), text, 'Text: ' + relation + rightArrow + text);
    assert.equal(constraint.displayValue(), value, 'Value: ' + relation + rightArrow + value);
  }
});

}
