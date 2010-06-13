function AppAssistant(appController) {
}

//This function will handle relaunching the app when an alarm goes off(see the device/alarm scene)
AppAssistant.prototype.handleLaunch = function(params) {
	//if params doesn't exist then it means a user is launching the app rather than an alarm
	//causing it to launch and we should get out of here.
	if (!params){
		return;
	}
	
	Mojo.Log.info('Alarm woke up!!');
	
};
