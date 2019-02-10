/*global QUnit*/

sap.ui.define([
	"com/sap/PharmaTrace00/controller/lookup.controller"
], function (oController) {
	"use strict";

	QUnit.module("lookup Controller");

	QUnit.test("I should test the lookup controller", function (assert) {
		var oAppController = new oController();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});