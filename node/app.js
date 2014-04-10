/************************************************************/
/*		Network Classes and Template Functions				*/
/************************************************************/

var ERRUnknownServerError = 0;
var ERRClientNotMemberOfSession = 1;
var ERRUserNameOrDeviceAlreadyTaken = 2;
var ERRInvalidPostParameter = 3;
var ERRCookieIDMismatch = 4;
var ERRSessionExists = 5;
var ERRInvalidClientID = 6; 


var globalLoginRedirectPath = null;
var globalError = null;
function setGlobalError(err)
{
	globalError = err;
}
function setLoginRedirectPath(value)
{
	globalLoginRedirectPath = value.toString();

}

// returns [statusCode, Error JSON Object]
function NWError(code) {
	var error = {"code": code, "description": ""};
	var description = "";
	var statusCode = 0;
	switch (code) 
	{
		case ERRClientNotMemberOfSession:
			description = "You are not a member of the selected session";
			statusCode = 401;
			break;

		case ERRUserNameOrDeviceAlreadyTaken:
			description = "That username or deviceID is already taken on this server";
			statusCode = 401;
			break;

		case ERRInvalidPostParameter:
			description = "Invalid HTTP body received by the server";
			statusCode = 400;
			break;

		case ERRCookieIDMismatch:
			description = "Your clientID does not match the image at that location"
			statusCode = 401; // Unauthorized
			break;

		case ERRSessionExists:
			description = "A session with that name already exists. Choose a different name.";
			statusCode = 400;
			break;
			
		case ERRInvalidClientID:
			description = "The clientID is not part of the Database";
			statusCode = 401;
			break;

		default:
			description = "Unknown server error";
			statusCode = 400;
			break; 
	}
	error["description"] = description;
	return [statusCode, {"Error": error}];
}

function HandleCaughtError(res, err)
{
	console.log("In HandleCaughtError, err is: '" + err);
	if (!(err instanceof Array && err.length == 2))
	{
		err = NWError(ERRUnknownServerError);
	}
	res.json(err[0], err[1]);
}

var kGameSessionObjectKeys = {
	"name": "sessionName",
	"id": "id",
	"activeSessions": "activeSessions",
	"currentPlayers": "currentPlayers", 
	"currentSession": "currentSession"
};

/* Used for creating a game session to store in the database */
// Approved on 4/9 at 7:46 pm
function DBGameSession(name, sessionID, clientID) {
	var value = {
		"sessionName": name,
		"sessionID": sessionID,
		"numberOfPlayers": 1,
		"currentPlayers": [clientID],
		"timeStamp": new Date()
	};
		
	return value;
}

//CurrentPlayer function takes in the clientID and returns data related to the client 
function _CurrentPlayer(clientID)
{
	var value; 
	db.users.findOne({clientID: clientID}, function(err, user) 
	{
		try
		{		
			//if user is null meaning no user was found on the db, then throw error
			if (err != null || user == null)
			{          
				throw NWError(ERRInvalidClientID);
			}
			value = {
				"name": user.userName, 
				"deviceID": user.deviceID, 
				"imageURL": user.imageURL
			};
		} 
		catch (err)
		{
			HandleCaughtError(res, err);
		}
	});
	console.log(value);
}

/* Used for populating the "currentPlayers" array */
// TODO
function NWCurrentPlayers(currentClientIDsArray)
{
	var result = []; 
	var temp; //stores the data temporary 
	var arrayLength = currentClientIDsArray.length;
	
	//for loop the array and push the info to result array 
	for (var i = 0; i < arrayLength; i++) {
		result.push(_CurrentPlayer(currentClientIDsArray[i])); 
	}
	return result;
}

/* "NetWork Game Session" Used for Providing game session information to a client 
 * @return: [statusCode, JSONObject]
 * @Parameter: clientID: the ID of the client that is requesting the game session
 * @Parameter: dbGameSessionInstance: an instance of a DBGameSession on the database
 */
 // Approved on 4/9 at 7:46 pm needs work from Koki
function NWGameSessionQuery(clientID, dbGameSessionInstance) {
	var retVal = [-1, {}];

	var currentPlayers = dbGameSessionInstance["currentPlayers"];
	var index = -1;

	index = currentPlayers.indexOf(clientID);
	console.log("ClientID: " + clientID + " index: " + index);

	if (index < 0) 
	{
		retVal = NWError(ERRClientNotMemberOfSession);
	} 
	else 
	{
		// The final function will map the clientIDs to Player Names from  the database here
		currentPlayers.splice(index, 1);


		
		if (currentPlayers.length > 0) // check if zero the client could be the only person in the game
		{
			//TODO: Koki query the database and set all the correct properties of each player in the array
			// each player needs a name, clientID, deviceID, and imageURL
		}

		retVal[0] = 200;
		retVal[1] = {
			"sessionName": 		dbGameSessionInstance["sessionName"],
			"sessionID": 		dbGameSessionInstance["sessionID"],
			"numberOfPlayers": 	dbGameSessionInstance["numberOfPlayers"] - 1,
			"currentPlayers": 	currentPlayers
		};
	}

	return retVal;
}

/* Used for providing all active game sessions to a client */
function NWActiveGameSessionsQuery(dbGameSessionInstance) {
	// write database query to get all active game sessions
	
	return {
		"sessionName": 	dbGameSessionInstance["sessionName"],
		"sessionID": 	dbGameSessionInstance["sessionID"]
	};
}

var kGameServerEndpoints = {
	"gameSessions":  "/game_sessions",		  //GET
	"joinSession": 	 "/game_sessions/join",   //POST
	"createSession": "/game_sessions/create", //POST
	"leaveSession":  "/game_sessions/leave",  //DELETE
	"images": 		 "/images/:clientID.png", //PUT
	"login": 		 "/login",				  //POST
	"getID": 		 "/game_sessions/:id"	  //GET
};

function NWValidateClientID(clientID)
{
	if(clientID == null || isNaN(clientID) || clientID < 0 || clientID.toString().length > 10)
	{
		console.log("Error: clientID '" + clientID + "' does not satisfy requirements");
		throw NWError(ERRInvalidPostParameter);
	}
}

function NWValidateSessionID(sessionID)
{
	if(sessionID == null || !(typeof(sessionID) == 'string') || sessionID.length <= 0 || sessionID.length > 5)
	{
		console.log("Error Invalid sessionID specified");
		throw NWError(ERRInvalidPostParameter);
	}
}

/************************************************************/
/*					Configuration							*/
/************************************************************/

var express = require('express');
var http = require('http');
var path = require('path');
var mongoose = require('mongoose');
 
var app = express();
 
// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
 
app.use(require('connect').bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);
 
//CALLING THE MONGOJS 
var databaseUrl = "mydb"; 
var collections = ["users", "sessions"] 
var db = require("mongojs").connect(databaseUrl, collections);
 
/************************************************************/
/*						Methods								*/
/************************************************************/

//--------------------- Login ------------------------------//
// Approved on 4/9 at 7:46 pm
// Needs work from Koki: Find device ID
app.post(kGameServerEndpoints.login, function(req, res)
{
	//the two inputs which are being sent by the user to the database
	//need to validate
	var userName = "";
	var deviceID = ""; //is a number(int), pass to db as string
	var retVals = [];

	console.log("Got a Login");
	try 
	{		
		// begin validation before putting onto database
		userName = req.body.userName;
		deviceID = parseInt(req.body.deviceID, 10);
		
		//In postman change header Content-Type: application/json 
		//in raw enter, {"userName": "koki", "deviceID": "2"}

		// Find the user using their userName and deviceID 
		if (userName == null || typeof userName == "undefined" || userName.length == 0 || userName.length > 20) 
		{
			console.log("Error: Username '" + userName + "' does not satisfy requirements");
			throw NWError(ERRInvalidPostParameter);
		}
		else if(deviceID == null || isNaN(deviceID) || deviceID < 0 || deviceID > 99)
		{
			console.log("Error: deviceID '" + deviceID + "' does not satisfy requirements");
			
			throw NWError(ERRInvalidPostParameter);
		}
		
		console.log("Checking if the user is in the database");
		// Check if the user is already in the database
		db.users.findOne({userName: userName, deviceID: deviceID}, function(err, users) 
		{	
			
			console.log("Cheking if the deviceID is in the database");
			

			try
			{	
				// Check if the Device ID has already been taken
				
				// We didn't find a user, so add a new one
				if (err != null || users != null)
				{          
					 throw NWError(ERRUserNameOrDeviceAlreadyTaken);
				}	
				console.log("User not found \"" + userName + "\", adding user");
				// Get the count for users so we can create an unique clientID for the users
				db.users.count(function (err, numberOfClients) 
				{
					try
					{
						if(err) 
						{
							throw NWError(ERRUnknownServerError);
						}
						
						db.users.count({deviceID: deviceID}, function(err, numberOfDeviceID) 
						{	
							console.log("Count of Device IDs is: " + numberOfDeviceID.toString());
							if (numberOfDeviceID != 0)
							{   
								console.log("error, deviceID already taken");
								setGlobalError(NWError(ERRUserNameOrDeviceAlreadyTaken));  
								return;
							}	
						});
						if (globalError != null)
						{
							console.log("returning because of global error");
							return;
						} 

						// Redirect path for the user to post their profile image
						redirectPath = kGameServerEndpoints.images.replace(":clientID", numberOfClients.toString());

						// Add the user to the database
						db.users.save(
									{	userName: userName, 
										deviceID: deviceID, 
										clientID: numberOfClients, 
										hasCompletedLogin: true, 
										imageURL: redirectPath, 
										currentSession: null,
										creationTimeStamp: new Date()
									}, function(err, saved) 
						{
							try 
							{
								if( err || !saved ) 
								{
									console.log("User not saved");
									throw NWError(ERRUnknownServerError);
								}
								else 
								{
									console.log("User saved" + " \"" + userName + "\"");								
									//setting the cookie
									res.cookie('clientID',numberOfClients);
									//setLoginRedirectPath(redirectPath.toString());
									res.redirect(302, redirectPath);
								}
							}
							catch (err)
							{
								console.log("Caught innermost exception: '" + JSON.stringify(err) + "'");
								HandleCaughtError(res, err);
							}

						});
					}
					catch (err)
					{
						HandleCaughtError(res, err);
					}
				});
			}
			catch (err)
			{
				HandleCaughtError(res, err);
			}
		});	// END: Check if the user is already in the database
		
	} 
	catch (err) // Outermost Catch
	{
		if (err == null)
		{
			err = NWError(ERRInvalidPostParameter);	
		}

		console.log("caught error:");
		console.log(err);
		res.json(err[0], err[1]);
	}

	if (globalError != null)
	{
		console.log("Sending global error");
		res.json(globalError[0], globalError[1]);
		setGlobalError(null);
	}
	
});


// PUT an image to the server
app.put(kGameServerEndpoints.images, function(req, res)
{
	console.log("got an image put!");
	try {
		var putClientID = req.params.clientID;
		var cookieClientID = req.cookies.clientID;
		if (putClientID == cookieClientID) {
			var clientID = putClientID;
			res.send(200);
		}
		else {
			var retVals = NWError(ERRCookieIDMismatch);
			res.json(retVals[0], retVals[1]);
		}
	}
	catch (err)
	{
		var retVals = NWError(ERRInvalidPostParameter);
		res.json(retVals[0], retVals[1]);
	}
});

//------------------ Game Sessions -------------------------//
// Get all game sessions
app.get(kGameServerEndpoints.gameSessions, function(req, res) 
{
	console.log("Got a game sessions query!");
	var activeSessions; 
	
	//querying for all existing sessions 
	db.sessions.find(function(err, sessions) {
		if (err) return console.error(err);
		else activeSessions = sessions; 
		
		var message = {}
		message[kGameSessionObjectKeys.activeSessions] = sessions;

		res.json(200, message);
	});
}); 

// Create game sessions
// Approved on 4/9 at 7:46 pm
// Needs work from Koki
app.post(kGameServerEndpoints.createSession, function(req, res)
{
	//Input sent by user, type string
	var newSessionName = "";
	var clientID = "";
	
	console.log("Got a request to create a game session"); 
	try 
	{
		//begin validation before putting onto database
		newSessionName = req.body.newSessionName;
		clientID = parseInt(req.cookies.clientID);
	
		console.log("clientID: '" + clientID + "' sessionName Requested: '" + newSessionName + "'");

		NWValidateClientID(clientID);
		//find the user using their username and deviceID 
		/****bug with instanceOf it detects all strings as errors****/
		if (newSessionName == null || !(typeof(newSessionName) == 'string') || newSessionName.length == 0 || newSessionName.length > 15) 
		{
			console.log("Error Invalid session name");
			throw NWError(ERRInvalidPostParameter);
		}	
		
		//TODO: KOKI query Database for clientID, checking to see clientID exists in database 
		db.users.findOne({clientID: clientID}, function(err, user) 
		{
			try
			{		
				//if user is null meaning no user was found on the db, then throw error
				if (err != null || user == null)
				{          
					throw NWError(ERRInvalidClientID);
				}	
			}
			catch (err)
			{
				HandleCaughtError(res, err);
			}
		});
		
		/****bug with name and must change to sessionName or just continues creating the same sessionName over and over****/
		db.sessions.findOne({sessionName: newSessionName}, function(err, sessions) 
		{
			try 
			{
				//when session is not found
				if(err != null || sessions != null)
				{
					console.log("Got an error: '" + err + "'' sessions " + sessions);
					throw NWError(ERRSessionExists);
				}

				console.log("Session not found \"" + newSessionName + "\", adding new session"); 
								
				//get the client cookie ID and converting it to integer 
				
				//get the count for sessions so we can create an unique sessionID for the sessions
				db.sessions.count(function (err, numberOfSessions) 
				{
					try
					{
						if(err) 
						{
							throw NWError(ERRUnknownServerError);
						}
						
						// Execute the query to create the game session database
						var newGameSession = DBGameSession(newSessionName, numberOfSessions, clientID);
						db.sessions.save(newGameSession, function(err, saved) 
						{
							if( err || !saved )
							{ 
								HandleCaughtError(res, NWError(ERRUnknownServerError));
							}
							else
							{
								console.log("Session with name: '" + newSessionName + "' created");
								
								// Update the current session for the user 
								db.users.update({clientID: clientID}, {$set:{currentSession: saved.sessionID}}, function(err, result) 
								{
									if (err) HandleCaughtError(res, NWError(ERRUnknownServerError));
								});

								console.log("Created New game session: " + JSON.stringify(newGameSession));
								var dataToSend = NWGameSessionQuery(clientID, newGameSession);
								res.send(dataToSend[0], dataToSend[1]);
							}
						});
					}
					catch (err)
					{
						HandleCaughtError(res, err);
					}

				});
			}		
			catch (err)
			{
				HandleCaughtError(res, err);
			}		
		});
		
	} 
	catch (err)
	{
		console.log("Caught error:");
		if (err == null)
		{
			console.log("Error not specified in code");
			err = NWError(ERRInvalidPostParameter);	
		}
		else 
		{
			console.log(err);
		}
		res.json(err[0], err[1]);
	}
});

// Post to join game sessions
app.post(kGameServerEndpoints.joinSession, function(req, res) {

	console.log("Got an attempt to join a session");
	var sessionID = ""; 	//is a number(int), pass to db as string
	var clientID = ""; 		//is a number(int), pass to db as string
	
	// Get the client cookie ID 
	try
	{
		clientID = parseInt(req.cookies.clientID, 10);
		sessionID = req.body.sessionID;
		
		NWValidateSessionID(sessionID);
		NWValidateClientID(clientID);	// Throws an exception if invalid
		
		sessionID = parseInt(sessionID, 10); //change it to int for searching purposes
		//BOOKMARK
		
		// Find the session the client wants to join 
		db.sessions.findOne({sessionID: sessionID}, function (err, session) 
		{
			// adding the user to the currentPlayers array 
			session.currentPlayers.push(clientID);
			
			//updating database with current players 
			db.sessions.update({sessionID: sessionID}, 
				{$set:{currentPlayers: session.currentPlayers}}, function(err, result){
				try 
				{
					if(err) 
					{
						throw NWError(ERRUnknownServerError);
					}
				}
				catch (err)
				{
					HandleCaughtError(res, err);
				}
			});
			//updating database with number of players 
			db.sessions.update({sessionID: sessionID}, 
				{$set:{numberOfPlayers: session.numberOfPlayers + 1}}, function(err, result){
				try 
				{
					if(err) 
					{
						throw NWError(ERRUnknownServerError);
					}
				}
				catch (err)
				{
					HandleCaughtError(res, err);
				}
			});
			//setting the currentsession in user to the sessionID 
			db.users.update(
				{clientID: clientID},
				{$set:{currentSession: req.body.sessionID}}, function(err, result) {
				try 
				{
					if(err) 
					{
						throw NWError(ERRUnknownServerError);
					}
				}
				catch (err)
				{
					HandleCaughtError(res, err);
				}
			});

			//TODO: Get all players in the current session and return them to the user. 
			var currentPlayers = session.currentPlayers; 
		
			var message = {}
			message[kGameSessionObjectKeys.currentPlayers] = currentPlayers;

			res.json(200, message);
		});
	}
	catch (err)
	{
		HandleCaughtError(res, err);
	}
});

// Get the info about the game session that the user is currently in 
app.get(kGameServerEndpoints.getID, function(req, res) 
{
	console.log("Got a current game session query!");
	var clientID = "";
	//get the client cookie ID and converting it to integer 
	var clientID = parseInt(req.cookies.clientID, 10);

	NWValidateClientID(clientID);	// Throws an exception if invalid

	//querying for the session info, the user is currently in  
	db.users.findOne({clientID: clientID}, function (err, user) {	
		//now querying to the session database
		db.sessions.findOne({sessionID: parseInt(user.currentSession, 10)}, function (err, session) 
		{
			// TODO: Query the database and get info for every user in the session
			// TODO: Return data here 
			
			var result = []; 
			var value; //stores the data temporary 
			var arrayLength = session.currentPlayers.length;
	
			//for loop the array and push the info to result array 
			for (var i = 0; i < arrayLength; i++) {
				db.users.findOne({clientID: session.currentPlayers[i]}, function(err, user) 
				{
					try
					{		
						//if user is null meaning no user was found on the db, then throw error
						if (err != null || user == null)
						{          
							throw NWError(ERRInvalidClientID);
						}
						value = {
							"name": user.userName, 
							"deviceID": user.deviceID, 
							"imageURL": user.imageURL
						};
						result.push(value); //pushing to the temporary array 
						
						//returning as a JSON 
						var message = {}
						message[kGameSessionObjectKeys.currentSession] = result;
						res.json(200, message);
					} 
					catch (err)
					{
						HandleCaughtError(res, err);
					}
				});
			}
		});
	});
}); 

// Delete to leave game sessions
app.delete(kGameServerEndpoints.leaveSession, function(req, res)
{
	console.log("Removing the user!");
	var clientID = ""; //is a number(int), send to db as string
	//get the client cookie ID 
	var putClientID = parseInt(req.cookies.clientID, 10);
	if(clientID == null || typeof clientID == "undefined" || clientID.length <= 0 || clientID >10 || clientID == "")
	{
		console.log("error");
		message = "That is an invalid client ID. Please try again"
		res.json(400, message);
	}else
	{
	db.users.findOne({clientID: putClientID}, function (err, user) {
		//removing the user
		var tmpSessionID = user.currentSession;
		console.log(tmpSessionID); 
		
		//setting the currentsession in user to null 
		db.users.update(
			{clientID: putClientID},
			{$set:{currentSession: null}}, function(err, result) {
		});
			
		//removing the user from the currentPlayers array 
		db.sessions.findOne({sessionID: tmpSessionID}, function (err, session) {
			//removing the user
			db.sessions.update(
				{sessionID: tmpSessionID},
				{ $pull: {currentPlayers: {clientID: putClientID}}}
			);
		});
	});
	}
	res.send(200);	
});

/************************************************************/
/*							Execution						*/
/************************************************************/ 
//console.log('Possible routes: ' + JSON.stringify(app.routes, null, '\t'));
var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
