var leftArrow = ' \u2190 ';
var rightArrow = ' \u2192 ';
var tick = ' \u2714';

var TOL = 1e-6;

function testRunner() {
//  if ((typeof GasTap)==='undefined') { // GasT Initialization. (only if not initialized yet.)
//    eval(UrlFetchApp.fetch('https://raw.githubusercontent.com/zixia/gast/master/src/gas-tap-lib.js').getContentText())
//  } // Class GasTap is ready for use now!

  var test = new GasTap()

  test('array', function(t) {
    t.deepEqual(
      [0],
      [0]
    )
  });

  testUtil(test);
  testSolverGoogle(test);
  testConstraint(test);
  testMockRange(test);

  test.finish();
}
