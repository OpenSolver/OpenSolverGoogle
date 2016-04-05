function testConstraint(test) {

var LHS = 'A1';
var RHS = 'A2';
var relations = ['GE', 'LE', 'EQ', 'INT', 'BIN', 'ALLDIFF'];
var texts = ['A1 >= A2', 'A1 <= A2', 'A1 == A2', 'A1 int', 'A1 bin', 'A1 alldiff'];
var values = ['A1;3;A2', 'A1;1;A2', 'A1;2;A2', 'A1;4;A2', 'A1;5;A2', 'A1;6;A2'];

test('display', function(t) {
  for (var i = 0; i < relations.length; i++) {
    var relation = relations[i];
    var text = texts[i];
    var value = values[i];
    var constraint = new Constraint(LHS, RHS, Relation[relation]);
    t.equal(constraint.displayText(), text, 'Text: ' + relation + rightArrow + text);
    t.equal(constraint.displayValue(), value, 'Value: ' + relation + rightArrow + value);
  }
});

}
