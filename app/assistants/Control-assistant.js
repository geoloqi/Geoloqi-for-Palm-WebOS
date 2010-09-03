function ControlAssistant() {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
	
	this.db = null; // sqlite db handle
	this.settings = null; // Mojo Depot db handle
	this.nullHandleCount = 0;

	this.deviceKey = '1234567890'; // null
	this.dropPositionsTable = false; // if this is set, the internal positions table is dropped every app load
	
	this.trackingEnabled = true;
	this.sendingInterval = 10;
	this.lastSentToServer = new Date();
	this.lastSeenLat = "";
	this.lastSeenLng = "";
}

ControlAssistant.prototype.setup = function() {
	/* this function is for setup tasks that have to happen when the scene is first created */
	
	/* use Luna.View.render to render view templates and add them to the scene, if needed. */
	
	/* setup widgets here */
	
	/* add event handlers to listen to events from widgets */
	
	/* create sqlite database */
	
	try
	{
		this.db = openDatabase('GeoloqiDB', '', 'Geoloqi Data Store', 65536);
		this.controller.info('Opened sqlite database');
	}
	catch(e)
	{
		this.controller.error('Failed to open sqlite database!!');
	}

	this.CreateTable();
	
	/*
	this.settings = new Mojo.Depot({
		name: "Geoloqi Settings",
		estimatedSize: 65536
	}, 
	(function(){
		Mojo.Log.info("Settings db created");
	}).bind(this),
	(function(obj){
		Mojo.Log.info("Settings db failed to be created:", obj);
	}).bind(this));

	
	this.settings.get("deviceKey",
	(function(obj){
		Mojo.Log.info("Retrieved device key", obj);
	}).bind(this));
	*/
	
	this.totalPoints = 0;
	
	this.startTracking();
    
	Mojo.Event.listen(this.controller.get("sendingIntervalSlider"), Mojo.Event.propertyChange, this.handleUpdateSending.bind(this));
    this.controller.setupWidget("sendingIntervalSlider",
		this.attributes = {
			minValue: 10,
			maxValue: 120
		},
		this.model = {
			value: 10,
			disabled: false
		}
	);

	Mojo.Event.listen(this.controller.get("distanceFilterSlider"), Mojo.Event.propertyChange, this.handleUpdateDistance.bind(this));
    this.controller.setupWidget("distanceFilterSlider",
		this.attributes = {
			minValue: 0,
			maxValue: 100
		},
		this.model = {
			value: 3,
			disabled: false
		}
	);

	Mojo.Event.listen(this.controller.get("timeSlider"), Mojo.Event.propertyChange, this.handleUpdateTime.bind(this));
    this.controller.setupWidget("timeSlider",
		this.attributes = {
			minValue: 10,
			maxValue: 120
		},
		this.model = {
			value: 10,
			disabled: false
		}
	);

    Mojo.Event.listen(this.controller.get("trackingBtn"), Mojo.Event.propertyChange, this.handleUpdateTracking.bind(this));
    this.controller.setupWidget('trackingBtn', {
		modelProperty: "value"
	}, {
		value: true
	});
    
	// Set a timer 
	this.setAppTimer();
	this.controller.serviceRequest("palm://com.palm.power/com/palm/power", {
	    method: "activityStart",
	    parameters: {
	        id: "com.geoloqi.geoloqigpstracker.alarm-1",
	        duration_ms: "290000"
	    },
	    onSuccess: (function(){
	    	Mojo.Log.info("Started activity timer");
	    }).bind(this),
	    onFailure: (function(){
	    	Mojo.Log.error("Failed to start activity timer");
	    }).bind(this)
	});

	Mojo.Log.info(typeof this.db);

	this.sendQueuedPointsToServerHandler = this.sendQueuedPointsToServer.bind(this);
};


ControlAssistant.prototype.startTracking = function(){
	// Request continuous location updates
	this.controller.serviceRequest('palm://com.palm.location', {
		method : 'startTracking',
        parameters: {
            subscribe: true
    	},
        onSuccess: this.handleServiceResponse.bind(this),
        onFailure: this.handleServiceResponseError.bind(this)
    });
}


ControlAssistant.prototype.sendQueuedPointsToServer = function(){
	
	var string = 'SELECT * FROM positions ORDER BY date LIMIT 100; GO;';

	var points = [];
	
	this.db.transaction(
        (function (transaction) {
            transaction.executeSql(string, [], (function(transaction, results){
        		for (var i = 0; i < results.rows.length; i++) {
        			var row = results.rows.item(i);
        			Mojo.Log.info(row.date, row.lat, row.lng);
        			points.push(this.buildJSONPoint(row));
        		}

        		this.sendToServer(points);
        		
        		for (var i = 0; i < results.rows.length; i++) {
        			var row = results.rows.item(i);
        			this.deleteLocation(row.date);
        		}
        		
            }).bind(this), this.errorHandler.bind(this));
        }).bind(this)
    );
};


ControlAssistant.prototype.buildJSONPoint = function(row){
	return {
		date: row.date,
		location: {
			position: {
				latitude: row.lat,
				longitude: row.lng,
				altitude: row.altitude,
				heading: row.heading,
				speed: row.velocity,
				horizontal_accuracy: row.hacc,
				vertical_accuracy: row.vacc
			},
			type: "latlng",
			raw: row.other
		},
		client: {
			name: "Geoloqi",
			version: "0.1",
			platform: "Palm WebOS"
		}
	};
};


ControlAssistant.prototype.sendToServer = function(points){
	var posturl='http://api.geoloqi.com/api/location/key/' + this.deviceKey;
	var postdata = Object.toJSON(points);
	 
	var myAjax = new Ajax.Request(posturl, {
	 	method: 'post',
	 	evalJSON: 'force',
	 	postBody: postdata,
	 	contentType: 'application/json',
	 	onComplete: (function(transport){
	 		if (transport.status == 200){
				Mojo.Log.info('Success!');
	 			this.lastSentToServer = new Date();
	 		}
			else {
				Mojo.Log.error('Failed with response ' + Object.toJSON(transport));
			}
	 		Mojo.Log.info('Server Response: ' + transport.responseText);			
	 	}).bind(this),
	 	onFailure: (function(transport){
	 		Mojo.Log.error('Failure! ' + transport.responseText);
	 	}).bind(this)
	});
};


ControlAssistant.prototype.deleteLocation = function(date){
    this.db.transaction( 
        (function (transaction) { 
            transaction.executeSql("DELETE FROM positions WHERE date = '"+ date +"'; GO;", [], (function(tx, results){
            }).bind(this), this.errorHandler.bind(this)); 
        }).bind(this) 
    );
};

ControlAssistant.prototype.handleUpdateSending = function(event){
	Mojo.Log.info("Sending Slider is at:", event.value);
	this.sendingInterval = event.value;
};
ControlAssistant.prototype.handleUpdateDistance = function(event){
	Mojo.Log.info("Distance Slider is at:", event.value);
};
ControlAssistant.prototype.handleUpdateTime = function(event){
	Mojo.Log.info("Time Slider is at:", event.value);
};
ControlAssistant.prototype.handleUpdateTracking = function(event){
	Mojo.Log.info("Updates", event.value);
	this.trackingEnabled = event.value;
}


//This function schedules the timeout task
/*
ControlAssistant.prototype.setAppTimer = function(){
	try
	{
		//parameters for the alarm service call	
		var params = {
			"wakeup": true,
			"key": "geoloqitimer",
			"uri": "palm://com.palm.applicationManager/open",
			"params": '{"id":"com.geoloqi.geoloqigpstracker","params":{"message": "Alarm says send queued points now"}}',
			"in": "00:05:00"
		}
	
	    //set the alarm
		this.controller.serviceRequest('palm://com.palm.power/timeout', { 
			method: "set",
			parameters: params,
			onSuccess:  (function(response){
				Mojo.Log.info("Scheduled timer successfully");
			}).bind(this),
			onFailure: (function(response){
				Mojo.Log.error("Problem setting timer:", Object.toJSON(response));
			}).bind(this)
		});
		
		Mojo.Log.info("Setting alarm for", params["in"]);
	}
	catch(e)
	{
		this.controller.error(e);
	}
}
*/

/*
ControlAssistant.prototype.handleButtonPressed = function(event) {
    this.controller.serviceRequest('palm://com.palm.location', {
		method : 'getCurrentPosition',
        parameters: {
			responseTime: 2,
            subscribe: false
                },
        onSuccess: this.handleServiceResponse.bind(this),
        onFailure: this.handleServiceResponseError.bind(this)
    });
}
*/

ControlAssistant.prototype.handleServiceResponse = function(event) {
	
	if(this.trackingEnabled == false){
		return false;
	}

	// Just ignore duplicate points, if they really are exactly duplicates they're probably not that interesting
	if(this.lastSeenLat == event.latitude && this.lastSeenLng == event.longitude){
		return false;
	}
	
	latitude = event.latitude;
	longitude = event.longitude;

	this.lastSeenLat = latitude;
	this.lastSeenLng = longitude;
	
	$('position_area-to-update').update(((event.latitude * 1000000).round() / 1000000) + ", " + ((event.longitude * 1000000).round() / 1000000));
	this.totalPoints++;

	this.queueLocationPoint(event.latitude, event.longitude, event.heading, event.velocity, event.horizAccuracy, event.vertAccuracy, {type: "continuousUpdates"});
	
	//this.controller.info("Received location", latitude, longitude, this.totalPoints, "points received");
	
	$('num_points-to-update').update(this.totalPoints+" points since program start");
	var timeDiff = new Date() - this.lastSentToServer;

	$('time-to-next-update').update(Math.max(0, Math.round((this.sendingInterval) - (timeDiff/1000))) + " seconds to next push");
	
	// If we're due to send to the server, do that now
	if(timeDiff > (this.sendingInterval * 1000)){
		Mojo.Log.info("GPS point received, seconds since last push to server:", (timeDiff / 1000))
		this.sendQueuedPointsToServer();
	}
	
}
ControlAssistant.prototype.handleServiceResponseError = function(event) {
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
    $('error_area-to-update').update("Get Location Error:"+Object.toJSON(event));
    this.controller.error("Get Location error:", Object.toJSON(event));
}


ControlAssistant.prototype.queueLocationPoint = function(lat, lng, hdg, vel, hacc, vacc, other){
	var otherStr = Object.toJSON(other);
	
	var string = 'INSERT INTO positions (date, lat, lng, heading, velocity, hacc, vacc, other) VALUES ("' 
		+ (new Date()).toISOString() + '","' + lat + '","' + lng + '","' + hdg + '","' + vel + '","' + hacc + '","' + vacc + '",\'' + otherStr + '\'); GO;';
	this.db.transaction( 
        (function (transaction) { 
            transaction.executeSql(string, [], this.createRecordDataHandler.bind(this), this.errorHandler.bind(this)); 
        }).bind(this) 
    );

};


ControlAssistant.prototype.activate = function(event) {
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
};

ControlAssistant.prototype.deactivate = function(event) {
	/* remove any event handlers you added in activate and do any other cleanup that should happen before
	   this scene is popped or another scene is pushed on top */
};

ControlAssistant.prototype.cleanup = function(event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
};

ControlAssistant.prototype.CreateTable = function(event) {

	try {
		this.nullHandleCount = 0;
		var string = 'CREATE TABLE positions ('
			+ 'date TEXT NOT NULL DEFAULT "", '
			+ 'lat TEXT NOT NULL DEFAULT "", '
			+ 'lng TEXT NOT NULL DEFAULT "", '
			+ 'heading TEXT NOT NULL DEFAULT "", '
			+ 'velocity TEXT NOT NULL DEFAULT "", '
			+ 'hacc TEXT NOT NULL DEFAULT "", '
			+ 'vacc TEXT NOT NULL DEFAULT "", '
			+ 'other TEXT NOT NULL DEFAULT ""'
			+ '); GO;'
	    this.db.transaction( 
	        (function (transaction) {
	        	if(this.dropPositionsTable){
	        		transaction.executeSql('DROP TABLE IF EXISTS positions; GO;', [], (function(){}).bind(this), this.errorHandler.bind(this));
	        	}
	            transaction.executeSql(string, [], this.createTableDataHandler.bind(this), this.errorHandler.bind(this)); 
	        }).bind(this) 
	    );
		
		this.controller.info("Created Tables.");
	}
	catch (e)
	{
		this.controller.error(e);
	}	
}

ControlAssistant.prototype.createTableDataHandler = function(transaction, results) 
{
	this.controller.info("Created TABLE positions");
} 

ControlAssistant.prototype.createRecordDataHandler = function(transaction, results) 
{	
	//this.controller.info("Inserted 1 record.");
	
	var string = 'SELECT COUNT(1) AS num FROM positions; GO;';
	this.db.transaction(
        (function (transaction) {
            transaction.executeSql(string, [], (function(transaction, results){
        		for (var i = 0; i < results.rows.length; i++) {
        			var row = results.rows.item(i);
        			$('num_queued-to-update').update(row.num + " points queued");
        		}
            }).bind(this), this.errorHandler.bind(this));
        }).bind(this)
    );
} 

ControlAssistant.prototype.errorHandler = function(transaction, error) 
{ 
    this.controller.error('Error was '+error.message+' (Code '+error.code+')');
    //$('error_area-to-update').update('Error was '+error.message+' (Code '+error.code+')');
    return true;
}

