function ControlAssistant() {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
	
	this.db = null;
	this.nullHandleCount = 0;
}

ControlAssistant.prototype.setup = function() {
	/* this function is for setup tasks that have to happen when the scene is first created */
	
	/* use Luna.View.render to render view templates and add them to the scene, if needed. */
	
	/* setup widgets here */
	
	/* add event handlers to listen to events from widgets */
	/*
	this.buttonModel = {
		buttonLabel : 'Go!!',
		buttonClass : 'affirmative',
		disable : false
	}
	this.buttonAtt = {
		type: 'activity'
	}
	*/
	
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
	
	
	
	this.totalPoints = 0;
	
    // Request continuous location updates
	this.controller.serviceRequest('palm://com.palm.location', {
		method : 'startTracking',
        parameters: {
            subscribe: true
    	},
        onSuccess: this.handleServiceResponse.bind(this),
        onFailure: this.handleServiceResponseError.bind(this)
    });

    
	// Set a timer for sending the queued points to the server
	this.scheduleSendToServer();
	
	Mojo.Event.listen(this.controller.get("sendingIntervalSlider"), Mojo.Event.propertyChange, this.handleUpdateSending);
    this.controller.setupWidget("sendingIntervalSlider",
		this.attributes = {
			minValue: 0,
			maxValue: 100
		},
		this.model = {
			value: 3,
			disabled: false
		}
	);

	Mojo.Event.listen(this.controller.get("distanceFilterSlider"), Mojo.Event.propertyChange, this.handleUpdateDistance);
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

	Mojo.Event.listen(this.controller.get("timeSlider"), Mojo.Event.propertyChange, this.handleUpdateTime);
    this.controller.setupWidget("timeSlider",
		this.attributes = {
			minValue: 0,
			maxValue: 100
		},
		this.model = {
			value: 3,
			disabled: false
		}
	);

};


ControlAssistant.prototype.handleUpdateSending = function(event){
	Mojo.Log.info("Slider is at:", event.value);
};
ControlAssistant.prototype.handleUpdateDistance = function(event){
	Mojo.Log.info("Slider is at:", event.value);
};
ControlAssistant.prototype.handleUpdateTime = function(event){
	Mojo.Log.info("Slider is at:", event.value);
};


//This function schedules the timeout task
ControlAssistant.prototype.scheduleSendToServer = function(){
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
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
	latitude = event.latitude;
	longitude = event.longitude;
	$('latitude_area-to-update').update((event.latitude * 1000000).round() / 1000000);
	$('longitude_area-to-update').update((event.longitude * 1000000).round() / 1000000);
	this.totalPoints++;

	
	
	var string = 'INSERT INTO positions (date, lat, lng) VALUES ("' + (new Date()).toISOString() + '","' + latitude + '","' + longitude + '"); GO;';
	this.db.transaction( 
        (function (transaction) { 
            transaction.executeSql(string, [], this.createRecordDataHandler.bind(this), this.errorHandler.bind(this)); 
        }).bind(this) 
    );
	

	//this.controller.info("Received location", latitude, longitude, this.totalPoints, "points received");
	
	$('num_points-to-update').update(this.totalPoints+" points since last launch");
}
ControlAssistant.prototype.handleServiceResponseError = function(event) {
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
    $('error_area-to-update').update("Get Location Error:"+Object.toJSON(event));
    this.controller.error("Get Location error:", Object.toJSON(event));
}



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
			+ 'lng TEXT NOT NULL DEFAULT ""'
			+ '); GO;'
	    this.db.transaction( 
	        (function (transaction) { 
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
	this.controller.info("Created TABLE locations");
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
    return true;
}

