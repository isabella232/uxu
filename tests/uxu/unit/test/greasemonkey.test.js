var targetProduct = 'Firefox';

var topDir = baseURL+'../../../../';

utils.include(topDir+'content/uxu/lib/module_manager.js');

var test_module = new ModuleManager([topDir+'content/uxu/test']);
var GMUtilsClass = test_module.require('class', 'greasemonkey');

var GMUtils;

function setUp()
{
	yield Do(utils.loadURI('about:blank'));
	assert.equals('about:blank', content.location.href);
	GMUtils = new GMUtilsClass(utils);
}

function tearDown()
{
	yield Do(utils.loadURI('about:blank'));
	yield Do(GMUtils.close());
}

function test_loadAndUnload()
{
	var retVal = GMUtils.load('about:');
	assert.isDefined(retVal.value);
	assert.isFalse(retVal.value);
	assert.notEquals('about:', content.location.href);

	yield 1000;
	assert.isTrue(retVal.value);
	assert.equals('about:', content.location.href);

	retVal = GMUtils.unload();
	assert.isDefined(retVal.value);
	assert.isFalse(retVal.value);
	assert.notEquals('about:blank', content.location.href);

	yield 1000;
	assert.isTrue(retVal.value);
	assert.equals('about:blank', content.location.href);
}


function test_openAndClose()
{
	var retVal = GMUtils.open('about:');
	assert.isDefined(retVal.value);
	assert.isFalse(retVal.value);
	assert.isDefined(retVal.window);
	assert.isNull(retVal.window);

	var count = 0;
	while (count < 10)
	{
		count++;
		yield 1000;
		if (retVal.value) break;
	}
	yield 100;
	assert.isTrue(retVal.value);
	assert.isNotNull(retVal.window);
	assert.isTrue(retVal.window instanceof Ci.nsIDOMWindow);
	assert.isTrue(retVal.window instanceof Ci.nsIDOMChromeWindow);
	assert.equals('about:', retVal.window.content.location.href);

	GMUtils.close();
	yield 300;
	assert.isTrue(retVal.window.closed);
}

function test_getSandbox()
{
	var sandbox1 = GMUtils.getSandboxFor('about:blank');
	assert.isTrue(sandbox1);

	assert.isTrue(sandbox1.window);
	assert.isTrue(sandbox1.window instanceof Ci.nsIDOMWindow);
	assert.matches(/XPCNativeWrapper/, String(sandbox1.window));
	assert.isTrue(sandbox1.unsafeWindow);
	assert.isTrue(sandbox1.unsafeWindow instanceof Ci.nsIDOMWindow);
	assert.notMatches(/XPCNativeWrapper/, String(sandbox1.unsafeWindow));
	assert.equals(sandbox1.window, sandbox1.unsafeWindow);

	assert.isUndefined(sandbox1.window.foobar);
	assert.isUndefined(sandbox1.unsafeWindow.foobar);
	sandbox1.window.foobar = true;
	assert.isDefined(sandbox1.window.foobar);
	assert.isUndefined(sandbox1.unsafeWindow.foobar);

	assert.isUndefined(sandbox1.window.hoge);
	assert.isUndefined(sandbox1.unsafeWindow.hoge);
	sandbox1.unsafeWindow.hoge = true;
	assert.isUndefined(sandbox1.window.hoge);
	assert.isDefined(sandbox1.unsafeWindow.hoge);

	assert.isTrue(sandbox1.document);
	assert.isTrue(sandbox1.document instanceof Ci.nsIDOMDocument);
	assert.matches(/XPCNativeWrapper/, String(sandbox1.document));
	assert.equals(sandbox1.window.document, sandbox1.document);

	assert.equals(sandbox1.XPathResult, Ci.nsIDOMXPathResult);

	assert.isFunction(sandbox1.GM_log);
	assert.isFunction(sandbox1.GM_getValue);
	assert.isFunction(sandbox1.GM_setValue);
	assert.isFunction(sandbox1.GM_registerMenuCommand);
	assert.isFunction(sandbox1.GM_xmlhttpRequest);
	assert.isFunction(sandbox1.GM_addStyle);
	assert.isFunction(sandbox1.GM_getResourceURL);
	assert.isFunction(sandbox1.GM_getResourceText);
	assert.isFunction(sandbox1.GM_openInTab);
	assert.isTrue(sandbox1.console);
	assert.isFunction(sandbox1.console.log);

	var sandbox2 = GMUtils.getSandboxFor('about:blank');
	assert.equals(sandbox1, sandbox2);

	var sandbox3 = GMUtils.getSandBoxFor('about:blank');
	assert.equals(sandbox1, sandbox3);

	var sandbox4 = GMUtils.getSandboxFor('about:mozilla');
	assert.notEquals(sandbox1, sandbox4);

	var sandbox5 = GMUtils.getSandBoxFor('about:mozilla');
	assert.notEquals(sandbox1, sandbox5);
	assert.equals(sandbox4, sandbox5);
}

function test_loadScript()
{
	var url = baseURL+'../../../samples/greasemonkey/greasemonkey.user.js';
	var sandbox1 = GMUtils.loadScript(url);
	assert.isTrue(sandbox1);

	var sandbox2 = GMUtils.getSandboxFor(url);
	assert.equals(sandbox1, sandbox2);

	assert.isFunction(sandbox1.getDocumentTitleAndURI);
}


function test_doAndWaitLoad()
{
}


function test_GM_log()
{
}

function test_GM_getValue()
{
    assert.equals(null, GMUtils.GM_getValue('nonexistence'));
    assert.equals(100, GMUtils.GM_getValue('nonexistence', 100));
}

function test_GM_setValue()
{
}

function test_GM_registerMenuCommand()
{
}

function test_GM_xmlhttpRequest()
{
}

function test_GM_addStyle()
{
}

function test_GM_getResourceURL()
{
	var url = baseURL+'../../../samples/greasemonkey/greasemonkey.user.js';
	var sandbox = GMUtils.loadScript(url);
	assert.notEquals('http://www.clear-code.com/', sandbox.GM_getResourceURL('URL'));
}

function test_GM_getResourceText()
{
	var url = baseURL+'../../../samples/greasemonkey/greasemonkey.user.js';
	var sandbox = GMUtils.loadScript(url);
	assert.equals('this is a sample text', sandbox.GM_getResourceText('TEXT'));
}

function test_GM_openInTab()
{
	yield Do(GMUtils.open('about:'));
	var win = utils.getTestWindow();
	var tabs = win.gBrowser.mTabs;
	var count = tabs.length;
	GMUtils.GM_openInTab('about:config');
	yield 200;
	assert.equals(count+1, tabs.length);
	assert.equals('about:config', tabs[tabs.length-1].linkedBrowser.currentURI.spec);
}


function test_listeningEvents()
{
	function defaultHandler(aEvent) { this.setResult(aEvent); };
	var listener = {
			results : [],
			get count()
			{
				return this.results.length;
			},
			get lastResult()
			{
				return this.results[this.results.length-1];
			},
			setResult : function(aEvent)
			{
				var result = {};
				for (var i in aEvent)
				{
					result[i] = aEvent[i];
				}
				this.results.push(result);
			},
			clear : function()
			{
				this.results = [];
			},
			onGM_logCall : defaultHandler,
			onGM_getValueCall : defaultHandler,
			onGM_setValueCall : defaultHandler,
			onGM_xmlhttpRequestCall : defaultHandler,
			onGM_xmlhttpRequestBeforeLoad : defaultHandler,
			onGM_xmlhttpRequestLoad : defaultHandler,
			onGM_xmlhttpRequestBeforeError : defaultHandler,
			onGM_xmlhttpRequestError : defaultHandler,
			onGM_xmlhttpRequestBeforeReadystatechange : defaultHandler,
			onGM_xmlhttpRequestReadystatechange : defaultHandler,
			onGM_registerMenuCommandCall : defaultHandler,
			onGM_addStyleCall : defaultHandler,
			onGM_getResourceURLCall : defaultHandler,
			onGM_getResourceTextCall : defaultHandler,
			onGM_openInTabCall : defaultHandler
		};

	function assertClear()
	{
		listener.clear();
		assert.equals(0, listener.count);
	}

	function assertResult(aExpected)
	{
		assert.equals(1, listener.count);
		for (var i in aExpected)
		{
			assert.isDefined(i, i);
			assert.equals(aExpected[i], listener.lastResult[i]);
		}
		assertClear();
	}

	yield Do(GMUtils.open('about:'));
	GMUtils.addListener(listener);

	var url = baseURL+'../../../samples/greasemonkey/greasemonkey.user.js';
	var sandbox = GMUtils.loadScript(url);

	assertClear();

	GMUtils.GM_log('foo');
	assertResult({
		type    : 'GM_logCall',
		message : 'foo'
	});

	GMUtils.GM_setValue('key', 'value');
	assertResult({
		type  : 'GM_setValueCall',
		key   : 'key',
		value : 'value'
	});

	GMUtils.GM_getValue('key');
	assertResult({
		type : 'GM_getValueCall',
		key  : 'key',
	});

	var func = function(aArg) { return true; };
	GMUtils.GM_registerMenuCommand('command', func, 'c', 'control', 'd');
	assertResult({
		type           : 'GM_registerMenuCommandCall',
		name           : 'command',
		function       : func,
		accelKey       : 'c',
		accelModifiers : 'control',
		accessKey      : 'd'
	});

	GMUtils.GM_addStyle(content.document, '* { color: red; }');
	assertResult({
		type     : 'GM_addStyleCall',
		document : content.document,
		style    : '* { color: red; }'
	});

	GMUtils.GM_getResourceText('TEXT');
	assertResult({
		type : 'GM_getResourceTextCall',
		key  : 'TEXT'
	});

	GMUtils.GM_getResourceURL('URL');
	assertResult({
		type : 'GM_getResourceURLCall',
		key  : 'URL'
	});

	GMUtils.GM_openInTab('about:config');
	yield 200;
	assertResult({
		type : 'GM_openInTabCall',
		uri  : 'about:config'
	});

/*
GM_xmlhttpRequestCall
GM_xmlhttpRequestBeforeLoad
GM_xmlhttpRequestLoad
GM_xmlhttpRequestBeforeError
GM_xmlhttpRequestError
GM_xmlhttpRequestBeforeReadystatechange
GM_xmlhttpRequestReadystatechange
*/

	GMUtils.removeListener(listener);

//	GMUtils.fireEvent({});
}
