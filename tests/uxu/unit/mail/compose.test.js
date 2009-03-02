var targetProduct = 'Thunderbird';

var topDir = baseURL+'../../../../';

utils.include(topDir+'content/uxu/lib/module_manager.js');

var mail_module = new ModuleManager([topDir+'content/uxu/mail']);
var ComposeClass;
var compose;
var composeWindow;

function closeAllComposeWindows()
{
	utils.getChromeWindows({ type : 'msgcompose' })
		.forEach(function(aWindow) {
			composeWindow.SetContentAndBodyAsUnmodified();
			composeWindow.MsgComposeCloseWindow(true);
		}, this);
}

function setUp()
{
	closeAllComposeWindows();

	ComposeClass = mail_module.require('class', 'compose');
	compose = new ComposeClass(utils.mail, utils);
	yield Do(compose.setUp());
	composeWindow = compose.window;
}

function tearDown()
{
	utils.tearDownTestWindow();
	if (compose) {
		compose.destroy();
	}
	compose = null;
	closeAllComposeWindows();
}

testWindowOperations.setUp = function()
{
	compose.tearDown();
}
function testWindowOperations()
{
	assert.isNull(compose.window);
	assert.equals(0, compose.windows.length);
	assert.isNull(utils.getTestWindow());

	assert.isFunction(compose.setUp);
	yield Do(compose.setUp());

	assert.isNotNull(utils.getTestWindow());
	var composeWindow = compose.window;
	assert.isNotNull(composeWindow);
	assert.equals(1, compose.windows.length);
	assert.equals(composeWindow, compose.windows[0]);

	assert.isFunction(compose.tearDown);
	compose.tearDown();

	assert.isNull(utils.getTestWindow());
	assert.isNull(compose.window);
	assert.equals(0, compose.windows.length);


	yield Do(compose.setUp());
	assert.isNotNull(utils.getTestWindow());
	assert.isNotNull(compose.window);

	assert.isFunction(compose.tearDownAll);
	compose.tearDownAll();

	assert.isNull(utils.getTestWindow());
	assert.isNull(compose.window);
}

function testAddressFields()
{
	var expression = '//*[@id="addressingWidget"]/descendant::*[local-name()="textbox"]';
	var nodes = $X(expression, composeWindow.document);
	assert.equals(1, nodes.length);
	assert.equals(nodes, compose.addressFields);
	assert.equals(nodes[0], compose.lastAddressField);

	action.inputTextToField(nodes[0], 'test@example.com');
	yield 500;
	action.fireKeyEventOnElement(nodes[0], { keyCode : Ci.nsIDOMKeyEvent.DOM_VK_RETURN });
	yield 200;

	nodes = $X(expression, composeWindow.document);
	assert.equals(2, nodes.length);
	assert.equals(nodes, compose.addressFields);
	assert.equals(nodes[1], compose.lastAddressField);

	compose.tearDown();
	assert.isNull(compose.window);
	assert.raises(compose.ERROR_NO_COMPOSE_WINDOW, function() {
		compose.addressFields;
	});
	assert.raises(compose.ERROR_NO_COMPOSE_WINDOW, function() {
		compose.lastAddressField;
	});
}

function testAddressTypes()
{
	var expression = '//*[@id="addressingWidget"]/descendant::*[local-name()="menulist"]';
	var nodes = $X(expression, composeWindow.document);
	assert.equals(1, nodes.length);
	assert.equals(nodes, compose.addressTypes);
	assert.equals(nodes[0], compose.lastAddressType);

	var field = $X('//*[@id="addressingWidget"]/descendant::*[local-name()="textbox"]', composeWindow.document, XPathResult.FIRST_ORDERED_NODE_TYPE);
	assert.isNotNull(field);
	action.inputTextToField(field, 'test@example.com');
	yield 500;
	action.fireKeyEventOnElement(field, { keyCode : Ci.nsIDOMKeyEvent.DOM_VK_RETURN });
	yield 200;

	nodes = $X(expression, composeWindow.document);
	assert.equals(2, nodes.length);
	assert.equals(nodes, compose.addressTypes);
	assert.equals(nodes[1], compose.lastAddressType);

	compose.tearDown();
	assert.isNull(compose.window);
	assert.raises(compose.ERROR_NO_COMPOSE_WINDOW, function() {
		compose.addressTypes;
	});
	assert.raises(compose.ERROR_NO_COMPOSE_WINDOW, function() {
		compose.lastAddressType;
	});
}

function testDummyRows()
{
	var nodes = $X('//*[@id="addressingWidget"]/descendant::*[@class="dummy-row"]', composeWindow.document);
	assert.equals(3, nodes.length);
	assert.equals(nodes, compose.dummyRows);
	assert.equals(nodes[0], compose.firstDummyRow);

	compose.tearDown();
	assert.isNull(compose.window);
	assert.raises(compose.ERROR_NO_COMPOSE_WINDOW, function() {
		compose.dummyRows;
	});
	assert.raises(compose.ERROR_NO_COMPOSE_WINDOW, function() {
		compose.firstDummyRow;
	});
}

function testRecipients()
{
	assert.equals([], compose.recipients);

	var addresses = [
			{ type : 'to', address : 'to@example.com' },
			{ type : 'cc', address : 'cc@example.com' },
			{ type : 'bcc', address : 'bcc@example.com' },
			{ type : 'reply-to', address : 'reply@example.com' },
			{ type : 'followup-to', address : 'followup@example.com' }
		];
	compose.recipients = addresses;

	var fields = compose.addressFields;
	assert.equals(addresses.length+1, fields.length);
	var types = compose.addressTypes;
	assert.equals(addresses.length+1, types.length);
	addresses.forEach(function(aAddress, aIndex) {
		let type = types[aIndex].value.split('_')[1];
		if (type == 'reply' || type == 'followup') type += '-to';
		assert.equals(aAddress.type, type, inspect(aAddress)+'\n'+types[aIndex].value);
		assert.equals(aAddress.address, fields[aIndex].value, inspect(aAddress)+'\n'+fields[aIndex].value);
	})

	assert.equals(addresses, compose.recipients);

	compose.tearDown();
	assert.isNull(compose.window);
	assert.raises(compose.ERROR_NO_COMPOSE_WINDOW, function() {
		compose.recipients;
	});
}

function testSubject()
{
	var field = composeWindow.document.getElementById('msgSubject');
	assert.equals('', compose.subject);
	assert.equals('', field.value);
	compose.subject = 'test subject';
	assert.equals('test subject', compose.subject);
	assert.equals('test subject', field.value);

	compose.tearDown();
	assert.isNull(compose.window);
	assert.raises(compose.ERROR_NO_COMPOSE_WINDOW, function() {
		compose.subject;
	});
}

/*
function testBody()
{
	assert.equals($('content-frame', composeWindow.document).contentDocument.body, compose.body);

	compose.tearDown();
	assert.isNull(compose.window);
	assert.raises(compose.ERROR_NO_COMPOSE_WINDOW, function() {
		compose.body;
	});
}

function testAttachments()
{
	assert.equals([], compose.attachments);

	compose.tearDown();
	assert.isNull(compose.window);
	assert.raises(compose.ERROR_NO_COMPOSE_WINDOW, function() {
		compose.attachments;
	});
}
*/
