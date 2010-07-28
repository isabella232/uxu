// -*- indent-tabs-mode: t; tab-width: 4 -*- 

var utils = {};
Components.utils.import('resource://uxu-modules/utils.js', utils);
utils = utils.utils;

var Observer = {};
Components.utils.import('resource://uxu-modules/observer.jsm', Observer);
Observer = Observer.Observer;

function constructor() 
{
	this.__proto__.__proto__ = Observer.prototype;
	this.clear();
	this.startObserve('uxu:mail:sent');
}

function destroy()
{
	this.clear();
	this.endObserve('uxu:mail:sent');
}

function observe(aSubject, aTopic, aData)
{
	this.subjects.push(aSubject);
	this.topics.push(aTopic);
	aData = utils.evalInSandbox(aData);
	this.data.push(aData);
}
