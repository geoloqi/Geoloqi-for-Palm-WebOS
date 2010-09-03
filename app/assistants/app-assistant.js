function AppAssistant(appController) {
}

//This function will handle relaunching the app when an alarm goes off(see the device/alarm scene)
AppAssistant.prototype.handleLaunch = function(params) {
	//if params doesn't exist then it means a user is launching the app rather than an alarm
	//causing it to launch and we should get out of here.
	if (!params){
		return;
	}

	this.controller.serviceRequest("palm://com.palm.power/com/palm/power", {
	    method: "activityEnd",
	    parameters: {
	        id: "com.geoloqi.geoloqigpstracker.alarm-1",
	    },
	    onSuccess: (function(){
	    	Mojo.Log.info("Stopped activity timer");
	    }).bind(this),
	    onFailure: (function(){
	    	Mojo.Log.error("Failed to stop activity timer");
	    }).bind(this)
	});

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

	Mojo.Log.info('Alarm woke up!!');
	
};
