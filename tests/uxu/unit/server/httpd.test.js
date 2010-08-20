var shouldSkip = utils.checkPlatformVersion('1.9') < 0;

var topDir = baseURL+'../../../../';
var fixtures = baseURL+'../../fixtures/';

var HTTPServer = utils.import(topDir+'modules/server/httpd.js', {}).HTTPServer;
var bundle = utils.import(topDir+'modules/lib/stringBundle.js', {})
				.stringBundle.get('chrome://uxu/locale/uxu.properties');

var htaccess;
var server;

function assertModified(aStatus, aStatusText, aURI, aPath)
{
	var result = HTTPServer.prototype.processRequestByHtaccess(aPath, htaccess);
	assert.notNull(result);
	assert.equals(
		{ status     : aStatus,
		  statusText : aStatusText, 
		  uri        : aURI },
		result
	);
}

function assertNotModified(aPath)
{
	assert.isNull(HTTPServer.prototype.processRequestByHtaccess(aPath, htaccess));
}

test_processRequestByHtaccess.setUp = function() {
	htaccess = utils.readFrom(fixtures+'redirect/.htaccess');
};
function test_processRequestByHtaccess()
{
	assertModified(301, 'Moved Permanently', 'http://localhost:4445/file',
	               '/redirect/sub/permanent/file');
	assertModified(302, 'Found', 'http://localhost:4445/file',
	               '/redirect/sub/temp/file');
	assertModified(303, 'See Other', 'http://localhost:4445/file',
	               '/redirect/sub/seeother/file');
	assertModified(301, 'Moved Permanently', 'http://localhost:4445/file',
	               '/redirect/sub/permanent2/file');
	assertModified(302, 'Found', 'http://localhost:4445/file',
	               '/redirect/sub/temp2/file');
	assertModified(303, 'See Other', 'http://localhost:4445/file',
	               '/redirect/match/file');
	assertNotModified('/not_redirect/match/file');

	assertModified(200, 'OK', '/file',
	               '/redirect/rewrite/file');
	assertModified(200, 'OK', 'http://localhost:4445/file',
	               '/redirect/rewrite_absolute/file');
	assertModified(200, 'OK', 'http://localhost:4445/file',
	               '/redirect/rewrite_NoCase/file');
	assertModified(200, 'OK', 'http://localhost:4445/file',
	               '/redirect/rewrite_nocase/file');
	assertModified(401, 'Gone', null,
	               '/redirect/rewrite_401/file');
	assertModified(403, 'Forbidden', null,
	               '/redirect/rewrite_403/file');
	assertModified(302, 'Found', 'http://localhost:4445/file',
	               '/redirect/rewrite_redirect/file');
	assertModified(301, 'Moved Permanently', 'http://localhost:4445/file',
	               '/redirect/rewrite_redirect301/file');
	assertModified(302, 'Found', 'http://localhost:4445/file',
	               '/redirect/rewrite_redirect302/file');
	assertModified(303, 'See Other', 'http://localhost:4445/file',
	               '/redirect/rewrite_redirect303/file');
	assertModified(200, 'OK', '/redirect/rewrite_next/file',
	               '/redirect/rewrite_last/file');
	assertModified(200, 'OK', '/redirect/rewrite_final/file',
	               '/redirect/rewrite_next/file');
	assertNotModified('/redirect/not_rewrite/match/file');

	htaccess = '';
	assertNotModified('/redirect/sub/permanent/file');
	assertNotModified('/redirect/sub/temp/file');
	assertNotModified('/redirect/sub/seeother/file');
	assertNotModified('/redirect/sub/permanent2/file');
	assertNotModified('/redirect/sub/temp2/file');
	assertNotModified('/redirect/match/file');
	assertNotModified('/redirect/rewrite/file');
	assertNotModified('/redirect/rewrite_absolute/file');
	assertNotModified('/redirect/rewrite_redirect/file');
}



test_handleRequest_htaccess.setUp = function() {
	server = new HTTPServer(4445, fixtures, utils.mockManager);
	utils.wait(function() {
		return !server.isStopped();
	});
};
test_handleRequest_htaccess.tearDown = function() {
	utils.wait(server.stop());
	server = null;
};
function test_handleRequest_htaccess()
{
	var hashTxt = utils.getFileFromURLSpec(fixtures+'hash.txt');
	hashTxt.normalize();

	var result = server.handleRequest('/hash.txt', server.mServer._handler);
	assert.equals(4, result.length);
	assert.isInstanceOf(Ci.nsIFile, result[2]);
	result[2] = result[2].path;
	assert.equals([true, '/hash.txt', hashTxt.path, 0], result);


	result = server.handleRequest('/notexist', server.mServer._handler);
	assert.equals(4, result.length);
	assert.isInstanceOf(Ci.nsIFile, result[2]);
	result[2] = result[2].path;
	file = utils.getFileFromURLSpec(fixtures+'notexist');
	file.normalize();
	assert.equals([true, '/notexist', file.path, 0], result);


	result = server.handleRequest('/redirect/match/hash.txt', server.mServer._handler);
	assert.equals(4, result.length);
	assert.isNull(result[2]);
	assert.equals([false, '/hash.txt', null, 0], result);


	result = server.handleRequest('/redirect/rewrite/hash.txt', server.mServer._handler);
	assert.equals(4, result.length);
	assert.isInstanceOf(Ci.nsIFile, result[2]);
	result[2] = result[2].path;
	assert.equals([true, '/hash.txt', hashTxt.path, 0], result);
}


test_handleRequest_mock.setUp = function() {
	server = new HTTPServer(4445, fixtures, utils.mockManager);
	utils.wait(function() {
		return !server.isStopped();
	});
};
test_handleRequest_mock.tearDown = function() {
	utils.wait(server.stop());
	server = null;
};
function test_handleRequest_mock()
{
	var hashTxt = utils.getFileFromURLSpec(fixtures+'hash.txt');
	hashTxt.normalize();

	server.expect('/expected-path', '/hash.txt');
	server.expect('/expected-file', hashTxt);
	server.expectThrows('/unknown-file', 404);
	server.expectThrows('/error', 500);

	var result = server.handleRequest('/expected-path', server.mServer._handler);
	assert.equals(4, result.length);
	assert.isInstanceOf(Ci.nsIFile, result[2]);
	result[2] = result[2].path;
	assert.equals([true, '/hash.txt', hashTxt.path, 0], result);

	var result = server.handleRequest('/expected-file', server.mServer._handler);
	assert.equals(4, result.length);
	assert.isInstanceOf(Ci.nsIFile, result[2]);
	result[2] = result[2].path;
	assert.equals([true, '/expected-file', hashTxt.path, 0], result);

	assert.raises(404, function() {
		server.handleRequest('/unknown-file', server.mServer._handler);
	});
	assert.raises(500, function() {
		server.handleRequest('/error', server.mServer._handler);
	});
}


testRedirect.parameters = [
	'http://localhost:4445/redirect/sub/permanent/hash.txt',
	'http://localhost:4445/redirect/sub/temp/hash.txt',
	'http://localhost:4445/redirect/sub/seeother/hash.txt',
	'http://localhost:4445/redirect/sub/permanent2/hash.txt',
	'http://localhost:4445/redirect/sub/temp2/hash.txt',
	'http://localhost:4445/redirect/match/hash.txt'
];
testRedirect.setUp = function() {
	server = new HTTPServer(4445, fixtures);
	utils.wait(function() {
		return !server.isStopped();
	});
};
testRedirect.tearDown = function() {
	utils.wait(server.stop());
	server = null;
};
function testRedirect(aURI)
{
	utils.loadURI(aURI);
	assert.equals('http://localhost:4445/hash.txt', content.location.href);
	assert.equals('hash\n', content.document.body.textContent);
}

testRewrite.parameters = [
	'http://localhost:4445/redirect/rewrite/hash.txt',
	'http://localhost:4445/redirect/rewrite_absolute/hash.txt'
];
testRewrite.setUp = function() {
	server = new HTTPServer(4445, fixtures);
	utils.wait(function() {
		return !server.isStopped();
	});
};
testRewrite.tearDown = function() {
	utils.wait(server.stop());
	server = null;
};
function testRewrite(aURI)
{
	utils.loadURI(aURI);
	assert.equals(aURI, content.location.href);
	assert.equals('hash\n', content.document.body.textContent);
}


testResponseWithDelay.setUp = function() {
	server = new HTTPServer(4445, fixtures, utils.mockManager);
	utils.wait(function() {
		return !server.isStopped();
	});
};
testResponseWithDelay.tearDown = function() {
	utils.wait(server.stop());
	server = null;
};
function testResponseWithDelay()
{
	utils.loadURI('about:blank');

	server.expect('/delayed', { uri : '/hash.txt', delay : 3000 });
	var start = Date.now();
	utils.loadURI('http://localhost:4445/delayed');
	assert.compare(3000, '<=', Date.now() - start);
	assert.equals('/delayed', content.location.href);
	assert.equals('hash\n', content.document.body.textContent);

	utils.loadURI('about:blank');

	server.expect('/delayed', { uri : '/hash.txt', status : 301, delay : 3000 });
	var start = Date.now();
	utils.loadURI('http://localhost:4445/delayed');
	assert.compare(3000, '<=', Date.now() - start);
	assert.equals('/hash.txt', content.location.href);
	assert.equals('hash\n', content.document.body.textContent);
}


