/**
 * Save utility functions.
 */

// Save types - ways to encode local variables. I suppose this could also be
// done by actually inspecting the values, but whatever.
var NUMERIC_ARRAY = {
	encode: encodeNumericArray,
	decode: decodeNumericArray
}, BOOLEAN_ARRAY = {
	encode: encodeBooleanArray,
	decode: decodeBooleanArray
}, NUMBER = {
	encode: encodeNumber,
	decode: decodeNumber
}, BOOLEAN = {
	encode: encodeBoolean,
	decode: decodeBoolean
};

/**
 * A list of variables and how to save them.
 */
Adventure.SAVE_STATE = {
	abb: NUMERIC_ARRAY,
	abbnum: NUMBER,
	atloc: NUMERIC_ARRAY,
	bonus: NUMBER,
	clock1: NUMBER,
	clock2: NUMBER,
	closed: BOOLEAN,
	closng: BOOLEAN,
	detail: NUMBER,
	fixed: NUMERIC_ARRAY,
	_itemProps: NUMERIC_ARRAY,
	link: NUMERIC_ARRAY,
	obj: NUMBER,
	oldloc: NUMBER,
	place: NUMERIC_ARRAY,
	wzdark: BOOLEAN,
	limit: NUMBER,
	tally: NUMBER,
	tally2: NUMBER,
	hinted: BOOLEAN_ARRAY,
	hintlc: NUMERIC_ARRAY,
	dflag: NUMBER,
	dkill: NUMBER,
	dloc: NUMERIC_ARRAY,
	dseen: BOOLEAN_ARRAY,
	odloc: NUMERIC_ARRAY,
	turns: NUMBER,
	lmwarn: BOOLEAN,
	iwest: NUMBER,
	knfloc: NUMBER,
	detail: NUMBER,
	numdie: NUMBER,
	holdng: NUMBER,
	foobar: NUMBER,
	panic: BOOLEAN,
	gaveup: BOOLEAN,
	wizard: BOOLEAN,
	loc: NUMBER
};
// Go through the save states and create "short" names for them.
var d = 0;
for (var v in Adventure.SAVE_STATE) {
	Adventure.SAVE_STATE[v] = [ Adventure.SAVE_STATE[v], encodeDigit(d++) ];
}
// And throw in the special version marker.
Adventure.SAVE_STATE['version'] = [ {
	encode: function(i) { return 0; },
	decode: function(v) { if (v != '0') { throw Error("Bad save version"); } }
}, '_' ];

/**
 * Run-length encode an array. Requires all values be strings, numbers, booleans,
 * or null. (Not checked and not enforced.)
 */
function runLengthEncode(a) {
	if (a.length == 0) {
		return a;
	}
	// First we run-length-encode the array...
	var rv = [];
	var currentValue = a[0];
	var currentRun = 1;
	function appendResult() {
		if (currentRun == 1) {
			rv.push(currentValue);
			return;
		}
		if (currentRun == 2) {
			// Special case: we may or may not decide to RLE this. If the
			// string form is shorter than three characters, we don't.
			if (currentValue != null && currentValue.toString().length < 3) {
				rv.push(currentValue,currentValue);
				return;
			}
			// Otherwise, fall through and push the run
		}
		rv.push([currentRun,currentValue]);
	}
	for (var i = 1; i < a.length; i++) {
		if (a[i] == currentValue) {
			currentRun++;
		} else {
			appendResult();
			currentRun = 1;
			currentValue = a[i];
		}
	}
	appendResult();
	return rv;
}

/**
 * Encodes a numeric array into a string.
 */
function encodeNumericArray(array) {
	// First, go through the array and see what the max value is. If the range
	// is 0-61, we can use single-character encoding. If it's 0-3844, we can use
	// two-character encoding.
	var min = Math.min.apply(null,array);
	var max = Math.max.apply(null,array);
	var bump = min < 0 ? -min : 0;
	max += bump;
	// Next, through it through the RLE-er
	array = runLengthEncode(array);
	var rv = [];
	if (max < 62) {
		if (bump > 0) {
			rv.push('-');
			rv.push(encodeDigit(bump));
		}
		// Use single-character encoding (don't prepend anything)
		for (var i = 0; i < array.length; i++) {
			var v = array[i];
			if (v.push) {
				// Is a run
				rv.push('.');
				rv.push(encodeLargeDigit(v[0]));
				v = v[1];
			}
			rv.push(encodeDigit(v+bump));
		}
	} else {
		if (bump > 0) {
			rv.push('-');
			rv.push(encodeDigit(bump));
		}
		rv.push('_');
		for (var i = 0; i < array.length; i++) {
			var v = array[i];
			if (v.push) {
				// Is a run
				rv.push('.');
				rv.push(encodeLargeDigit(v[0]));
				v = v[1];
			}
			v += bump;
			var high = Math.floor(v/62);
			var low = v%62;
			rv.push(encodeDigit(high), encodeDigit(low));
		}
	}
	return rv.join('');
}

function decodeNumericArray(str) {
	// Peak at the first character, see if we have a bump
	var bump = 0;
	if (str.charAt(0) == '-') {
		// Read the bump value
		bump = decodeDigit(str.charAt(1));
		// And chop this part off the string
		str = str.substr(2);
	}
	var arr = [], i = 0, c, v, r, codeLen = 1, decode = decodeDigit;
	// Look at the first character again, see if we're in "big digit" mode
	if (str.charAt(0) == '_') {
		// "Big digit" encoding.
		decode = decodeLargeDigit;
		codeLen = 2;
		i++;
	}
	for (; i < str.length; i+=codeLen) {
		// First see if this is a run
		if (str.charAt(i) == '.') {
			// Is a run, decode run length:
			r = decodeLargeDigit(str.substr(++i,2));
			// And advance past the run length characters, and proceed as
			// normal to decode the next digit
			i+=2;
		} else {
			r = 1;
		}
		v = decode(str.substr(i,codeLen)) - bump;
		// And add to the array
		for (; r > 0; r--) {
			arr.push(v);
		}
	}
	return arr;
}

function runLengthDecode(a) {
	var rv = [];
	for (var i = 0; i < a.length; i++) {
		var v = a[i];
		if (typeof v.push == 'function') {
			// Decode run
			for (var j = 0; j < v[0]; j++) {
				rv.push(v[1]);
			}
		} else {
			rv.push(v);
		}
	}
	return rv;
}

function encodeLargeDigit(v) {
	var high = Math.floor(v/62);
	var low = v%62;
	return encodeDigit(high) + encodeDigit(low);
}

function encodeDigit(d) {
	if (d < 10) {
		return String.fromCharCode(0x30+d);
	} else if (d < 36) {
		return String.fromCharCode(0x41-10+d);
	} else if (d < 62) {
		return String.fromCharCode(0x61-36+d);
	} else {
		return "!" + d + "!";
		//throw Error("Value " + d + " is out of range.");
	}
}

function decodeDigit(c) {
	c = c.charCodeAt(0);
	if (c >= 0x61) {
		return c - 0x61 + 36;
	} else if (c >= 0x41) {
		return c - 0x41 + 10;
	} else {
		return c - 0x30;
	}
}

function decodeLargeDigit(s) {
	return decodeDigit(s.charAt(0)) * 62 + decodeDigit(s.charAt(1));
}

function encodeNumber(n) {
	if (n < 62) {
		return encodeDigit(n);
	} else {
		return encodeLargeDigit(n);
	}
}

function decodeNumber(s) {
	if (s.length == 1)
		return decodeDigit(s);
	else if (s.length == 2)
		return decodeLargeDigit(s);
	else
		throw Error("Cannot decode \"" + s + "\"");
}

function encodeBooleanArray(array) {
	// Again, RLE this first...
	array = runLengthEncode(array);
	// And then go ahead and encode the entire thing
	var rv = [];
	for (var i = 0; i < array.length; i++) {
		var v = array[i];
		if (v === true) {
			rv.push('.');
		} else if (v === false) {
			rv.push('-');
		} else {
			rv.push(encodeDigit(v[0]), encodeBoolean(v[1]));
		}
	}
	return rv.join('');
}

function encodeBoolean(v) {
	return v ? '.' : '_';
}
function decodeBoolean(c) {
	return (c == '.' ? true : (c == '_' ? false : null));
}

function decodeBooleanArray(str) {
	var arr = [], i, c, v, r;
	// Go through the string
	for (i = 0; i < str.length; i++) {
		c = str.charAt(i);
		v = decodeBoolean(c);
		if (v === null) {
			// Note that we preincrement i to get the next character, so on the
			// next loop we're looking at the correct character.
			v = decodeBoolean(str.charAt(++i));
			for (r = decodeDigit(c); r > 0; r--) {
				arr.push(v);
			}
		} else {
			arr.push(v);
		}
	}
	return arr;
}
