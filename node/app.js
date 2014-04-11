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
var ERRClientAlreadyInSession = 7;

var globalNWCurrentPlayers = null;

function NWError(code, res) {
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
			statusCode = 401;
			break;
			
		case ERRInvalidClientID:
			description = "The clientID is not part of the Database";
			statusCode = 401;
			break;

		case ERRClientAlreadyInSession:
			description = "You are already a member of a session";
			statusCode = 401;
			break;


		default:
			description = "Unknown server error";
			statusCode = 400;
			break; 
	}
	error["description"] = description;
	
	res.json(statusCode, {"Error": error});
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
function NWCurrentPlayer(dbCurrentPlayer)
{
	var returnVal = 
	{
		"name": 	dbCurrentPlayer.userName, 
		"deviceID": dbCurrentPlayer.deviceID, 
		"imageURL": dbCurrentPlayer.imageURL
	}
	console.log("Preparing to return: " + JSON.stringify(returnVal));
	return returnVal;
}

function NWValidateClientInSession(clientID, nextHandler)
{
	db.users.findOne({clientID: parseInt(clientID, 10)}, function(err, client)
	{
		if (err != null) return nextHandler(ERRUnknownServerError);

		if (client.currentSession != null)
		{
			return nextHandler(ERRClientAlreadyInSession);
		}

		nextHandler(null);
	});
}

/* "NetWork Game Session" Used for Providing game session information to a client 
 * @return: [statusCode, JSONObject]
 * @Parameter: clientID: the ID of the client that is requesting the game session
 * @Parameter: dbGameSessionInstance: an instance of a DBGameSession on the database
 */
 // Approved on 4/9 at 7:46 pm needs work from Koki
function NWGameSessionQuery(clientID, dbGameSessionInstance, completionHandler) 
{
	var retVal = [-1, {}];

	var dbCurrentPlayers = dbGameSessionInstance["currentPlayers"];
	var index = -1;

	var localCompletionHandler = function ()
	{
		console.log("Returning globalNWCurrentPlayers as: " + JSON.stringify(globalNWCurrentPlayers));
		retVal[0] = 200;
		retVal[1] = {
			"sessionName": 		dbGameSessionInstance["sessionName"],
			"sessionID": 		dbGameSessionInstance["sessionID"],
			"numberOfPlayers": 	dbGameSessionInstance["numberOfPlayers"] - 1,
			"currentPlayers": 	globalNWCurrentPlayers
		};

		completionHandler(retVal);
	};

	index = dbCurrentPlayers.indexOf(clientID);
	console.log("ClientID: " + clientID + " index: " + index);

	if (index < 0) return NWError(ERRClientNotMemberOfSession, res); 

	// Remove the current client from the current players array
	dbCurrentPlayers.splice(index, 1);
	
	globalNWCurrentPlayers = [];
	// check if zero the client could be the only person in the game
	if (dbCurrentPlayers.length == 0) return localCompletionHandler();

	
	// Each player needs a name, clientID, deviceID, and imageURL
	for (var playerID in dbCurrentPlayers)
	{
		console.log("Querying for player with id " + playerID)
		db.users.findOne({clientID: parseInt(playerID,10)}, function (err, dbPlayer) 
		{
			if (err != null) return NWError(ERRUnknownServerError, res);

			console.log("Found a player with that ID: " + JSON.stringify(dbPlayer));

			// Get the right data from dbplayer and push it onto the array
			globalNWCurrentPlayers.push(NWCurrentPlayer(dbPlayer))
			if (globalNWCurrentPlayers.length == dbCurrentPlayers.length)
			{
				return localCompletionHandler();
			}
		});
	}
	
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
	var localClientID = parseInt(clientID, 10);
	if(localClientID == null || isNaN(localClientID) || localClientID < 0 || localClientID.toString().length > 10)
	{
		console.log("Error: clientID '" + localClientID + "' does not satisfy requirements");
		return true;
	}
	return false;
}

function NWValidateSessionID(sessionID)
{
	var localSessionID = parseInt(sessionID, 10);
	if(localSessionID == null || isNaN(localSessionID) || localSessionID < 0 || localSessionID.toString().length > 5)
	{
		console.log("Error Invalid sessionID specified");
		return true;
	}
	return false;
}

/************************************************************/
/*					Configuration							*/
/************************************************************/

var express = require('express');
var http = require('http');
var path = require('path');
var mongoose = require('mongoose');
var fs = require('fs');
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
// Aproved for real on 4/10 at 10:05 Sam and Koki
app.post(kGameServerEndpoints.login, function(req, res)
{
	console.log("Got a login!");
	var completionHandler = function(numberOfClients, redirectPath) 
	{
		//setting the cookie
		res.cookie('clientID', numberOfClients);
		//setLoginRedirectPath(redirectPath.toString());
		res.redirect(302, redirectPath);
	} 
	
	// begin validation before putting onto database
	var userName = req.body.userName;
	var deviceID = parseInt(req.body.deviceID, 10);
	var clientID = req.cookies.clientID;
	
	
	
	//In postman change header Content-Type: application/json 
	//in raw enter, {"userName": "koki", "deviceID": "2"}

	// Find the user using their userName and deviceID 
	if (userName == null || typeof userName == "undefined" || userName.length == 0 || userName.length > 20) 
	{
		console.log("Error: Username '" + userName + "' does not satisfy requirements");
		return NWError(ERRInvalidPostParameter, res);
	}
	else if(deviceID == null || isNaN(deviceID) || deviceID < 0 || deviceID > 99)
	{
		console.log("Error: deviceID '" + deviceID + "' does not satisfy requirements");
		
		return NWError(ERRInvalidPostParameter, res);
	}
	
	console.log("Checking if the user is in the database");
	

	// First: Check if user is already in database
	var firstFunction;
	var secondFunction;
	var thirdFunction;
	var fourthFunction;

	firstFunction = function()
	{
		db.users.findOne({userName: userName}, function(err, user) 
		{			
			// We didn't find a user, so add a new one
			//console.log("First: Users found: '" + users + "'");
			console.log("First: Users found: '" + user + "'");

			if (err != null) return NWError(ERRUnknownServerError, res);

			if (user != null)
			{ 
				if (NWValidateClientID(clientID) == false && clientID == user.clientID) 
				{
					console.log("Updating deviceID for user to: " + deviceID);
					db.users.update({clientID: parseInt(clientID, 10)}, 
						{$set:{deviceID: deviceID}}, function(err, result) 
					{
						if (err) return NWError(ERRUnknownServerError, res);
					});
					return completionHandler(clientID, user.imageURL);
				}

				console.log("returning global errror");	
				return NWError(ERRUserNameOrDeviceAlreadyTaken, res);
			}

			
			
			console.log("User not found \"" + userName + "\", adding user");
			// Get the count for users so we can create an unique clientID for the users
			secondFunction();	
		});	// END: Check if the user is already in the database
	}


	// Second: check if device ID is already in database
	//console.log("Cheking if the deviceID is in the database");
	secondFunction = function()
	{
		db.users.count({deviceID: deviceID}, function(err, numberOfDeviceID) 
		{	
			console.log("Count of Device IDs is: " + numberOfDeviceID.toString());
			if (numberOfDeviceID != 0)
			{   
				console.log("error, deviceID already taken");
				return NWError(ERRUserNameOrDeviceAlreadyTaken, res);
			}
			thirdFunction();
		});
	}	

	// Third: Count the number of clients so we can create a new unique clientID
	thirdFunction = function()
	{
		db.users.count(function (err, numberOfClients) 
		{
			if(err) 
			{
				return NWError(ERRUnknownServerError, res);
			}
			console.log("Number of clients found at 3: '" + numberOfClients + "'");
			//setglobalLoginInfo.numberOfClients(numberOfClients);
			// Redirect path for the user to post their profile image
			
			redirectPath = kGameServerEndpoints.images.replace(":clientID", numberOfClients.toString());
			fourthFunction(numberOfClients, redirectPath);
		});
	}

	// Third: Save the user to the database
	fourthFunction = function (numberOfClients, redirectPath)
	{
		db.users.save(
					{	userName: userName, 
						deviceID: deviceID, 
						clientID: numberOfClients, 
						hasCompletedLogin: false, 
						imageURL: redirectPath, 
						currentSession: null,
						creationTimeStamp: new Date()
					}, function(err, saved) 
		{	
			if( err || !saved ) 
			{
				console.log("User not saved");
				return NWError(ERRUnknownServerError, res);
			}
			
			console.log("User saved" + " \"" + userName + "\"");								
			completionHandler(numberOfClients, redirectPath);

		});
	}

	firstFunction();
	
});

/// POST a client image to the server
// Aproved for real on 4/11 at 11:44 Sam and Koki
app.post(kGameServerEndpoints.images, function(req, res) 
{
	var clientID = req.cookies.clientID;
	if (NWValidateClientID(clientID)) return NWError(ERRInvalidClientID, res);

	var completionHandler = function() 
	{
		db.users.update({clientID: clientID}, 
			{$set:{hasCompletedLogin: true}}, function(err, result) 
		{
			if (err) HandleCaughtError(res, NWError(ERRUnknownServerError));
		});

		res.send(200, "");
	} 

	// Node stored the POST to a temporary file, copy it to the images directory
	fs.readFile(req.files.image.path, function (err, data) 
	{
		if(err != null) return NWError(ERRUnknownServerError, res);
		var imageName = clientID + '.png';
		
		var newPath = __dirname + "/images/" + imageName;

		// Do the actual write the the images directory
		fs.writeFile(newPath, data,function (err) 
		{
			if(err != null) return NWError(ERRUnknownServerError, res);
			completionHandler();
		});
	});
});

//------------------ Game Sessions -------------------------//
// Get all game sessions
// Aproved for real on 4/11 at 12:15 Sam and koki Commit: 1ee640f8
app.get(kGameServerEndpoints.gameSessions, function(req, res) 
{
	console.log("Got a game sessions query!");
	
	var clientID = req.cookies.clientID;
	if (NWValidateClientID(clientID)) return NWError(ERRInvalidClientID, res);

	var activeSessions = []; 
	
	var completionHandler = function (responseBody)
	{
		res.json(200, responseBody);
	}

	//querying for all existing sessions 
	db.sessions.find(function(err, sessions) 
	{
		if (err) return NWError(ERRUnknownServerError, res);
		console.log("Number of active sessions is: " + sessions.length);
		if (sessions != null && sessions.length != 0)
		{
			for(var i =0; i<sessions.length; i++)
			{
				activeSessions.push(NWActiveGameSessionsQuery(sessions[i]));
			}
		}	
		var responseBody = {};
		responseBody[kGameSessionObjectKeys.activeSessions] = activeSessions;

		completionHandler(responseBody);
	});
}); 


// Post to join game sessions
app.post(kGameServerEndpoints.joinSession, function(req, res) {

	console.log("Got an attempt to join a session");

	var clientID = req.cookies.clientID;
	var sessionID = req.body.sessionID; 	//is a number(int), pass to db as string
	
	if (NWValidateClientID(clientID)) 	return NWError(ERRInvalidClientID, res);
	if (NWValidateSessionID(sessionID)) return NWError(ERRInvalidPostParameter, res);

	var completionHandler = function (retVals)
	{
		res.json(retVals[0], retVals[1]);
	}

	var firstFunction;
	var secondFunction;
	var thirdFunction;

	var validateFunction = function(nextHandler)
	{
		NWValidateClientInSession(clientID, nextHandler);
	}
	
	// First:  	Q1: Find the session that the user wants to join
	// 			Q2: Update the number of players in that session
	//			Q3: Add the clientID to the players array
	firstFunction = function (err)
	{
		console.log("Reached the first function err = " + err);
		if (err != null) return NWError(err, res);

		db.sessions.findOne({sessionID: sessionID}, function (err, session) 
		{
			if (err != null) return NWError(ERRUnknownServerError, res);
			// Add the user to the current players array
			session.currentPlayers.push(clientID);
			
			// Update database with current players 
			db.sessions.update({sessionID: sessionID}, 
				{$set:{currentPlayers: session.currentPlayers}}, function(err, result)
			{
				if (err != null) return NWError(ERRUnknownServerError, res);

				//updating database with number of players 
				db.sessions.update({sessionID: sessionID}, 
					{$set:{numberOfPlayers: session.numberOfPlayers + 1}}, function(err, result)
				{
					if (err != null) return NWError(ERRUnknownServerError, res);
					secondFunction();
				});
			});
		});
	}



	// Second: Update the User's current session in the Users table
	secondFunction = function()
	{
		db.users.update(
				{clientID: parseInt(clientID,10)	},
				{$set:{currentSession: sessionID}}, function(err, result) 
		{
			if (err != null) return NWError(ERRUnknownServerError, res);

			thirdFunction();
		});
	}

	// Third: Get all of the data on the users in the session
	thirdFunction = function()
	{
		db.sessions.findOne({sessionID: sessionID},function (err, session) 
		{
			if (err != null) return NWError(ERRUnknownServerError, res);

			NWGameSessionQuery(clientID, session, completionHandler);

		});
	}

	validateFunction(firstFunction)

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
