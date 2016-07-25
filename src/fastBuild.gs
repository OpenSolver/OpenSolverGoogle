function myFunction() {
  Logger.log(SpreadsheetApp.getActiveSheet().getRange('B10:D11').getValues());
  validateFormula('=SUMPRODUCT(B8:D8,$B$4:$D$4)', {varNameMap: {B8: 1, C8:2, D8:3}});
  validateFormula('=SUMPRODUCT(B10:D11,B8:D9)');
//  validateFormula('=B8:D8');
  validateFormula('=B8', {varNameMap: {B8: 1}});
//  validateFormula('=SUM(B8,2)');
  validateFormula('=SUM(B8:C8)');
//  validateFormula('=SUM(B8:C8)+2');
}

function validateFormula(formula, varNameMap, values) {
  var coeffs = new IndexedCoeffs();

//  Logger.log(formula);
  tokens = getTokens(formula);

  tokens.moveNext();
  var token = tokens.current();
//  Logger.log(token);
  switch (token.type) {
    case TOK_TYPE_FUNCTION:
      // Check whether it's a supported function
      switch (token.value.toUpperCase()) {
        case 'SUMPRODUCT':
          // Get first SUMPRODUCT arg
          tokens.moveNext();
          token = tokens.current();
          if (token.type !== TOK_TYPE_OPERAND ||
              token.subtype !== TOK_SUBTYPE_RANGE) {
            throw 'First SUMPRODUCT argument is not a range';
          }
          var firstRange = token.value;

          // Make sure there is a second arg
          tokens.moveNext();
          token = tokens.current();
          if (token.type !== TOK_TYPE_ARGUMENT || token.value !== ',') {
            throw 'SUMPRODUCT only has one argument';
          }

          // Get second SUMPRODUCT arg
          tokens.moveNext();
          token = tokens.current();
          if (token.type !== TOK_TYPE_OPERAND ||
              token.subtype !== TOK_SUBTYPE_RANGE) {
            throw 'Second SUMPRODUCT argument is not a range';
          }
          var secondRange = token.value;

          // Make sure no more args
          tokens.moveNext();
          token = tokens.current();
          if (token.type !== TOK_TYPE_FUNCTION ||
              token.subtype !== TOK_SUBTYPE_STOP) {
            throw 'SUMPRODUCT has more than two arguments';
          }
          if (!tokens.EOF()) {
            throw 'Valid SUMPRODUCT but there are other parts to the formula';
          }

          Logger.log(firstRange + ' ' + secondRange)
          var firstResult = checkVarRange(firstRange, varNameMap);
          var secondResult = checkVarRange(secondRange, varNameMap);

          var varIndices;
          var constRange;

          // Check first range for variables
          if (!firstResult.allVars) {
            // The first range is not all variables
            if (firstResult.indices.length > 0) {
              // The first range had some variables but not all were variables.
              // This means the second range being all vars would be nonlinear
              throw 'The first range in the SUMPRODUCT contains a mix of '
                    'adjustable and non-adjustable cells';
            }

            // The second range has to be all variables
            if (!secondResult.allVars) {
              if (secondResult.indices.length > 0) {
                throw 'The second range in the SUMPRODUCT contains a mix of '
                      'adjustable and non-adjustable cells';
              } else {
                throw 'Neither the first nor second range in the SUMPRODUCT '
                      'were all adjustable cells';
              }
            }

            varIndices = secondResult.indices;
            constRange = firstRange;
          } else {
            // The first range is all variables
            // Check that the second range has no variables
            if (secondResult.indices.length > 0) {
              throw 'Both ranges in the SUMPRODUCT contain adjustable cells';
            }

            varIndices = firstResult.indices;
            constRange = secondRange;
          }


          // TODO: Can we actually get this to batch? It seems that calls to
          //       getRange don't batch, so maybe we can getValues on the sheet
          //       and just look up in the sheet?

//          // Set up the data that is needed for later to turn this into vector
//          // Don't do it now so that the getValues() calls can be batched.
//          coeffs = {
//              varIndices: varIndices,
//              constRange: constRange,
//          };
//          break;

          coeffs = processSumProduct(varIndices, constRange, values);
          break;

          // Add the variables to the constraint with the right coeff
          // Vars are expanded in row-major order, so looping over cols inside
          // rows gives the correct order for the indices array.
          var constVals = openSolver.sheet.getRange(constRange).getValues();
          var varIndex = 0;
          for (var row = 0; row < constVals.length; row++) {
            for (var col = 0; col < constVals[row].length; col++) {
              coeffs.add(varIndices[varIndex], constVals[row][col]);
              varIndex++;
            }
          }

          break;

        case 'SUM':
          // Get first SUM arg
          tokens.moveNext();
          token = tokens.current();
          if (token.type !== TOK_TYPE_OPERAND ||
              token.subtype !== TOK_SUBTYPE_RANGE) {
            throw 'SUM argument is not a range';
          }
          var sumRange = token.value;

          // Make sure no more args
          tokens.moveNext();
          token = tokens.current();
          if (token.type !== TOK_TYPE_FUNCTION ||
              token.subtype !== TOK_SUBTYPE_STOP) {
            throw 'SUM has more than one argument';
          }
          if (!tokens.EOF()) {
            throw 'Valid SUM but there are other parts to the formula';
          }

          var result = checkVarRange(sumRange, varNameMap);
          if (!result.allVars) {
            throw 'The SUM range is not all adjustable cells';
          }

          // The constraint has 1's for all cells in the SUM
          var indices = result.indices;
          for (var i = 0; i < indices.length; i++) {
            coeffs.add(indices[i], 1);
          }
          break;

        default:
          throw 'Invalid function: ' + token.value;
          break;
      }
      break;

    case TOK_TYPE_OPERAND:
      // Must be a range
      if (token.subtype !== TOK_SUBTYPE_RANGE) {
        throw 'Formula specifies an operand but it is not a range';
      }

      // Must be a singleton
      // TODO: Is there a better way to check this?
      if (token.value.indexOf(':') > -1) {
        throw 'Formula specifies a range but it is not a singleton';
      }

      // Must be just a range
      if (!tokens.EOF()) {
        throw 'Valid singleton range but there are other parts to the formula';
      }

      var result = checkVarRange(token.value, openSolver);
      if (!result.allVars) {
        throw 'The singleton range is not an adjustable cell';
      }

      // The constraint is just a 1 in the corresponding column
      coeffs.add(result.indices[0], 1);
      break;

    default:
      throw 'Starting token is invalid type: ' + token.type;
      break;
  }

  return coeffs;
}

function checkVarRange(rangeStr, varNameMap) {
  // Checks whether a range is all decision variables
  // Returns list of variable indices if so, otherwise empty list.

  // Get rid of $ in range
  rangeStr = rangeStr.replace(/\$/g, '');
  // Break out any multi-cell range
  var expandedRange = rangeStr.indexOf(':') ? breakOutRanges(rangeStr)
                                            : [rangeStr];
//  Logger.log(expandedRange);

  var indices = [];
  var allVars = true;
  for (var i = 0; i < expandedRange.length; i++) {
    var varIndex = varNameMap[expandedRange[i]];
    if (varIndex === undefined) {
      allVars = false;
    } else {
      indices.push(varIndex);
    }
  }

  return {
    indices: indices,
    allVars: allVars,
  };
}

function processSumProduct(varIndices, constRange, values) {
  Logger.log('Processing SUMPRODUCT: ' + constRange);
  var constCells = constRange.indexOf(':') ? breakOutRanges(constRange)
                                           : [constRange];

  if (varIndices.length !== constCells.length) {
    throw 'SUMPRODUCT argument sizes are mismatched';
  }

  var coeffs = new IndexedCoeffs();
  for (var index = 0; index < constCells.length; index++) {
    var constCell = constCells[index];
    var row = parseInt(constCell.match(/[0-9]+/gi)[0]) - 1;  // Handle 1-index
    var col = fromBase26(constCell.match(/[A-Z]+/gi)[0]);  // Already 0-indexed

    var constValue = values[row][col];
    if (isNumber(constValue) && Math.abs(constValue) > EPSILON) {
      coeffs.add(varIndices[index], constValue);
    }
  }
  return coeffs;
}
