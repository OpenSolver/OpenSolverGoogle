/*
 * Adapted from excelFormulaUtilitiesJS (MIT license)
 * Copyright 2011, Josh Bennett
 * https://github.com/joshatjben/excelFormulaUtilitiesJS/
 */


var TOK_TYPE_NOOP         = 'noop';
var TOK_TYPE_OPERAND      = 'operand';
var TOK_TYPE_FUNCTION     = 'function';
var TOK_TYPE_SUBEXPR      = 'subexpression';
var TOK_TYPE_ARGUMENT     = 'argument';
var TOK_TYPE_OP_PRE       = 'operator-prefix';
var TOK_TYPE_OP_IN        = 'operator-infix';
var TOK_TYPE_OP_POST      = 'operator-postfix';
var TOK_TYPE_WSPACE       = 'white-space';
var TOK_TYPE_UNKNOWN      = 'unknown';

var TOK_SUBTYPE_START     = 'start';
var TOK_SUBTYPE_STOP      = 'stop';

var TOK_SUBTYPE_TEXT      = 'text';
var TOK_SUBTYPE_NUMBER    = 'number';
var TOK_SUBTYPE_LOGICAL   = 'logical';
var TOK_SUBTYPE_ERROR     = 'error';
var TOK_SUBTYPE_RANGE     = 'range';

var TOK_SUBTYPE_MATH      = 'math';
var TOK_SUBTYPE_CONCAT    = 'concatenate';
var TOK_SUBTYPE_INTERSECT = 'intersect';
var TOK_SUBTYPE_UNION     = 'union';


// TODO use locale
var isEu = false;

// Individual token
function F_token(value, type, subtype) {
  this.value = value;
  this.type = type;
  this.subtype = subtype;
}

// List of tokens
function F_tokens() {
  this.items = [];
  this.index = -1;

  this.add = function(value, type, subtype) {
    if (!subtype) {
      subtype = '';
    }
    var token = new F_token(value, type, subtype);
    this.addRef(token);
    return token;
  };
  this.addRef = function(token) {
    this.items.push(token);
  };

  this.reset = function() {
    this.index = -1;
  };
  this.BOF = function() {
    return (this.index <= 0);
  };
  this.EOF = function() {
    return (this.index >= (this.items.length - 1));
  };
  this.moveNext = function() {
    if (this.EOF()) {
      return false;
    }
    this.index += 1;
    return true;
  };
  this.current = function() {
    if (this.index === -1) {
      return null;
    }
    return this.items[this.index];
  };
  this.next = function() {
    if (this.EOF()) {
      return null;
    }
    return this.items[this.index + 1];
  };
  this.previous = function() {
    if (this.index < 1) {
      return null;
    }
    return this.items[this.index - 1];
  };

}

// Stack for managing tokens
function F_tokenStack() {
  this.items = [];

  this.push = function(token) {
    this.items.push(token);
  };
  this.pop = function(name) {
    var token = this.items.pop();
    return new F_token(name || '', token.type, TOK_SUBTYPE_STOP);
  };

  this.token = function() {
    return (this.items.length > 0) ? this.items[this.items.length - 1] : null;
  };
  this.value = function() {
    return (this.token()) ? this.token().value.toString() : '';
  };
  this.type = function() {
    return (this.token()) ? this.token().type.toString() : '';
  };
  this.subtype = function() {
    return (this.token()) ? this.token().subtype.toString() : '';
  };

}

function getTokens(formula) {

  var tokens = new F_tokens();
  var tokenStack = new F_tokenStack();

  var offset = 0;

  var currentChar = function() {
    return formula.substr(offset, 1);
  };
  var doubleChar = function() {
    return formula.substr(offset, 2);
  };
  var nextChar = function() {
    return formula.substr(offset + 1, 1);
  };
  var EOF = function() {
    return (offset >= formula.length);
  };

  var token = '';

  var inString = false;
  var inPath = false;
  var inRange = false;
  var inError = false;
  var regexSN = /^[1-9]{1}(\.[0-9]+)?E{1}$/;

  // Trim any leading spaces and =
  while (formula.length > 0) {
    if (formula.substr(0, 1) === ' ') {
      formula = formula.substr(1);
    } else {
      if (formula.substr(0, 1) === '=') {
        formula = formula.substr(1);
      }
      break;
    }
  }



  while (!EOF()) {
    // state-dependent character evaluation (order is important)

    // Look for double-quoted strings
    // Any embedded double-quotes are doubled
    // A single double-quote marks end of token
    if (inString) {
      if (currentChar() === '"') {
        if (nextChar() === '"') {
          token += '"';
          offset += 1;
        } else {
          inString = false;
          tokens.add(token, TOK_TYPE_OPERAND, TOK_SUBTYPE_TEXT);
          token = '';
        }
      } else {
        token += currentChar();
      }
      offset += 1;
      continue;
    }

    // Look for single-quoted strings (links)
    // Any embedded single-quotes are doubled
    // A single single-quote does not mark end of token
    if (inPath) {
      if (currentChar() === '\'') {

        if (nextChar() === '\'') {
          token += '\'';
          offset += 1;
        } else {
          inPath = false;
          token += '\'';
        }
      } else {
        token += currentChar();
      }

      offset += 1;
      continue;
    }

    // Look for bracketed strings (range offset or linked workbook name)
    // No embedded brackets (changed to "()" by Excel)
    // End does not mark end of token
    if (inRange) {
      if (currentChar() === ']') {
        inRange = false;
      }
      token += currentChar();
      offset += 1;
      continue;
    }

    // Error values
    // End marks a token, determined from absolute list of values
    if (inError) {
      token += currentChar();
      offset += 1;
      if ((',#NULL!,#DIV/0!,#VALUE!,#REF!,#NAME?,#NUM!,#N/A,').indexOf(',' + token + ',') !== -1) {
        inError = false;
        tokens.add(token, TOK_TYPE_OPERAND, TOK_SUBTYPE_ERROR);
        token = '';
      }
      continue;
    }

    // Scientific notation check
    if (('+-').indexOf(currentChar()) !== -1) {
      if (token.length > 1) {
        if (token.match(regexSN)) {
          token += currentChar();
          offset += 1;
          continue;
        }
      }
    }

    // Independent character evaluation (order not important)

    // establish state-dependent character evaluations
    if (currentChar() === '"') {
      if (token.length > 0) {
        // not expected
        tokens.add(token, TOK_TYPE_UNKNOWN);
        token = '';
      }
      inString = true;
      offset += 1;
      continue;
    }

    if (currentChar() === '\'') {
      if (token.length > 0) {
        // not expected
        tokens.add(token, TOK_TYPE_UNKNOWN);
        token = "";
      }
      token = '\''
      inPath = true;
      offset += 1;
      continue;
    }

    if (currentChar() === '[') {
      inRange = true;
      token += currentChar();
      offset += 1;
      continue;
    }

    if (currentChar() === '#') {
      if (token.length > 0) {
        // not expected
        tokens.add(token, TOK_TYPE_UNKNOWN);
        token = '';
      }
      inError = true;
      token += currentChar();
      offset += 1;
      continue;
    }

    // mark start and end of arrays and array rows
    if (currentChar() === '{') {
      if (token.length > 0) {
        // not expected
        tokens.add(token, TOK_TYPE_UNKNOWN);
        token = '';
      }
      tokenStack.push(tokens.add('ARRAY', TOK_TYPE_FUNCTION, TOK_SUBTYPE_START));
      tokenStack.push(tokens.add('ARRAYROW', TOK_TYPE_FUNCTION, TOK_SUBTYPE_START));
      offset += 1;
      continue;
    }

    if (currentChar() === ';' ) {
      if (isEu){
        // If is EU then handle ; as list seperators
        if (token.length > 0) {
          tokens.add(token, TOK_TYPE_OPERAND);
          token = '';
        }
        if (tokenStack.type() !== TOK_TYPE_FUNCTION) {
          tokens.add(currentChar(), TOK_TYPE_OP_IN, TOK_SUBTYPE_UNION);
        } else {
          tokens.add(currentChar(), TOK_TYPE_ARGUMENT);
        }
        offset += 1;
        continue;
      } else {
        // Else if not Eu handle ; as array row seperator
        if (token.length > 0) {
          tokens.add(token, TOK_TYPE_OPERAND);
          token = '';
        }
        tokens.addRef(tokenStack.pop());
        tokens.add(',', TOK_TYPE_ARGUMENT);
        tokenStack.push(tokens.add('ARRAYROW', TOK_TYPE_FUNCTION, TOK_SUBTYPE_START));
        offset += 1;
        continue;
      }
    }

    if (currentChar() === '}') {
      if (token.length > 0) {
        tokens.add(token, TOK_TYPE_OPERAND);
        token = '';
      }
      tokens.addRef(tokenStack.pop('ARRAYROWSTOP'));
      tokens.addRef(tokenStack.pop('ARRAYSTOP'));
      offset += 1;
      continue;
    }

    // trim white-space
    if (currentChar() === ' ') {
      if (token.length > 0) {
        tokens.add(token, TOK_TYPE_OPERAND);
        token = '';
      }
      tokens.add('', TOK_TYPE_WSPACE);
      offset += 1;
      while ((currentChar() === ' ') && (!EOF())) {
        offset += 1;
      }
      continue;
    }

    // multi-character comparators
    if ((',>=,<=,<>,').indexOf(',' + doubleChar() + ',') !== -1) {
      if (token.length > 0) {
        tokens.add(token, TOK_TYPE_OPERAND);
        token = '';
      }
      tokens.add(doubleChar(), TOK_TYPE_OP_IN, TOK_SUBTYPE_LOGICAL);
      offset += 2;
      continue;
    }

    // standard infix operators
    if (('+-*/^&=><').indexOf(currentChar()) !== -1) {
      if (token.length > 0) {
        tokens.add(token, TOK_TYPE_OPERAND);
        token = '';
      }
      tokens.add(currentChar(), TOK_TYPE_OP_IN);
      offset += 1;
      continue;
    }

    // standard postfix operators
    if (('%').indexOf(currentChar()) !== -1) {
      if (token.length > 0) {
        tokens.add(token, TOK_TYPE_OPERAND);
        token = '';
      }
      tokens.add(currentChar(), TOK_TYPE_OP_POST);
      offset += 1;
      continue;
    }

    // start subexpression or function
    if (currentChar() === '(') {
      if (token.length > 0) {
        tokenStack.push(tokens.add(token, TOK_TYPE_FUNCTION, TOK_SUBTYPE_START));
        token = '';
      } else {
        tokenStack.push(tokens.add('', TOK_TYPE_SUBEXPR, TOK_SUBTYPE_START));
      }
      offset += 1;
      continue;
    }

    // function, subexpression, array parameters
    if (currentChar() === ',' && !isEu) {
      if (token.length > 0) {
        tokens.add(token, TOK_TYPE_OPERAND);
        token = '';
      }
      if (tokenStack.type() !== TOK_TYPE_FUNCTION) {
        tokens.add(currentChar(), TOK_TYPE_OP_IN, TOK_SUBTYPE_UNION);
      } else {
        tokens.add(currentChar(), TOK_TYPE_ARGUMENT);
      }
      offset += 1;
      continue;
    }

    // stop subexpression
    if (currentChar() === ')') {
      if (token.length > 0) {
        tokens.add(token, TOK_TYPE_OPERAND);
        token = '';
      }
      tokens.addRef(tokenStack.pop());
      offset += 1;
      continue;
    }

    // token accumulation
    token += currentChar();
    offset += 1;

  }

  // dump remaining accumulation
  if (token.length > 0) {
    tokens.add(token, TOK_TYPE_OPERAND);
  }

  // move all tokens to a new collection, excluding all unnecessary white-space tokens
  var tokens2 = new F_tokens();

  while (tokens.moveNext()) {

    token = tokens.current();

    if (token.type.toString() === TOK_TYPE_WSPACE) {
      var doAddToken = (tokens.BOF()) || (tokens.EOF());
      doAddToken = doAddToken && (((tokens.previous().type.toString() === TOK_TYPE_FUNCTION) && (tokens.previous().subtype.toString() === TOK_SUBTYPE_STOP)) || ((tokens.previous().type.toString() === TOK_TYPE_SUBEXPR) && (tokens.previous().subtype.toString() === TOK_SUBTYPE_STOP)) || (tokens.previous().type.toString() === TOK_TYPE_OPERAND));
      doAddToken = doAddToken && (((tokens.next().type.toString() === TOK_TYPE_FUNCTION) && (tokens.next().subtype.toString() === TOK_SUBTYPE_START)) || ((tokens.next().type.toString() === TOK_TYPE_SUBEXPR) && (tokens.next().subtype.toString() === TOK_SUBTYPE_START)) || (tokens.next().type.toString() === TOK_TYPE_OPERAND));
      if (doAddToken) {
        tokens2.add(token.value.toString(), TOK_TYPE_OP_IN, TOK_SUBTYPE_INTERSECT);
      }
      continue;
    }

    tokens2.addRef(token);

  }

  // switch infix "-" operator to prefix when appropriate, switch infix "+" operator to noop when appropriate, identify operand
  // and infix-operator subtypes, pull "@" from in front of function names
  while (tokens2.moveNext()) {

    token = tokens2.current();

    if ((token.type.toString() === TOK_TYPE_OP_IN) && (token.value.toString() === '-')) {
      if (tokens2.BOF()) {
        token.type = TOK_TYPE_OP_PRE.toString();
      } else if (((tokens2.previous().type.toString() === TOK_TYPE_FUNCTION) && (tokens2.previous().subtype.toString() === TOK_SUBTYPE_STOP)) || ((tokens2.previous().type.toString() === TOK_TYPE_SUBEXPR) && (tokens2.previous().subtype.toString() === TOK_SUBTYPE_STOP)) || (tokens2.previous().type.toString() === TOK_TYPE_OP_POST) || (tokens2.previous().type.toString() === TOK_TYPE_OPERAND)) {
        token.subtype = TOK_SUBTYPE_MATH.toString();
      } else {
        token.type = TOK_TYPE_OP_PRE.toString();
      }
      continue;
    }

    if ((token.type.toString() === TOK_TYPE_OP_IN) && (token.value.toString() === '+')) {
      if (tokens2.BOF()) {
        token.type = TOK_TYPE_NOOP.toString();
      } else if (((tokens2.previous().type.toString() === TOK_TYPE_FUNCTION) && (tokens2.previous().subtype.toString() === TOK_SUBTYPE_STOP)) || ((tokens2.previous().type.toString() === TOK_TYPE_SUBEXPR) && (tokens2.previous().subtype.toString() === TOK_SUBTYPE_STOP)) || (tokens2.previous().type.toString() === TOK_TYPE_OP_POST) || (tokens2.previous().type.toString() === TOK_TYPE_OPERAND)) {
        token.subtype = TOK_SUBTYPE_MATH.toString();
      } else {
        token.type = TOK_TYPE_NOOP.toString();
      }
      continue;
    }

    if ((token.type.toString() === TOK_TYPE_OP_IN) && (token.subtype.length === 0)) {
      if (('<>=').indexOf(token.value.substr(0, 1)) !== -1) {
        token.subtype = TOK_SUBTYPE_LOGICAL.toString();
      } else if (token.value.toString() === '&') {
        token.subtype = TOK_SUBTYPE_CONCAT.toString();
      } else {
        token.subtype = TOK_SUBTYPE_MATH.toString();
      }
      continue;
    }

    if ((token.type.toString() === TOK_TYPE_OPERAND) && (token.subtype.length === 0)) {
      if (isNaN(parseFloat(token.value))) {
        if ((token.value.toString() === 'TRUE') || (token.value.toString() === 'FALSE')) {
          token.subtype = TOK_SUBTYPE_LOGICAL.toString();
        } else {
          token.subtype = TOK_SUBTYPE_RANGE.toString();
        }
      } else {
        token.subtype = TOK_SUBTYPE_NUMBER.toString();
      }

      continue;
    }

    if (token.type.toString() === TOK_TYPE_FUNCTION) {
      if (token.value.substr(0, 1) === '@') {
        token.value = token.value.substr(1).toString();
      }
      continue;
    }

  }

  tokens2.reset();

  // move all tokens to a new collection, excluding all noops
  tokens = new F_tokens();

  while (tokens2.moveNext()) {
    if (tokens2.current().type.toString() !== TOK_TYPE_NOOP) {
      tokens.addRef(tokens2.current());
    }
  }

  tokens.reset();

  return tokens;
}

// Pass a range such as A1:B2 along with a
// delimiter to get back a full list of ranges.
//
// Example:
//    breakOutRanges("A1:B2", "+"); //Returns A1+A2+B1+B2
function breakOutRanges(rangeStr){

  //Quick Check to see if if rangeStr is a valid range
  if ( !RegExp("[a-z]+[0-9]+:[a-z]+[0-9]+","gi").test(rangeStr) ){
    throw "This is not a valid range: " + rangeStr;
  }

  //Make the rangeStr lowercase to deal with looping.
  var range = rangeStr.split(":");

  var startRow = parseInt(range[0].match(/[0-9]+/gi)[0]);
  var startCol = range[0].match(/[A-Z]+/gi)[0];
  var startColDec = fromBase26(startCol);

  var endRow =  parseInt(range[1].match(/[0-9]+/gi)[0]);
  var endCol = range[1].match(/[A-Z]+/gi)[0];
  var endColDec = fromBase26(endCol);

  // Total rows and cols
  var totalRows = endRow - startRow + 1;
  var totalCols = fromBase26(endCol) - fromBase26(startCol) + 1;

  var cells = [];

  for (var curRow = 1; curRow <= totalRows; curRow++) {
    for (var curCol = 0; curCol < totalCols; curCol++) {
      cells.push(toBase26(startColDec + curCol) + '' + (startRow + curRow - 1));
    }
  }

  return cells;
}

//Modified from function at http://en.wikipedia.org/wiki/Hexavigesimal
var toBase26 = function(value) {

  value = Math.abs(value);

  var converted = '';
  var iteration = false;
  var remainder;

  // Repeatedly divide the number by 26 and convert the
  // remainder into the appropriate letter.
  do {
    remainder = value % 26;

    // Compensate for the last letter of the series being corrected on 2 or more iterations.
    if (iteration && value < 25) {
      remainder--;
    }

    converted = String.fromCharCode((remainder + 'A'.charCodeAt(0))) + converted;
    value = Math.floor((value - remainder) / 26);

    iteration = true;
  } while (value > 0);

  return converted;
}

// This was Modified from a function at http://en.wikipedia.org/wiki/Hexavigesimal
// Pass in the base 26 string, get back integer
var fromBase26 = function(number) {
  number = number.toUpperCase();

  var s = 0;
  var i = 0;
  var dec = 0;

  if (number !== null && typeof number !== 'undefined' && number.length > 0) {
    for (; i < number.length; i++) {
      s = number.charCodeAt(number.length - i - 1) - 'A'.charCodeAt(0);
      dec += (Math.pow(26, i)) * (s+1);
    }
  }

  return dec - 1;
}



