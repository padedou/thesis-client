/* jshint esversion: 6 */

/*
*	Author: Paschalis Dedousis - padedou [at] gmail [dot] com
*/

var x3dash = x3dash || {};

x3dash.Player = function(){
	var instance = {};

	var modelReferences = [];
	var vcdiff = new diffable.Vcdiff();

	// Add a reference to the adaptable model.

	instance.addModel = function(_id, _mpdURL){
		for(var currentReference of modelReferences){
			if(currentReference.id === _id){
				console.log("The model with ID: " + _id + " is already referenced");
				return;
			}
		}

		modelReferences.push({id: _id, mpdURL: _mpdURL});
	};

	instance.start = function(){
		loadMPDs();
	};

	instance.getModelReferences = function(){
		return modelReferences;
	};

	function loadMPDs(){
		var loadingProcessObserver = {};

		loadingProcessObserver.totalSuccessful = 0;
		loadingProcessObserver.totalFailed = 0;

		loadingProcessObserver.notifyLoadDone = function(_status, _message){
			if(_status === "success"){
				loadingProcessObserver.totalSuccessful++;
			}else{
				loadingProcessObserver.totalFailed++;
				console.log(_message);
			}

			if(loadingProcessObserver.totalSuccessful === modelReferences.length){
				console.log("Downloading MPDs completed successfully.");
				initScene();
			}
			else if((loadingProcessObserver.totalSuccessful + loadingProcessObserver.totalFailed) === modelReferences.length){
				console.log("Could not dowload all the MPDs - successful: " + loadingProcessObserver.totalSuccessful + ", failed: " + loadingProcessObserver.totalFailed);
			}
		};

		for(var currentReference of modelReferences){
			var loadable = new x3dash.Loadable(loadingProcessObserver, currentReference);
		}
	}

	// function based on https://github.com/x3dom/x3dom/issues/382

	function initScene(){
		// Holds the ready status of the adaptable model elements.
		// [{id, ready(true/false)}];

		var x3dDomElements = [];

		for(var currentModel of modelReferences){
			x3dDomElements.push({
				id: currentModel.id,
				ready: false
			});
		}

		initLoop();
		
		function initLoop(){
			var elementsReadyCount = 0;

			console.log("Waiting for X3D to initialize");

			// Check if x3d elements are ready.

			for(var currentDomElement of x3dDomElements){
				if(currentDomElement.ready === false){
					var queringID = "#" + currentDomElement.id + "__ifs_transform";
					if($(queringID).length > 0){
						currentDomElement.ready = true;
					}
				}
			}

			// Count how many x3d elements are ready.

			for(var currentDomElement of x3dDomElements){
				if(currentDomElement.ready){
					elementsReadyCount++;
				}
			}

			if(elementsReadyCount === x3dDomElements.length){
				play();
			}else{
				window.requestAnimationFrame(initLoop);
			}
		}

	}

	/*
	* The play function is in "showcase" mode at the moment.
	* That means that changing the model's LOD is made randomly in some time intervals.
	*
	* Adapting the model in the appropriate LOD for the client's runtime performance is not a trivial problem and spans
	* way out of this thesis's scope.
	*/

	function play(){
		// Reminder: Quality ranking 0 is the lowest LOD.

		var firstDownloadCounter = 0;

		console.log("play function not fully implemented yet");

		addDomAttributes();

		beginFirstDownload();

		function addDomAttributes(){

			for(var currentModelReference of modelReferences){
				var queringID = "#" + currentModelReference.id + "__ifs_transform";
				var domTransform = $(queringID);
				var domIndexedFaceSet = domTransform.find("IndexedFaceSet")[0];
				var attrCoordIndex = $(domIndexedFaceSet).attr("coordIndex");
				var domCoordinate = $(domIndexedFaceSet).find("Coordinate");
				var attrPoint = $(domCoordinate).attr("point");

				currentModelReference.dom = {};

				currentModelReference.dom.id = queringID;
				currentModelReference.dom.IndexedFaceSet = domIndexedFaceSet;
				currentModelReference.dom.Coordinate = domCoordinate;
			}
		}

		function beginFirstDownload(){
			var downloadObserver = {};

			downloadObserver.counterSuccess = 0;
			downloadObserver.counterFailed = 0;
			downloadObserver.notifyDone = function(_status){
				if(_status === "success"){
					downloadObserver.counterSuccess++;
				}else{
					downloadObserver.counterFailed++;
				}

				if(downloadObserver.counterSuccess === modelReferences.length){

					/*
					*	TODO overview:
					*
					*	1 - Update the model geometries. // Done
					* 2 - Update the currentQualityRanking property. // Done
					* 3 - Go to the "showcase loop".
					*/

					console.log("First time geometry download. All model geometries downloaded");

					for(var currentModelReference of modelReferences){
						$(currentModelReference.dom.Coordinate).attr("point", currentModelReference.geometry.vertices);
						$(currentModelReference.dom.IndexedFaceSet).attr("coordIndex", currentModelReference.geometry.faces);
					}

					addLodChangeFunctionality();
					startShowCase();

				}else if(downloadObserver.counterSuccess + downloadObserver.counterFailed === modelReferences.length){
					console.log("Failed to download some model geometries");
				}
			};

			for(var currentModelReference of modelReferences){
				var requestingURL = currentModelReference.directions.baseURLs[0];

				currentModelReference.currentQualityRanking = -1;
				
				for(var representation of currentModelReference.directions.representations){
					if(representation.qualityRanking === '0'){
						requestingURL += representation.baseURL;
						requestingURL += "?currentQR=" + currentModelReference.currentQualityRanking;
						break;
					}
				}


				// This is a workaround because somehow the model refence will point only to the last appended one.

				downloadGeometry(downloadObserver, requestingURL, currentModelReference);
				
				function downloadGeometry(_observer, _requestingURL, _modelReference){
					$.ajax({
					url: _requestingURL,
					method: "GET",
					dataType: "json",
					crossDomain: true,
					success: function(_data){
						// Possible optimization here.
						// Geometry should only be kept in the dom.

						_modelReference.currentQualityRanking = 0;

						_modelReference.geometry = {};
						_modelReference.geometry.vertices = _data.vertices;
						_modelReference.geometry.faces = _data.faces;
						_observer.notifyDone("success");
					},
					error: function(_jqXHR, _textStatus, _errorThrown){
						_observer.notifyDone("failed");
					}
				});				
				}
			}
		}

		function addLodChangeFunctionality(){
			for(currentModel of modelReferences){

				currentModel.maxQualityRanking = 0;

				for(var currentQR of currentModel.directions.representations){
					var qr = parseInt(currentQR.qualityRanking, 10);

					if(qr > currentModel.maxQualityRanking){
						currentModel.maxQualityRanking = qr;
					}
				}

				currentModel.changeLOD = function(_requestingQR, _observer){
					var requestingQRString = "" + _requestingQR;
					var requestingURL = this.directions.baseURLs[0];
					var thisModel = this;

					//currentModelReference.currentQualityRanking = -1;
				
					for(var representation of this.directions.representations){
						if(representation.qualityRanking === requestingQRString){
							requestingURL += representation.baseURL;
							requestingURL += "?currentQR=" + this.currentQualityRanking;
							break;
						}
					}

					$.ajax({
						url: requestingURL,
						method: "GET",
						dataType: "json",
						crossDomain: true,
						success: function(_data){
							function updateLOD(){
								var currentFaces = $(thisModel.dom.IndexedFaceSet).attr("coordIndex");
								var currentVertices = $(thisModel.dom.Coordinate).attr("point");
								var updatedFaces = vcdiff.decode(currentFaces, _data.faces);
								var updatedVertices = vcdiff.decode(currentVertices, _data.vertices);

								$(thisModel.dom.Coordinate).attr("point", updatedVertices);
								$(thisModel.dom.IndexedFaceSet).attr("coordIndex", updatedFaces);

								thisModel.currentQualityRanking = _requestingQR;
			
								_observer.notifyDone("success");
							}

							setTimeout(updateLOD, 1000);
							//setTimeout(requestAnimationFrame(updateLOD), 2000);
						},
						error: function(_jqXHR, _textStatus, _errorThrown){
							//_observer.notifyDone("error", _adaptableModel.mpdURL + " - " + _textStatus + " - " + _errorThrown);
							_observer.notifyDone("error");
						}
					});
				}
			}
		}

		// startShowCase should be renamed to something like addShowCaseFunction

		function startShowCase(){

			var LODChanger = function(_modelReference){
				var instance = {};

				var modelReference = _modelReference;
				var ascending = true;
				var lodObserver = {};

				lodObserver.notifyDone = function(_status){
					if(_status === "success"){
						requestAnimationFrame(showCaseLoop);
						//setTimeout(requestAnimationFrame(showCaseLoop), 5000);
					}
				};

				instance.start = function(){
					showCaseLoop();
				};

				function showCaseLoop(){
					if(ascending){
						if(modelReference.maxQualityRanking >= modelReference.currentQualityRanking + 1){
							modelReference.changeLOD(modelReference.currentQualityRanking + 1, lodObserver);
						}else{
							ascending = false;
							requestAnimationFrame(showCaseLoop);
						}
					}else{
						if(modelReference.currentQualityRanking - 1 >= 0){
							modelReference.changeLOD(modelReference.currentQualityRanking - 1, lodObserver);
						}else{
							ascending = true;
							requestAnimationFrame(showCaseLoop);
						}
					}
				}

				//requestAnimationFrame(showCaseLoop);
				return instance;
			};

			var lodChangers = [];

			for(var currentModel of modelReferences){
				lodChangers.push(new LODChanger(currentModel));
			}

			for(currentLodChanger of lodChangers){
				currentLodChanger.start();
			}
		}
	}

	return instance;
};

/*
*	Class for keeping the directions found in MPD xml file.
*	Currently only simple MPD structures are supported.
* For reference read the K. Kapetanaki's sample MPD.
*/

x3dash.MPDDirections = function (){
	var instance = {};

	// Array of strings, representing the BaseURL node values.

	instance.baseURLs = [];

	/*
	*	Array of objects which describe a Representation node.
	* {id, qualityRanking, baseURL[]}
	*/

	instance.representations = [];

	return instance;
};

/*
*	Class for loading an MPD and notify an observer when load completed.
* When MPD loads, it is parsed.
*/

x3dash.Loadable = function(_observer, _adaptableModel){
	var instance = {};

	$.ajax({
		url: _adaptableModel.mpdURL,
		method: "GET",
		crossDomain: true,
		dataType: "xml",
		success: function(_data){
			_adaptableModel.directions = parseMPD(_data);
			_observer.notifyLoadDone("success");
		},
		error: function(_jqXHR, _textStatus, _errorThrown){
			_observer.notifyLoadDone("error", _adaptableModel.mpdURL + " - " + _textStatus + " - " + _errorThrown);
		}
	});

	function parseMPD(_docMPD){
		var mpdDirections = new x3dash.MPDDirections();
		var nodeRoot = _docMPD.getElementsByTagName("MPD")[0];
		var nodePeriod = nodeRoot.getElementsByTagName("Period")[0];
		var nodeAdaptationSet = nodePeriod.getElementsByTagName("AdaptationSet")[0];

		for(var currentNode of nodeRoot.childNodes){
			if(currentNode.nodeName === "BaseURL"){
				mpdDirections.baseURLs.push(currentNode.textContent);
			}
		}

		for(var currentNode of nodeAdaptationSet.childNodes){
			if(currentNode.nodeName === "Representation"){
				var representation = {};
				
				representation.baseURL = [];
				representation.id = currentNode.attributes["id"].textContent || "";
				representation.qualityRanking = currentNode.attributes["qualityRanking"].textContent || "";

				for(var representationBaseURL of currentNode.childNodes){
					if(representationBaseURL.nodeName === "BaseURL"){
						representation.baseURL.push(representationBaseURL.textContent);
					}
				}
				
				mpdDirections.representations.push(representation);
			}
		}

		return mpdDirections;
	}

	return instance;
};

