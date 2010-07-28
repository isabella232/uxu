// -*- indent-tabs-mode: t; tab-width: 4 -*- 

if (typeof window == 'undefined')
	this.EXPORTED_SYMBOLS = ['TestEnvironment'];

const Cc = Components.classes;
const Ci = Components.interfaces;

var ns = {};
Components.utils.import('resource://uxu-modules/eventTarget.js', ns);
Components.utils.import('resource://uxu-modules/utils.js', ns);
Components.utils.import('resource://uxu-modules/test/assertions.js', ns);
Components.utils.import('resource://uxu-modules/test/action.js', ns);
Components.utils.import('resource://uxu-modules/test/greasemonkey.js', ns);
Components.utils.import('resource://uxu-modules/server/utils.js', ns);
Components.utils.import('resource://uxu-modules/mail/utils.js', ns);

var WindowManager = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
var WindowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1'].getService(Ci.nsIWindowWatcher);

var key = 'uxu-test-window-id'; 
var defaultURI, defaultType, defaultFeatures, defaultName; 
	
function TestEnvironment(aEnvironment, aURI, aBrowser) 
{
	var baseURL = aURI.replace(/[^/]*$/, '');

	this.initListeners();

	this._utils = new ns.Utils();
	this._utils.fileURL = aURI;
	this._utils.baseURL = baseURL;
	this._utils.export(this, false);

	this.windowWatcherListeners = [];

	this.__defineGetter__('utils', function() {
		return this;
	});

	this.__defineGetter__('fileURL', function() {
		return aURI;
	});
	this.__defineGetter__('baseURL', function() {
		return baseURL;
	});

	this.environment = aEnvironment || {};
	this.environment.__proto__ = this;
    this.uniqueID = parseInt(Math.random() * 10000000000);

	this.__defineGetter__('_testFrame', function() {
		return aBrowser;
	});

	switch (this._utils.product)
	{
		case 'Firefox':
			defaultURI      = 'chrome://browser/content/browser.xul';
			defaultType     = 'navigator:browser';
			defaultFeatures = 'chrome,all,dialog=no';
			defaultName     = '_blank';
			this.attachGMUtils();
			break;

		case 'Thunderbird':
			defaultURI      = 'chrome://messenger/content/messenger.xul';
			defaultType     = null;
			defaultFeatures = 'chrome,all,dialog=no';
			defaultName     = '_blank';
			this.attachMailUtils();
			break;

		default:
			break;
	}

	this.initVariables();
	this.attachAssertions();
	this.attachActions();
	this.attachServerUtils();
}

TestEnvironment.prototype = {
	__proto__ : ns.EventTarget.prototype,
	
destroy : function() 
{
	if (this.greasemonkey) this.greasemonkey.destroy();
	this.fireEvent('Destroy', null);
	this.removeAllListeners();
	this.assert.removeListener(this);
	this.windowWatcherListeners.forEach(function(aWatcher) {
		this.removeWindowWatcher(aWatcher);
	}, this);
},
	
onFinish : function() 
{
	this.destroy();
},
 
onAssertionWarning : function(aEvent) 
{
	this.fireEvent('Warning', aEvent.data);
},
  
initVariables : function() 
{
	// __proto__で定義されたゲッタと同名の変数を定義できなくなってしまうため
	// ゲッタとセッタを自動設定するようにして問題を回避
	var _this = this;
	'gBrowser,contentWindow,content,contentDocument'.split(',')
		.forEach(function(aProperty) {
			_this.environment.__defineGetter__(aProperty, function() {
				return _this[aProperty];
			});
			_this.environment.__defineSetter__(aProperty, function(aValue) {
				this.__defineGetter__(aProperty, function() {
					return aValue;
				});
				this.__defineSetter__(aProperty, arguments.callee);
				return aValue;
			});
		});

	this.environment.Cc = Cc;
	this.environment.Ci = Ci;
},
 
get gBrowser() { return this.getTestFrameOwner(); }, 
get contentWindow() { return this.getTestFrameOwner().contentWindow; },
get content() { return this.getTestFrameOwner().contentWindow; },
get contentDocument() { return this.getTestFrameOwner().contentDocument; },
 
attachAssertions : function() 
{
	var assert = new ns.Assertions();
	this.__defineGetter__('assert', function() {
		return assert;
	});
	this.__defineSetter__('assert', function(aValue) {
		return aValue;
	});
	assert.addListener(this);
	for (var aMethod in assert)
	{
		if (typeof assert[aMethod] != 'function') continue;
		(function(aMethod, aSelf, aObj, aPrefix) {
			var func = function() {
					return aObj[aMethod].apply(aObj, arguments);
				};
			aSelf[aPrefix+aMethod.charAt(0).toUpperCase()+aMethod.substring(1)] = func;
			if (aMethod.indexOf('is') == 0 &&
				aMethod.substring(2) &&
				!(aMethod.substring(2) in aSelf))
				aSelf[aPrefix+aMethod.substring(2)] = func;
		})(aMethod, this, assert, 'assert');
	}
	this.ok = function() { assert.ok.apply(this, arguments); };
	this.is = function() { assert.is.apply(this, arguments); };
},
 
attachActions : function() 
{
	var actionInstance = new ns.Action(this);
	this.__defineGetter__('action', function() {
		return actionInstance;
	});
	this.__defineSetter__('action', function(aValue) {
		return aValue;
	});
	for (var aMethod in actionInstance)
	{
		if (typeof actionInstance[aMethod] != 'function') continue;
		(function(aMethod, aSelf, aObj, aPrefix) {
			var func = function() {
					return aObj[aMethod].apply(aObj, arguments);
				};
			aSelf[aPrefix+aMethod.charAt(0).toUpperCase()+aMethod.substring(1)] = func;
		})(aMethod, this, actionInstance, 'action');
	}
},
 
attachGMUtils : function() 
{
	var greasemonkey = new ns.GreasemonkeyUtils(this);
	this.__defineGetter__('greasemonkey', function() {
		return greasemonkey;
	});
	this.__defineSetter__('greasemonkey', function(aValue) {
		return aValue;
	});
	for (var aMethod in greasemonkey)
	{
		if (typeof greasemonkey[aMethod] != 'function')
			continue;
		(function(aMethod, aSelf, aObj, aPrefix) {
			var func = function() {
					return aObj[aMethod].apply(aObj, arguments);
				};
			aSelf[
				aMethod.indexOf('GM_') == 0 ?
					aMethod :
					aPrefix+aMethod.charAt(0).toUpperCase()+aMethod.substring(1)
			] = func;
		})(aMethod, this, greasemonkey, 'greasemonkey');
	}
},
 
attachMailUtils : function() 
{
	var mail = new ns.MailUtils(this);
	this.__defineGetter__('mail', function() {
		return mail;
	});
	this.__defineSetter__('mail', function(aValue) {
		return aValue;
	});
	this.addListener(mail);
},
 
attachServerUtils : function() 
{
	var serverUtils = new ns.ServerUtils();
	this.__defineGetter__('serverUtils', function() {
		return serverUtils;
	});
	this.__defineSetter__('serverUtils', function(aValue) {
		return aValue;
	});

	this.sendMessage = function() {
		return serverUtils.sendMessage.apply(serverUtils, arguments);
	};
	this.startListen = function() {
		return serverUtils.startListen.apply(serverUtils, arguments);
	};

	this.setUpHttpServer = function(aPort, aBasePath) {
		return serverUtils.setUpHttpServer(aPort, this.normalizeToFile(aBasePath));
	};
	this.tearDownHttpServer = function(aPort) {
		return serverUtils.tearDownHttpServer(aPort);
	};
	this.tearDownAllHttpServers = function(aPort) {
		return serverUtils.tearDownAllHttpServers();
	};
},
 
// window management 
	
normalizeTestWindowOption : function(aOptions) 
{
	if (!aOptions) aOptions = {};
	if (!aOptions.uri && !aOptions.type) {
		aOptions.uri       = defaultURI;
		aOptions.type      = defaultType;
		aOptions.features  = defaultFeatures;
		aOptions.name      = defaultName;
		aOptions.arguments = [];
	}
	else {
		aOptions.type      = aOptions.type || null;
		aOptions.features  = aOptions.features || aOptions.flags || 'chrome,all';
		aOptions.name      = aOptions.name || '_blank';;
		aOptions.arguments = aOptions.arguments || [];
	}

	if (/(?:left|screenX)=([^,]+)/i.test(aOptions.features))
		aOptions.screenX = parseInt(RegExp.$1);
	if (/(?:top|screenY)=([^,]+)/i.test(aOptions.features))
		aOptions.screenY = parseInt(RegExp.$1);
	if (/width=([^,]+)/i.test(aOptions.features))
		aOptions.width = parseInt(RegExp.$1);
	if (/height=([^,]+)/i.test(aOptions.features))
		aOptions.height = parseInt(RegExp.$1);

	if (/^(jar:)?(https?|ftp|file|chrome|resource):/.test(aOptions.uri))
		while (aOptions.uri != (aOptions.uri = aOptions.uri.replace(/[^\/]+\/\.\.\//, ''))) {}

	return aOptions;
},
 
// テスト用のFirefoxウィンドウを取得する 
getTestWindow : function(aOptions)
{
	var info = this.normalizeTestWindowOption(aOptions);
	var targets = WindowManager.getEnumerator(info.type),
		target;
	while (targets.hasMoreElements())
	{
		target = targets.getNext().
			QueryInterface(Ci.nsIDOMWindowInternal);
		if (target[key] == target.location.href+'?'+this.uniqueID ||
			target.document.documentElement.getAttribute(key) == target.location.href+'?'+this.uniqueID)
			return target;
	}

	return null;
},
 
// テスト用のFirefoxウィンドウを開き直す 
reopenTestWindow : function(aOptions, aCallback)
{
	var win = this.getTestWindow(aOptions);
	if (win) win.close();
	return this.openTestWindow(aOptions, aCallback);
},
 
// テスト用のFirefoxウィンドウを開く 
openTestWindow : function(aOptions, aCallback)
{
	var win = this.getTestWindow(aOptions);
	if (win) {
		win.focus();
		if (aCallback) aCallback(win);
	}
	else {
		var info = this.normalizeTestWindowOption(aOptions);
		win = window.openDialog.apply(window, [info.uri, info.name, info.features].concat(info.arguments));
		win[key] = this.uniqueID;
		var id = info.uri+'?'+this.uniqueID;
		win.addEventListener('load', function() {
			win.removeEventListener('load', arguments.callee, false);
			win.document.documentElement.setAttribute(key, id);
			win.setTimeout(function() {
				if (aOptions) {
					if ('width' in aOptions || 'height' in aOptions) {
						win.resizeTo(aOptions.width || 10, aOptions.height || 10);
					}
					if ('screenX' in aOptions || 'x' in aOptions ||
				    	'screenY' in aOptions || 'y' in aOptions) {
						win.moveTo(aOptions.screenX || aOptions.x || 0,
						           aOptions.screenY || aOptions.y || 0);
					}
				}
				win.focus();
				if (aCallback) {
					aCallback(win);
				}
			}, 0);
		}, false);
	}
	return win;
},
 
// テスト用のFirefoxウィンドウを閉じる 
closeTestWindow : function(aOptions)
{
	var win = this.getTestWindow(aOptions);
	if (win) win.close();
},
 
setUpTestWindow : function(aContinuation, aOptions) 
{
	if (!aOptions) aOptions = {};
	if (aContinuation && typeof aContinuation != 'function') {
		for (var i in aContinuation)
		{
			aOptions[i] = aContinuation[i];
		}
		aContinuation = void(0);
	}
	var completedFlag = this.setUpTestWindowInternal(aContinuation, aOptions);
	if (!aOptions.async) this._utils.wait(completedFlag);
	return completedFlag;
},
	
setUpTestWindowInternal : function(aContinuation, aOptions) 
{
	var loadedFlag = { value : false };
	if (this.getTestWindow(aOptions)) {
		if (aContinuation) aContinuation("ok");
		loadedFlag.value = true;
	}
	else {
		this.openTestWindow(
			aOptions,
			function(win) {
				window.setTimeout(function() {
					if (aContinuation) aContinuation('ok');
					loadedFlag.value = true;
				}, 0);
			}
		);
	}
	return loadedFlag;
},
  
tearDownTestWindow : function() { return this.closeTestWindow.apply(this, arguments); }, 
 
getChromeWindow : function(aOptions) 
{
	var windows = this.getChromeWindows(aOptions);
	return windows.length ? windows[0] : null ;
},
 
getChromeWindows : function(aOptions) 
{
	var info = this.normalizeTestWindowOption(aOptions);
	var targets = WindowManager.getEnumerator(info.type);
	var result = [];
	while (targets.hasMoreElements())
	{
		let target = targets.getNext().
			QueryInterface(Ci.nsIDOMWindowInternal);
		if (info.type)
			result.push(target);
		else if (info.uri == target.location.href)
			result.push(target);
	}

	return result;
},
  
// window watcher 
	
addWindowWatcher : function(aListener, aTargets) 
{
	if (!aListener) return;
	aListener = new WindowWatcherListener(aListener, aTargets, this);

	this.windowWatcherListeners.push(aListener);
	WindowWatcher.registerNotification(aListener);
},
 
removeWindowWatcher : function(aListener) 
{
	aListener = WindowWatcherListener.find(aListener, this.windowWatcherListeners);
	if (!aListener) return;
	try {
		WindowWatcher.unregisterNotification(aListener);
	}
	catch(e) {
		this.log(e);
	}
},
  
// load page 
	
_waitBrowserLoad : function(aTab, aBrowser, aLoadedFlag, aOnComplete) 
{
	if (aBrowser.localName == 'tabbrowser') {
		aTab = aBrowser.selectedTab;
		aBrowser = aTab.linkedBrowser;
	}
	var listener = {
		started : false,
		finished : false,
		isTabComplete : function() {
			return this.started && aTab && aTab.getAttribute('busy') != 'true';
		},
		onProgressChange : function() {},
		onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus)
		{
			if (aStateFlags & Ci.nsIWebProgressListener.STATE_START &&
				aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK) {
				this.started = true;
			}
			if (this.started &&
				aStateFlags & Ci.nsIWebProgressListener.STATE_STOP &&
				aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK) {
				this.onFinish();
			}
			else {
				window.setTimeout(function(aSelf) {
					if (aSelf.isTabComplete())
						aSelf.onFinish();
				}, 100, this);
			}
		},
		onLocationChange : function() {},
		onStatusChange : function() {},
		onSecurityChange : function() {},
		QueryInterface : function(aIID)
		{
			if (aIID.equals(Ci.nsIWebProgressListener) ||
				aIID.equals(Ci.nsISupportsWeakReference) ||
				aIID.equals(Ci.nsISupports)) {
				return this;
			}
			throw Components.results.NS_NOINTERFACE;
		},
		onFinish : function()
		{
			if (this.finished) return;
			this.finished = true;
			aBrowser.removeProgressListener(listener);
			aLoadedFlag.value = true;
			if (aOnComplete && typeof aOnComplete == 'function')
				aOnComplete();
		}
	};
	aBrowser.addProgressListener(listener);
	window.setTimeout(function() {
		if (!listener.started)
			listener.onFinish();
	}, 0);
},
 
// テスト用のFirefoxウィンドウの現在のタブにURIを読み込む 
loadURI : function(aURI, aOptions)
{
	if (!aOptions) aOptions = {};

	if (!aURI) aURI = 'about:blank';
	aURI = this.fixupIncompleteURI(aURI);

	var completedFlag = this.loadURIInternal(aURI, aOptions);
	if (!aOptions.async) this._utils.wait(completedFlag);
	return completedFlag;
},
	
loadURIInternal : function(aURI, aOptions) 
{
	var loadedFlag = { value : false };

	var b = this._testFrame;
	if (!aOptions.inFrame) {
		var win = this.getTestWindow(aOptions);
		if (win) b = win.gBrowser;
	}
	if (!b) return { value : true };
	b.stop();
	window.setTimeout(function(aSelf) {
		aSelf._waitBrowserLoad(null, b, loadedFlag);
		b.loadURI(aURI, aOptions.referrer || null);
	}, 0, this);

	return loadedFlag;
},
  
loadURIInTestFrame : function(aURI, aOptions) 
{
	if (!aOptions) aOptions = {};
	aOptions.inFrame = true;
	return this.loadURI(aURI, aOptions);
},
 
// テスト用のFirefoxウィンドウで新しいタブを開く 
addTab : function(aURI, aOptions)
{
	if (!aOptions) aOptions = {};

	if (this._utils.product != 'Firefox') return { value : true, tab : null };

	if (!aURI) aURI = 'about:blank';
	aURI = this.fixupIncompleteURI(aURI);

	var completedFlag = this.addTabInternal(aURI, aOptions);
	if (!aOptions.async) this._utils.wait(completedFlag);
	return completedFlag;
},
	
addTabInternal : function(aURI, aOptions) 
{
	var loadedFlag = { value : false, tab : null };

	var win = this.getTestWindow(aOptions);
	if (!win) return null;

	var tab = win.gBrowser.addTab();
	tab.linkedBrowser.stop();
	window.setTimeout(function(aSelf) {
		aSelf._waitBrowserLoad(tab, tab.linkedBrowser, loadedFlag, function() {
			loadedFlag.tab = tab;
			if (aOptions.selected) {
				win.gBrowser.selectedTab = tab;
			}
		});
		tab.linkedBrowser.loadURI(aURI, aOptions.referrer || null);
	}, 0, this);

	return loadedFlag;
},
  
getBrowser : function(aOptions) 
{
	if (this._utils.product != 'Firefox') return null;
	return this.getTestFrameOwner(aOptions);
},
 
getTestFrameOwner : function(aOptions) 
{
	var win = this.getTestWindow(aOptions);
	if (!win || !win.gBrowser) return this._testFrame;
	return win.gBrowser;
},
 
getTabs : function(aOptions) 
{
	if (this._utils.product != 'Firefox') return [];
	var win = this.getTestWindow(aOptions);
	if (!win) return [];
	return this._utils.$X('descendant::*[local-name()="tab"]', win.gBrowser.mTabContainer);
},
  
// override some functions of utils 
	
include : function(aSource, aEncoding, aScope) 
{
	var allowOverrideConstants = false;

	if (aSource &&
		aEncoding === void(0) &&
		aScope === void(0) &&
		typeof aSource == 'object') { // hash style options
		let options = aSource;
		aSource = options.source || options.uri || options.url ;
		aEncoding = options.encoding || options.charset;
		aScope = options.scope || options.namespace || options.ns;
		allowOverrideConstants = options.allowOverrideConstants;
	}
	else if (typeof aEncoding == 'object') { // for backward compatibility
		let scope = aEncoding;
		aEncoding = aScope;
		aScope = scope;
	}

	return this._utils.include({
			uri : aSource,
			encoding : aEncoding,
			namespace : (aScope || this.environment),
			allowOverrideConstants : allowOverrideConstants
		});
},
 
createDatabaseFromSQLFile : function(aFile, aEncoding, aScope) 
{
	if (aEncoding === void(0)) aEncoding = this._utils.getPref('extensions.uxu.defaultEncoding');
	return this._utils.createDatabaseFromSQLFile.call(this, aFile, aEncoding);
},
 
processTemplate : function(aCode, aScope) 
{
	var env = {};
	if (aScope) {
		for (var i in aScope)
		{
			if (aScope.hasOwnProperty(i))
				env[i] = aScope[i];
		}
	}
	env.__proto__ = this.environment;
	var result = this._utils.processTemplate(aCode, env);
	env.__proto__ = void(0);
	env = null;
	return result;
},
parseTemplate : function() { return this.processTemplate.apply(this, arguments); }, // for backward compatibility
 
$ : function(aNodeOrID, aOwner) 
{
	return this._utils.$(aNodeOrID, aOwner || this.getTestWindow() || this.content);
},
 
getBoxObjectFor : function(aNode) 
{
	if ('getBoxObjectFor' in aNode.ownerDocument)
		return aNode.ownerDocument.getBoxObjectFor(aNode);

	if (!('boxObject' in ns)) {
		Components.utils.import(
			'resource://uxu-modules/lib/boxObject.js',
			ns
		);
	}
	return ns
				.boxObject
				.getBoxObjectFor(aNode);
},
 
log : function() 
{
	var message = Array.slice(arguments).join('\n');
	this._utils.log(message);
	this.fireEvent('Notify', message);
}
  
}; 
  
function WindowWatcherListener(aListener, aTargets, aEnvironment) 
{
	this.listener = aListener;
	this.targets = aTargets || this.defaultTargets;
	if (typeof this.targets == 'string')
		this.targets = [this.targets];
	this.environment = aEnvironment;
}

WindowWatcherListener.prototype = {
	observe : function(aSubject, aTopic, aData)
	{
		if (aSubject != '[object ChromeWindow]')
			return;

		aSubject = aSubject.QueryInterface(Ci.nsIDOMWindow);
		switch (aTopic)
		{
			case 'domwindowopened':
				aSubject.addEventListener('DOMContentLoaded', this, false);
				aSubject.addEventListener('load', this, false);
				return this.onListen(aSubject, aTopic, aData);

			case 'domwindowclosed':
				aSubject.removeEventListener('DOMContentLoaded', this, false);
				aSubject.removeEventListener('load', this, false);
				return this.onListen(aSubject, aTopic, aData);

			default:
				return;
		}
	},
	handleEvent : function(aEvent)
	{
		aEvent.currentTarget.removeEventListener(aEvent.type, this, false);
		this.onListen(aEvent.target.defaultView, aEvent.type, null, aEvent);
	},
	onListen : function(aWindow, aTopic, aData, aEvent)
	{
		if (this.targets.indexOf(aTopic) < 0)
			return;

		try {
			if (typeof this.listener == 'function')
				this.listener.call(this.environment, aWindow, aTopic);
			else if ('observe' in this.listener)
				this.listener.observe(aWindow, aTopic, aData);
			else if ('handleEvent' in this.listener)
				this.listener.handleEvent(
					aEvent ||
					{ type : aTopic,
					  target : aWindow,
					  originalTarget : aWindow,
					  currentTarget : aWindow }
				);
			else if ('on'+aTopic in this.listener)
				this.listener['on'+aTopic](aWindow);
		}
		catch(e) {
			this.environment.log(e);
		}
	},
	defaultTargets : ['load', 'domwindowclosed']
};
	
WindowWatcherListener.find = function(aListener, aListeners) { 
	for (var i in aListeners)
	{
		if (aListeners[i] == aListener ||
			aListeners[i].listener == aListener)
			return aListeners[i];
	}
	return null;
};
   
