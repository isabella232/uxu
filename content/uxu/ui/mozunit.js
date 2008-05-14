var module = new ModuleManager(['chrome://uxu/content/lib']); 
var mozlab = {
	mozunit: module.require('package', 'package')
};
var utils  = module.require('package', 'utils');
var bundle  = module.require('package', 'bundle');

var helper_module = new ModuleManager(['chrome://uxu/content/test/helper']);
var TestUtils     = helper_module.require('class', 'test_utils');
var action        = helper_module.require('package', 'action');
 
/* UTILITIES */ 
	
function x() { 
	var contextNode, path;
	if(arguments[0] instanceof XULElement) {
		contextNode = arguments[0];
		path = arguments[1];
	}
	else {
		path = arguments[0];
		contextNode = document;
	}

	function resolver(prefix) {
		switch(prefix) {
		case 'xul':
			return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
			break;
		case 'hy':
			return 'http://hyperstruct.net/';
			break;
		default:
			return null;
		}
	}

	return document.evaluate(
		path, contextNode, resolver,
		XPathResult.ANY_UNORDERED_NODE_TYPE, null).
		singleNodeValue;
}
 
function _(idOrElement, subCriteria) { 
	var element = (idOrElement instanceof XULElement) ?
		idOrElement : document.getElementById(idOrElement);

	if(subCriteria)
		if(typeof(subCriteria) == 'object') {
			for(var attributeName in subCriteria)
				return x(element, './/*[@' + attributeName + '=' +
						 '"' + subCriteria[attributeName] + '"]');
		} else
			return x(element, './/*[@role="' + subCriteria + '"]');
	else
		return element;
}
 
function clone(blueprintName) { 
	return _('blueprints', blueprintName)
		.cloneNode(true);
}
 
function removeChildrenOf(element) { 
	while(element.lastChild)
		element.removeChild(element.lastChild);
}
 
function padLeft(thing, width, padder) { 
	var paddedString = '';
	var string = thing.toString();
	return (string.length < width) ?
		(function() {
			for(var i=0, l=width-string.length; i<l; i++)
				paddedString += padder;
			return paddedString + string;
		})() :
		string;
}
  
/* file picker */ 
	 
function pickFile(aMode, aOptions) { 
	if (!aOptions) aOptions = {};
	var mode = 'mode' + (aMode ?
						 aMode[0].toUpperCase() + aMode.substr(1) :
						 'open');
	const nsIFilePicker = Components.interfaces.nsIFilePicker;

	var picker = Components
		.classes["@mozilla.org/filepicker;1"]
		.createInstance(nsIFilePicker);
	if (aOptions.defaultExtension)
		picker.defaultExtension = aOptions.defaultExtension;

	if (aOptions.defaultFile) {
		var defaultFile = aOptions.defaultFile;
		try {
			defaultFile = defaultFile.QueryInterface(Components.interfaces.nsILocalFile)
		}
		catch(e) {
			defaultFile = utils.makeFileWithPath(defaultFile);
		}
		if (defaultFile) {
			if (defaultFile.exists() && defaultFile.isDirectory()) {
				picker.displayDirectory = defaultFile;
			}
			else if (!defaultFile.exists() || !defaultFile.isDirectory()) {
					picker.displayDirectory = defaultFile.parent;
			}
		}
	}

	picker.init(window, aOptions.title || '', nsIFilePicker[mode]);
	if (aOptions.filters) {
		for (var filter in aOptions.filters) {
			picker.appendFilter(filter, aOptions.filters[filter]);
		}
	}
	picker.appendFilters((aOptions.filter || 0) | nsIFilePicker.filterAll);
	var result = picker.show();
	if(result == nsIFilePicker.returnOK ||
	   result == nsIFilePicker.returnReplace)
		return picker.file;
}
 
function pickFileUrl(mode, aOptions) { 
	var file = pickFile(mode, aOptions);
	if(file)
		return utils.getURLSpecFromFilePath(file.path);
}
 
const fileDNDObserver = { 
	 
	isTestCase : function(aFile) 
	{
		return aFile && (aFile.isDirectory() || /\.js$/.test(aFile.leafName));
	},
 
	onDrop : function(aEvent, aTransferData, aSession) 
	{
		var file = aTransferData.data;
		if (this.isTestCase(file))
			_('file').value = file.path;
	},
 
	canDrop : function(aEvent, aSession) 
	{
		var XferDataSet = nsTransferable.get(
				this.getSupportedFlavours(),
				nsDragAndDrop.getDragData,
				true
			);
		var XferData = XferDataSet.first.first;
		var file = XferData.data;
		return this.isTestCase(file);
	},
 	
	onDragOver : function(aEvent, aFlavour, aSession) 
	{
	},
 
	onDragExit : function(aEvent, aFlavour, aSession) 
	{
	},
 
	getSupportedFlavours : function () 
	{
		var flavours = new FlavourSet();
		flavours.appendFlavour('application/x-moz-file', 'nsIFile');
		return flavours;
	}
 
}; 
   
/* DOMAIN */ 
	
function init() { 
}
 
function finish() { 
}
  
/* test cases */ 
	 
function newTestCase() { 
	var file = pickFile('save', makeTestCaseFileOptions());
	if(file) {
		if (file.exists()) file.remove(true);
		_('file').value = file.path;
		writeTemplate(file.path);
		window.setTimeout(function() {
			openInEditor(file.path, 4, 29);
		}, 100);
	}
}
	
function writeTemplate(filePath) { 
	var data = utils.readFrom('chrome://uxu/locale/sample.js');
	utils.writeTo(data, filePath);
}
  
function openTestCase(aIsFolder) { 
	var file = pickFile((aIsFolder ? 'getFolder' : '' ), makeTestCaseFileOptions(aIsFolder));
	if(file)
		_('file').value = file.path;
}
 
function pickTestFile(aOptions) { 
	var url = pickFileUrl(null, aOptions);
	if(url)
		_('file').value = url;
}
 
function makeTestCaseFileOptions(aIsFolder) { 
	return {
		defaultFile : _('file').value,
		defaultExtension : 'js',
		filters : {
			'Javascript Files' : '*.js'
		},
		title : bundle.getString(aIsFolder ? 'picker_title_open_testcase_folder' : 'picker_title_open_testcase' )
	};
}
  
/* runner */ 
	
function TestReportHandler(aTestCase) { 
	this.testCase = aTestCase;
	this.mFinishHandlers = [
		(function() {
			this.testCase.environment.utils.cleanUpTempFiles();
		})
	];
}
TestReportHandler.prototype = {
	getTestCaseReport : function(title)
	{
		var id = 'testcase-report-'+encodeURIComponent(title);
		return _(id) ||
			(function() {
				var wTestCaseReport = clone('testcase-report');
				wTestCaseReport.setAttribute('id', id);
				wTestCaseReport.setAttribute('title', title);
				_(wTestCaseReport, 'title').textContent = title;
				_(wTestCaseReport, 'bar').setAttribute('class', 'testcase-fine');
				_('testcase-reports').appendChild(wTestCaseReport);
				return wTestCaseReport;
			})();
	},
	handleReport : function(report) {
		var wTestCaseReport = this.getTestCaseReport(this.testCase.title);
		_(wTestCaseReport, 'bar').setAttribute('mode', 'determined');
		_(wTestCaseReport, 'bar').setAttribute(
			'value', parseInt(report.testIndex / report.testCount * 100));
		_(wTestCaseReport, 'total-counter').value = report.testCount;

		if(report.result == 'success') {
			var successes = parseInt(_(wTestCaseReport, 'success-counter').value);
			_(wTestCaseReport, 'success-counter').value = successes + 1;
			return;
		}

		_(wTestCaseReport, 'bar').setAttribute('class', 'testcase-problems');

		var id = 'test-report-'+encodeURIComponent(title)+'-'+_(wTestCaseReport, 'test-reports').childNodes.length;
		var wTestReport = clone('test-report');
		wTestReport.setAttribute('id', id);
		_(wTestReport, 'result').value = bundle.getString('report_result_'+report.result);
		_(wTestReport, 'icon').setAttribute('class', 'test-' + report.result);
		_(wTestReport, 'description').textContent = report.testDescription;
		_(wTestReport, 'description').setAttribute('tooltiptext', report.testDescription);
		if(report.exception) {
			_(wTestReport, 'additionalInfo').textContent = report.exception.message;
			if(report.exception.stack) {
				displayStackTrace(report.exception.stack, _(wTestReport, 'stack-trace'));
				_(wTestReport, 'stack-trace').hidden = false;
			}
		}

		_(wTestCaseReport, 'test-reports').appendChild(wTestReport);
	},
	set onFinish(aValue) {
		this.mFinishHandlers.push(aValue);
		return aValue;
	},
	get onFinish() {
		var handlers = this.mFinishHandlers;
		var self = this;
		return (function() {
				handlers.forEach(function(aHandler) {
					try {
						aHandler.call(self);
					}
					catch(e) {
						dump(e+'\n');
					}
				});
			});
	}
};
 
function onError(aError) 
{
	_('prerun-report', 'error').value = bundle.getFormattedString('error_failed', [aError.toString()]);
	_('prerun-report', 'error').hidden = false;

	if(aError.stack) {
		displayStackTrace(aError.stack, _('prerun-report', 'stack-trace'));
		_('prerun-report', 'stack-trace').hidden = false;
		_('prerun-report').hidden = false;
	}
}
 
var traceLineRegExp = /@(\w+:.*)?:(\d+)/;
var includeRegExp = /^chrome:\/\/uxu\/content\/test\/helper\/subScriptRunner\.js\?includeSource=([^;,]+)/i;
function displayStackTrace(trace, listbox) { 
	var fullLines = trace.split('\n').map(function(aLine) {
			if (!aLine.match(traceLineRegExp)) return aLine;
			var sourceUrl = RegExp.$1;
			var match = sourceUrl.match(includeRegExp);
			var includeSource = match ? match[1] : null ;
			if (includeSource) {
				 aLine = aLine.replace(sourceUrl, decodeURIComponent(includeSource));
			}
			return aLine;
		});
	var lines = fullLines.filter(function(aLine) {
			return /\w+:\/\//.test(aLine) && aLine.indexOf('@chrome://uxu/content/') < 0;
		});
	if (!lines.length) lines = fullLines;
	lines.forEach(function(aLine) {
		var item = document.createElement('listitem');
		item.setAttribute('label', aLine);
		item.setAttribute('crop', 'center');
		listbox.appendChild(item);
	});
}
 
function toggleContent() { 
	_('content').collapsed = !_('content').collapsed;
	_('content-splitter').hidden = !_('content-splitter').hidden;
}
 
function hideSource() { 
	_('source-viewer').collapsed = true;
	_('source-splitter').hidden = true;
}
 
function reset() { 
	_('prerun-report', 'error').hidden = true;
	_('prerun-report', 'stack-trace').hidden = true;
	removeChildrenOf(_('prerun-report', 'stack-trace'));
	removeChildrenOf(_('testcase-reports'))
	hideSource();
}
 
function setRunningState(aRunning) { 
	if (aRunning) {
		_('run').setAttribute('disabled', true);
		_('run').setAttribute('hidden', true);
		_('stop').removeAttribute('disabled');
		_('stop').removeAttribute('hidden');
		_('testRunningProgressMeter').setAttribute('mode', 'determined');
		_('testRunningProgressMeterPanel').removeAttribute('collapsed');
	}
	else {
		_('run').removeAttribute('disabled');
		_('run').removeAttribute('hidden');
		_('stop').setAttribute('disabled', true);
		_('stop').setAttribute('hidden', true);
		_('testRunningProgressMeter').setAttribute('mode', 'undetermined');
		_('testRunningProgressMeterPanel').setAttribute('collapsed', true);
	}
}
 
function run() { 
	reset();

	shouldStopTest = false;

	var path = _('file').value;
	var file = utils.makeFileWithPath(path);

	var suites;
	if (file.isDirectory())
		suites = loadFolder(file);
	else
		suites = [loadFile(file)];

	var tests = initializeTests(suites);

	var max = tests.length + 1;
	var runTest = function(aTest, aIndex) {
			if (shouldStopTest) {
				setRunningState(false);
				throw 'stop';
			}
			try {
				setRunningState(true);
				_('testRunningProgressMeter').setAttribute('value',
						parseInt(((aIndex + 1) / max) * 100));
				aTest.run(stopper);
			}
			catch(e) {
				onError(e);
			}
		};

	var stopper = function() {
			return shouldStopTest;
		};

	if (utils.getPref('extensions.uxu.run.async')) {
		tests.forEach(runTest);
	}
	else {
		var count = 0;
		var test;
		window.setTimeout(function() {
			if ((!test || test.done) && tests.length) {
				test = tests.shift();
				runTest(test, count++);
			}
			if (tests.length)
				window.setTimeout(arguments.callee, 100);
		}, 100);
	}
}
var shouldStopTest = false;
 
function stop() { 
	shouldStopTest = true;
	_('stop').setAttribute('disabled', true);
}
	 
function loadFolder(aFolder) { 
	var files = aFolder.directoryEntries;
	var file;
	var suites = [];
	var ignoreHiddenFiles = utils.getPref('extensions.uxu.run.ignoreHiddenFiles');
	while (files.hasMoreElements())
	{
		file = files.getNext()
				.QueryInterface(Components.interfaces.nsILocalFile);

		if (
			ignoreHiddenFiles &&
			(
				file.isHidden() ||
				file.leafName.indexOf('.') == 0
			)
			)
			continue;

		if (file.isDirectory())
			suites = suites.concat(loadFolder(file));
		else if (/\.js$/i.test(file.leafName))
			suites.push(loadFile(file));
	}
	return suites;
}
 
function loadFile(aFile) { 
	var url = utils.getURLSpecFromFilePath(aFile.path);

	try {
		var suite = {};
		suite.TestCase      = mozlab.mozunit.TestCase;
		suite.Specification = mozlab.mozunit.TestCase;
		suite.assert        = mozlab.mozunit.assertions;
		suite.fileURL       = url;
		suite.baseURL       = suite.fileURL.replace(/[^/]*$/, '');
		suite.utils         = new TestUtils(suite);
		suite.utils.fileURL = suite.fileURL;
		suite.utils.baseURL = suite.baseURL;
		suite.action        = action;
		suite.utils.include(suite.fileURL);
	} catch(e) {
		if (/\.(js|jsm)$/i.test(aFile.leafName))
			onError(e);
		suite = null;
	}

	return suite;
}
 
function initializeTests(aSuites) { 
	var syncTestCount = 0;
	var asyncTestCount = 0;

	var onSyncTestEnd = function() {
			syncTestCount--;
			if (!syncTestCount && !asyncTestCount)
				setRunningState(false);
		};
	var onAsyncTestEnd = function() {
			asyncTestCount--;
			if (!syncTestCount && !asyncTestCount)
				setRunningState(false);
		};

	var tests = [];
	aSuites.forEach(function(suite, aIndex) {
		if (!suite) return;
		try {
			var testsFound  = false;
			for (var thing in suite) {
				if (!suite[thing]) continue;
				if (suite[thing].__proto__ == mozlab.mozunit.TestCase.prototype) {
					testsFound = true;

					var testCase = suite[thing];
					testCase.reportHandler = new TestReportHandler(testCase);
					testCase.environment = suite;
					if (testCase.runStrategy == 'async') {
						testCase.reportHandler.onFinish = onAsyncTestEnd;
						asyncTestCount++;
					}
					else {
						testCase.reportHandler.onFinish = onSyncTestEnd;
						syncTestCount++;
					}
					tests.push(testCase);
				}
			}

			if(!testsFound)
				throw new Error(bundle.getFormattedString('error_test_not_found', [suite.fileURL]));

		} catch(e) {
			onError(e);
		}
	});

	return tests;
}
  
function stylizeSource(sourceDocument, lineCallback) { 
	var originalSource = sourceDocument.getElementsByTagName('pre')[0];
	var processedSource = sourceDocument.createElementNS('http://www.w3.org/1999/xhtml', 'pre');
	var sourceLines = originalSource.textContent.split('\n');
	var sourceLine, htmlLine, lineContent;
	for(var i=0, l=sourceLines.length; i<l; i++) {
		if(lineCallback)
			htmlLine = lineCallback(sourceDocument, i+1, sourceLines[i]) ||
				sourceDocument.createTextNode(sourceLines[i]);

		processedSource.appendChild(htmlLine)
	}
	processedSource.normalize();
	originalSource.parentNode.replaceChild(processedSource, originalSource);

	var cssElem = sourceDocument.createElementNS('http://www.w3.org/1999/xhtml', 'style');
	cssElem.type = 'text/css';
	cssElem.textContent =
		'body { margin: 0; }' +
		'#current { font-weight: bold; background-color: #e5e5e5; }' +
		'.link { color: blue; border-bottom: thin solid blue; cursor: pointer; }';

	sourceDocument.getElementsByTagName('head')[0].appendChild(cssElem);
}
 
function openInEditor(filePath, lineNumber, columnNumber, commandLine) { 
	if (utils.makeFileWithPath(filePath).isDirectory()) {
		return;
	}

	lineNumber = lineNumber || 1;
	columnNumber = columnNumber || 1;
	commandLine = commandLine ||
		utils.getPref('extensions.uxu.mozunit.editor') ||
		utils.getPref('extensions.mozlab.mozunit.editor') ||
		(utils.getPref('view_source.editor.path') ?
			'"'+utils.getPref('view_source.editor.path')+'" "%f"' : '') ||
		'/usr/bin/x-terminal-emulator -e /usr/bin/emacsclient -t +%l:%c %f';

	var tokens = [''];
	var quot   = '';
	var char;
	for (var i = 0, maxi = commandLine.length; i < maxi; i++)
	{
		char = commandLine.charAt(i);
		if (char == '"' || char == "'") {
			if (quot) {
				quot = '';
				tokens.push('');
				continue;
			}
			else {
				quot = char;
				continue;
			}
		}
		else if (/\s/.test(char)) {
			if (!quot) {
				if (tokens[tokens.length-1]) tokens.push('');
				continue;
			}
		}
		tokens[tokens.length-1] += char;
	}

	var argv = tokens.map(
		function(word) {
			return word.
				replace('%l', lineNumber).
				replace('%c', columnNumber).
				replace('%u', utils.getURLSpecFromFilePath(filePath)).
				replace('%f', filePath);
		});

	var editorPath;
	var executable = Components
		.classes["@mozilla.org/file/local;1"].
		createInstance(Components.interfaces.nsILocalFile);
	var process = Components
		.classes["@mozilla.org/process/util;1"].
		createInstance(Components.interfaces.nsIProcess);
	try {
		editorPath = argv.shift();
		executable.initWithPath(editorPath);
		process.init(executable);
		process.run(false, argv, argv.length);
		return;
	}
	catch(e) {
		editorPath = '';
	}
	if (!editorPath || !executable.exists()) {
		var editor = pickFile('open', {
				title : bundle.getString('picker_title_external_editor'),
				defaultExtension : 'exe',
				filter : Components.interfaces.nsIFilePicker.filterApps
			});
		if (!editor || !editor.path) return;
		utils.setPref('extensions.uxu.mozunit.editor', '"'+editor.path+'" "%f"');
		arguments.callee(filePath, lineNumber, columnNumber);
	}
}
 
function showSource(traceLine) { 
	var match = traceLine.match(/@(\w+:.*)?:(\d+)/);
	if (!match) return;

	var sourceUrl = match[1];
	var lineNumber = match[2];
	var encoding;

	if (!sourceUrl) return;

	var frame = _('source-viewer', 'source');
	_('source-splitter').hidden = false;
	_('source-viewer').collapsed = false;

	match = sourceUrl.match(/[;\?]encoding=([^;,]+)/i);
	if (match && match[1]) {
		encoding = match[1];
		sourceUrl = sourceUrl.replace(/\?.+$/, '');
	}

	function onLoad(event) {
		_('source-viewer', 'source').removeEventListener('load', onLoad, true);

		stylizeSource(
			_('source-viewer', 'source').contentDocument,
			function(sourceDoc, number, content)
			{
				content = padLeft(number, 3, 0) + ' ' + content + '\n';

				if (number == lineNumber) {
					var currentLine = sourceDoc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
					currentLine.setAttribute('id', 'current');
					currentLine.textContent = content;

					if(sourceUrl.match(/^file:\/\//)) {
						currentLine.setAttribute('class', 'link');
						currentLine.addEventListener(
							'click', function(event) {
								openInEditor(utils.getFilePathFromURLSpec(sourceUrl), lineNumber);
							}, false);
					}

					return currentLine;
				}
				else {
					return sourceDoc.createTextNode(content);
				}
			}
		);

		_('source-viewer', 'source').contentWindow.scrollTo(
			0,
			(frame.contentDocument.getElementById('current').offsetTop -
				frame.contentWindow.innerHeight/2)
		);

	}

	if (encoding) {
		var docCharset = _('source-viewer', 'source').docShell
				.QueryInterface(Components.interfaces.nsIDocCharset);
		docCharset.charset = encoding;
	}

	_('source-viewer', 'source').addEventListener('load', onLoad, true);
	_('source-viewer', 'source').webNavigation.loadURI(
		sourceUrl,
		Components.interfaces.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE,
		null, null, null
	);
}
  
