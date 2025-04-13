/*global QUnit*/

sap.ui.define([
	"syncroad/ripening/controller/ripen.controller"
], function (Controller) {
	"use strict";

	QUnit.module("ripen Controller");

	QUnit.test("I should test the ripen controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
