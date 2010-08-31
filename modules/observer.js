/**
 * Copyright (C) 2010 by ClearCode Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.	See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA	02110-1301 USA
 *
 * Author: ClearCode Inc. http://www.clear-code.com/
 */

if (typeof window == 'undefined')
	this.EXPORTED_SYMBOLS = ['Observer'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const ObserverService = Cc['@mozilla.org/observer-service;1']
			.getService(Ci.nsIObserverService);

function Observer()
{
	this.clear();
}

Observer.prototype = {
	get lastSubject() {
		return this.subjects.length ? this.subjects[this.subjects.length-1] : null ;
	},
	get lastTopic() {
		return this.topics.length ? this.topics[this.topics.length-1] : null ;
	},
	get lastData() {
		return this.data.length ? this.data[this.data.length-1] : null ;
	},
	get count() {
		return this.subjects.length;
	},

	observe : function(aSubject, aTopic, aData)
	{
		this.subjects.push(aSubject);
		this.topics.push(aTopic);
		this.data.push(aData);
	},

	startObserve : function(aTopic)
	{
		ObserverService.addObserver(this, aTopic, false);
	},

	endObserve : function(aTopic)
	{
		ObserverService.removeObserver(this, aTopic);
	},

	stopObserve : function(aTopic)
	{
		this.endObserve(aTopic);
	},

	clear : function()
	{
		this.subjects = [];
		this.topics = [];
		this.data = [];
	}
};

