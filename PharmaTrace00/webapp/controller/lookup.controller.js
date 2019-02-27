sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/m/Dialog"
], function (Controller, MessageToast, Dialog) {
	"use strict";
	
	var accessToken = "";
	var ml_clientId = "sb-e56c1387-f909-43af-b3f9-27b701bde488!b11004|ml-foundation-xsuaa-std!b540";
	var ml_clientSecret = "QH7mvEkCF+49My230B6GCMdtjvw=";
	var bs_clientId = "sb-57fcb2d1-0f09-4823-8c37-7f22e736040b!b11004|na-420adfc9-f96e-4090-a650-0386988b67e0!b1836";
	var bs_clientSecret = "fezRGDTEDDySqIK64PHx2X4ENtQ=";
	var form = new FormData();
	var productMaster = {};
	var scanImageResult,drugName,gtin,manufacturerName,serialNo,batchNo;
	
	return Controller.extend("com.sap.PharmaTrace00.controller.lookup", {
		onInit: function () {
			this.getView().byId("fileUploader").addStyleClass("fileUploaderStyle1");
			
			var oModel1 = new sap.ui.model.json.JSONModel();
			oModel1.setDefaultBindingMode("TwoWay");
			this.getView().setModel(oModel1);
		},

		handleValueChange: function (oEvent) {
			// keep a reference in the view to close it later
			var oBusyIndicator = new sap.m.BusyDialog();
			var oView = this.getView();

			var reader = new FileReader();
			reader.onloadend = function () {
				// var model = oView.getModel().getData();
				// model.image = reader.result;
				// oView.getModel().refresh();
				
				oView.byId("fileUploader").addStyleClass("fileUploaderStyle2");
				oView.byId("uploadBox").setJustifyContent(null);
				oView.byId("flexBoxHint").setVisible(false);
				oView.byId("uploadBox").addStyleClass("workListBox2");
				oView.byId("vBoxImage").setVisible(true);
				
				oView.getModel().setProperty("/image", reader.result);
			};

			reader.readAsDataURL(oEvent.getParameters().files[0]);
			this.callAPI(oEvent.getParameters().files[0], oView, oBusyIndicator);
		},

		callAPI: function (file, oView, oBusyIndicator) {
			oBusyIndicator.open();
			//var form = new FormData();
			form.append("files", file);
			var that = this;
			this.invokeMLService(file, oView, oBusyIndicator, that).then(
				function(data){
					that.invokeHANAService(file, oView, oBusyIndicator, that).then(
						function(){
							that.invokeHyperLedgerService(file, oView, oBusyIndicator, that).then(
								function(){
									oBusyIndicator.close();
								});
						}
					);
				}
			);

		},

		invokeMLService: function (file, oView, oBusyIndicator, that) {
			
			return new Promise(function(mainResolve, mainReject){
				
				var getMLAccessToken = new Promise(function(resolve, reject) {
				// Obtain access token for ML Service
					$.ajax({
						url: "/mltoken?grant_type=client_credentials",
						type: "GET",
						contentType: "application/json",
						dataType: "json",
						async: true,
						beforeSend: function (xhr) {
							xhr.setRequestHeader("Authorization", "Basic " + btoa(ml_clientId + ":" + ml_clientSecret));
						},
						success: function (response) {
							resolve(response.access_token);
							//accessToken = response.access_token;
						}
					});
				});
				
				
				var invokeMLOCRService = function(sToken){
					return new Promise(function(resolve, reject) {
						// Invoke ML OCR service API using access token to scan label
						$.ajax({
							url: /mlservice/,
							type: "POST",
							beforeSend: function (xhr) {
								xhr.setRequestHeader("Authorization", "Bearer " + sToken);
							},
							data: form,
							async: false,
							processData: false,
							contentType: false,
							success: function (data) {
								resolve(data);
							},
							error: function (request, status, error) {
								MessageToast.show("Caught - [ajax error] :" + request.responseText);
							}
						});
					});
				};
				
				getMLAccessToken.then(
					function(data){
						accessToken = data;
						invokeMLOCRService(data).then(
							function(data2){
								try {
									scanImageResult = data2.predictions[0];
									scanImageResult = scanImageResult.split("\n");
									manufacturerName = scanImageResult[0];
									for (var i = 0; i < 12; i++) {
										if ((scanImageResult[i].substr(0, 7)) == "Product") {
											drugName = scanImageResult[i].substr(9);
										}
										if ((scanImageResult[i].substr(0, 4)) == "GTIN") {
											gtin = scanImageResult[i].substr(5);
										}
										if ((scanImageResult[i].substr(0, 4)) == "SSCC") {
											serialNo = scanImageResult[i].substr(5);
										}
										if ((scanImageResult[i].substr(0, 5)) == "Batch") {
											batchNo = scanImageResult[i].substr(6);
										}
										
										mainResolve(true);
									}
								} catch (err) {
									MessageToast.show("Caught - [ajax error] :" + err.message);
									mainReject(err);
								}
							}
						);
					}
				);
			});
		},

		invokeHANAService: function (file, oView, oBusyIndicator, that) {
			
			return new Promise(
				function(mainResolve, mainReject){
					// Invoke the HANA service API to obtain master data of scanned product
					$.ajax({
						url: "/hanaservice/" + "Drugs('" + gtin.trim() + "')",
						type: "GET",
						async: true,
						contentType: "application/json",
						dataType: "json",
						success: function (response) {
							if (response.d) {
								productMaster.Id = response.d.GTIN;
								productMaster.name = response.d.name;
								productMaster.supplierName = response.d.supplier;
								productMaster.category = response.d.category;
								productMaster.unitPrice = response.d.unitPrice;
								productMaster.unitsInStock = response.d.unitInStock;
								
								//var oView = that.getView();
		
								oView.byId("manufacturerID").setText(manufacturerName);
								oView.byId("gtin").setText(gtin);
								oView.byId("drugName").setText(drugName);
								oView.byId("productID").setText(productMaster.Id);
								oView.byId("productName").setText(productMaster.name);
								oView.byId("supplierName").setText(productMaster.supplierName);
								oView.byId("category").setText(productMaster.category);
								oView.byId("unitPrice").setText(productMaster.unitPrice);
								oView.byId("unitsInStock").setText(productMaster.unitsInStock);
								
								mainResolve(true);
							}
						},
					});
				}
			);
		},

		invokeHyperLedgerService: function (file, oView, oBusyIndicator, that) {
			return new Promise(
				function(mainResolve, mainReject){
					
					var getHLToken = new Promise(function(resolve, reject) {
						// Obtain access token for the Blockchain service
						$.ajax({
							url: "/blockchaintoken?grant_type=client_credentials",
							type: "GET",
							contentType: "application/json",
							dataType: "json",
							async: true,
							beforeSend: function (xhr) {
								xhr.setRequestHeader("Authorization", "Basic " + btoa(bs_clientId + ":" + bs_clientSecret));
							},
							success: function (response) {
								resolve(response.access_token);
							},
							// timeout: 5000
						});
					});
					
					var callHLServices = function(accessToken){
						return new Promise(
							function(resolve2, reject2){
								//Generate random unique number for the transaction
								var transactionId = Math.floor(Math.random() * 99999999);
								var currentDate = new Date(Date.now()).toLocaleString().split(',')[0];
								
								oView.byId("manufacturerID").setText(manufacturerName);
								oView.byId("gtin").setText(gtin);
								oView.byId("drugName").setText(drugName);
								
								//Construct the payload
								var payload = {
									"ID": transactionId,
									"assetType": "Asset.Serial",
									"manufacturerId": manufacturerName,
									"batchNo": batchNo,
									"serialNo": serialNo,
									"manufacturingDate": currentDate,
									"scanNo": "01",
									"scanBy": "Manufacturer",
									"alias": drugName,
									"description": drugName
								};
								
								//Invoke the Hyperledger fabric API to update a record in the blockchain network
								$.ajax({
									url: "/blockchainservice",
									type: "POST",
									beforeSend: function (xhr) {
										xhr.setRequestHeader("Authorization", "Bearer " + accessToken);
									},
									contentType: "application/json",
									dataType: "text",
									processData: false,
									data: JSON.stringify(payload),
									async: false,
									success: function (data) {
										try {
											MessageToast.show("Record has been updated in Blockchain successfully");
										    //Retrive the newly added transaction
											$.ajax({
												url: "/blockchainservice/" + transactionId,
												type: "GET",
												beforeSend: function (xhr) {
													xhr.setRequestHeader("Authorization", "Bearer " + accessToken);
												},
												async: true,
												success: function (data) {
													resolve2(data);
												},
												error: function (request, status, error) {
													oBusyIndicator.close();
													MessageToast.show("Caught - [ajax error] :" + request.responseText);
													reject2(request.responseText);
												}
											});
					
										} catch (err) {
											oBusyIndicator.close();
											MessageToast.show("Caught - [ajax error] :" + err.message);
										}
									},
									error: function (request, status, error) {
										oBusyIndicator.close();
										MessageToast.show("Caught - [ajax error] :" + request.responseText);
										reject2(request.responseText);
									}
								});
							}
						); 
					};
					
					getHLToken.then(
						function(data){
							callHLServices(data).then(
								function(data2){
									try {
										var results = data2;
										var p1 = {
											reviews: []
										};
	
										p1.reviews.push({
											"manufacturer": results.manufacturerId,
											"pname": results.alias,
											"batchno": results.batchNo,
											"scanno": results.scanNo,
											"serialno": results.serialNo,
										});
	
										that.getView().getModel().setProperty("/reviews", p1.reviews);
										mainResolve(true);
	
									} catch (err) {
										oBusyIndicator.close();
										MessageToast.show("Caught - [ajax error] :" + err.message);
										mainReject(err.message);
									}
								}
							);
						}
					);
				}
			);
			
		},

		handleRouteMatched: function (oEvent) {
			var oParams = {};

			if (oEvent.mParameters.data.context) {
				this.sContext = oEvent.mParameters.data.context;
				var oPath;
				if (this.sContext) {
					oPath = {
						path: "/" + this.sContext,
						parameters: oParams
					};
					this.getView().bindObject(oPath);
				}
			}
		}
	});
});