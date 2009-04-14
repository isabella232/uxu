// -*- indent-tabs-mode: t; tab-width: 4 -*-

var lib = new ModuleManager(['chrome://uxu/content/lib']);
var SequenceMatcher = lib.require('class', 'sequenceMatcher');

function constructor(aFrom, aTo)
{
    this.from = aFrom;
    this.to = aTo;
}

function diff(aEncoded)
{
    var result = [];
    var matcher = new SequenceMatcher(this.from, this.to);

    var _this = this;
    matcher.operations().forEach(function (aOperation) {
		var tag = aOperation[0];
		var fromStart = aOperation[1];
		var fromEnd = aOperation[2];
		var toStart = aOperation[3];
		var toEnd = aOperation[4];
		var target;

		switch (tag) {
			case "replace":
				target = _this._diffLines(fromStart, fromEnd, toStart, toEnd, aEncoded);
				result = result.concat(target);
				break;
			case "delete":
				target = _this.from.slice(fromStart, fromEnd);
				result = result.concat(_this._tagDeleted(target, aEncoded));
				break;
			case "insert":
				target = _this.to.slice(toStart, toEnd);
				result = result.concat(_this._tagInserted(target, aEncoded));
				break;
			case "equal":
				target = _this.from.slice(fromStart, fromEnd);
				result = result.concat(_this._tagEqual(target, aEncoded));
				break;
			default:
				throw "unknown tag: " + tag;
				break;
		}
	});

	return result;
}

function _tag(aMark, aContents, aEncodedClass)
{
	if (aEncodedClass) {
		aMark = '<span class="tag">'+aMark+'</span>';
		return aContents.map(function (aContent) {
			return '<span class="tagged line '+aEncodedClass+'">'+
					aMark+
					' '+
					_escapeForEncoded(aContent)+
					'</span>';
		});
	}
	else {
		return aContents.map(function (aContent) {
			return aMark + ' ' + aContent;
		});
	}
}

function _escapeForEncoded(aString)
{
	return aString
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
}

function _tagDeleted(aContents, aEncoded)
{
	return this._tag('-', aContents, (aEncoded ? 'deleted' : '' ));
}

function _tagInserted(aContents, aEncoded)
{
	return this._tag('+', aContents, (aEncoded ? 'inserted' : '' ));
}

function _tagEqual(aContents, aEncoded)
{
	return this._tag(' ', aContents, (aEncoded ? 'equal' : '' ));
}

function _tagDifference(aContents, aEncoded)
{
	return this._tag('?', aContents, (aEncoded ? 'difference' : '' ));
}

function _findDiffLineInfo(aFromStart, aFromEnd, aToStart, aToEnd)
{
	var bestRatio = 0.74;
	var fromEqualIndex, toEqualIndex;
	var fromBestIndex, toBestIndex;
	var toIndex;

	for (toIndex = aToStart; toIndex < aToEnd; toIndex++) {
		var fromIndex;
		for (fromIndex = aFromStart; fromIndex < aFromEnd; fromIndex++) {
			var matcher;

			if (this.from[fromIndex] == this.to[toIndex]) {
				if (fromEqualIndex === undefined)
					fromEqualIndex = fromIndex;
				if (toEqualIndex === undefined)
					toEqualIndex = toIndex;
				continue;
			}

			matcher = new SequenceMatcher(this.from[fromIndex],
										  this.to[toIndex],
										  this._isSpaceCharacter);
			if (matcher.ratio() > bestRatio) {
                bestRatio = matcher.ratio();
                fromBestIndex = fromIndex;
                toBestIndex = toIndex;
			}
		}
	}

	return [bestRatio,
			fromEqualIndex, toEqualIndex,
			fromBestIndex, toBestIndex];
}

function _diffLines(aFromStart, aFromEnd, aToStart, aToEnd, aEncoded)
{
	var cutOff = 0.75;
	var info = this._findDiffLineInfo(aFromStart, aFromEnd, aToStart, aToEnd);
	var bestRatio = info[0];
	var fromEqualIndex = info[1];
	var toEqualIndex = info[2];
	var fromBestIndex = info[3];
	var toBestIndex = info[4];

	if (bestRatio < cutOff) {
		if (fromEqualIndex === undefined) {
			var taggedFrom, taggedTo;

			taggedFrom = this._tagDeleted(this.from.slice(aFromStart, aFromEnd), aEncoded);
			taggedTo = this._tagInserted(this.to.slice(aToStart, aToEnd), aEncoded);
			if (aToEnd - aToStart < aFromEnd - aFromStart)
                return taggedTo.concat(taggedFrom);
			else
                return taggedFrom.concat(taggedTo);
		}

		fromBestIndex = fromEqualIndex;
		toBestIndex = toEqualIndex;
		bestRatio = 1.0;
	}

	return [].concat(
		this.__diffLines(aFromStart, fromBestIndex,
						 aToStart, toBestIndex,
						 aEncoded),
		(aEncoded ?
			this._diffLineEncoded(this.from[fromBestIndex],
								  this.to[toBestIndex]) :
			this._diffLine(this.from[fromBestIndex],
							this.to[toBestIndex])
		),
		this.__diffLines(fromBestIndex + 1, aFromEnd,
						 toBestIndex + 1, aToEnd,
						 aEncoded)
	);
}

function __diffLines(aFromStart, aFromEnd, aToStart, aToEnd, aEncoded)
{
	if (aFromStart < aFromEnd) {
		if (aToStart < aToEnd) {
			return this._diffLines(aFromStart, aFromEnd, aToStart, aToEnd, aEncoded);
		} else {
			return this._tagDeleted(this.from.slice(aFromStart, aFromEnd), aEncoded);
		}
	} else {
		return this._tagInserted(this.to.slice(aToStart, aToEnd), aEncoded);
	}
}

function _diffLineEncoded(aFromLine, aToLine)
{
	var diffLines = this._diffLine(aFromLine, aToLine);
	var encoded = [];
	var line,
		diff,
		taggedLine,
		currentTag,
		lastTag,
		lineTag,
		i, maxi,
		j, maxj;
	for (i = 0, maxi = diffLines.length; i < maxi; i += 2)
	{
		line = diffLines[i];
		diff = diffLines[i+1];
		lineTag = line.charAt(0);
		if (!diff) {
			taggedLine = this._escapeForEncoded(line.substring(2));
		}
		else {
			taggedLine = '';
			lastTag = ' ';
			for (j = 2, maxj = diff.length; j < maxj; j++)
			{
				currentTag = diff.charAt(j);
				if (lastTag != currentTag) {
					if (lastTag != ' ') taggedLine += '</span>';
					switch(currentTag)
					{
						case '-':
							taggedLine += '<span class="tagged phrase deleted">';
							break;
						case '+':
							taggedLine += '<span class="tagged phrase inserted">';
							break;
						case '^':
							taggedLine += '<span class="tagged phrase replaced">';
							break;
					}
				}
				taggedLine += this._escapeForEncoded(line.charAt(j));
				lastTag = currentTag;
			}
			if (lastTag != ' ') {
				taggedLine += '</span>';
			}
			taggedLine += this._escapeForEncoded(line.substring(diff.length));
		}
		encoded.push(
			'<span class="tagged line '+
			(lineTag == '-' ? 'deleted' :
			 lineTag == '+' ? 'inserted' :
			                  'equal')+
			'">'+
			'<span class="tag">'+lineTag+'</span> '+taggedLine+
			'</span>'
		);
	}
	return encoded;
}

function _diffLine(aFromLine, aToLine)
{
	var fromTags = "";
	var toTags = "";
	var matcher = new SequenceMatcher(aFromLine, aToLine,
									  this._isSpaceCharacter);

	var _this = this;
	matcher.operations().forEach(function (aOperation) {
		var tag = aOperation[0];
		var fromStart = aOperation[1];
		var fromEnd = aOperation[2];
		var toStart = aOperation[3];
		var toEnd = aOperation[4];
		var fromLength, toLength;

		fromLength = fromEnd - fromStart;
		toLength = toEnd - toStart;
		switch (tag) {
			case "replace":
				fromTags += _this._repeat("^", fromLength);
				toTags += _this._repeat("^", toLength);
				break;
			case "delete":
            	fromTags += _this._repeat("-", fromLength);
				break;
			case "insert":
            	toTags += _this._repeat("+", toLength);
				break;
			case "equal":
				fromTags += _this._repeat(" ", fromLength);
				toTags += _this._repeat(" ", toLength);
				break;
            default:
				throw "unknown tag: " + tag;
				break;
		}
	});

	return this._formatDiffPoint(aFromLine, aToLine, fromTags, toTags);
}

function _formatDiffPoint(aFromLine, aToLine, aFromTags, aToTags)
{
	var common;
	var result;
	var fromTags, toTags;

	common = Math.min(this._nLeadingCharacters(aFromLine, "\t"),
					  this._nLeadingCharacters(aToLine, "\t"));
	common = Math.min(common,
					  this._nLeadingCharacters(aFromTags.substr(0, common),
											   " "));
	fromTags = aFromTags.substr(common).replace(/\s*$/, '');
	toTags = aToTags.substr(common).replace(/\s*$/, '');

	result = this._tagDeleted([aFromLine]);
	if (fromTags.length > 0) {
		fromTags = this._repeat("\t", common) + fromTags;
		result = result.concat(this._tagDifference([fromTags]));
	}
	result = result.concat(this._tagInserted([aToLine]));
	if (toTags.length > 0) {
		toTags = this._repeat("\t", common) + toTags;
		result = result.concat(this._tagDifference([toTags]));
	}

	return result;
}

function _nLeadingCharacters(aString, aCharacter)
{
	var n = 0;
	while (aString[n] == aCharacter) {
		n++;
	}
	return n;
}

function _isSpaceCharacter(aCharacter)
{
	return aCharacter == " " || aCharacter == "\t";
}

function _repeat(aString, n)
{
	var result = "";

	for (; n > 0; n--) {
		result += aString;
	}

	return result;
}
