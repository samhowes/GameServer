/************************************************************/
/*		Network Classes and Template Functions				*/
/************************************************************/

var consoleDiv 	  = '------------------------------------------------------------------------------------------\n'
var consoleDivEnd = '=========================================================================================='
var consoleDivERR = '++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++'

var ERRUnknownServerError = 0;
var ERRClientNotMemberOfSession = 1;
var ERRUserNameAlreadyTaken = 2;
var ERRDeviceIDAlreadyTaken = 3;
var ERRInvalidPostParameter = 4;
var ERRCookieIDMismatch 	= 5;
var ERRSessionExists 		= 6;
var ERRInvalidClientID 		= 7; 
var ERRClientAlreadyInSession = 8;
var ERRNotInSameSession 	= 9;

var globalNextClientID = 1000;

var globalNWCurrentPlayers = null;

var kGameServerEndpoints = {
	"gameSessions":  	"/game_sessions",		  	//GET
	"joinSession": 	 	"/game_sessions/join",   	//POST
	"createSession": 	"/game_sessions/create",	//POST
	"leaveSession":  	"/game_sessions/leave",  	//DELETE
	"images": 		 	"/images/:clientID.png", 	//POST
	"login": 		 	"/login",				  	//POST
	"getSesionWithID": 	"/game_sessions/:sessionID"	//GET
};

var kGameSessionObjectKeys = {
	"name": "sessionName",
	"id": "id",
	"activeSessions": "activeSessions",
	"currentPlayers": "currentPlayers", 
	"currentSession": "currentSession"
};

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

		case ERRUserNameAlreadyTaken:
			description = "That username is already taken on this server";
			statusCode = 401;
			break;

		case ERRDeviceIDAlreadyTaken:
			description = "That deviceID is already taken on this server";
			statusCode = 401;
			break;

		case ERRInvalidPostParameter:
			description = "Invalid HTTP body received by the server";
			statusCode = 400;
			break;

		case ERRCookieIDMismatch:
			description = "Your clientID does not match the image at that location";
			statusCode = 401;
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
		
		case ERRNotInSameSession:

			description = "You are not in the same session as that user";
			statusCode = 401;
			break;

		default:
			description = "Unknown server error";
			statusCode = 400;
			break; 
	}
	error["description"] = description;
	
	res.json(statusCode, {"Error": error});
	console.log(consoleDivERR);
}

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
	console.log("... Found user: " + JSON.stringify(returnVal));
	return returnVal;
}

function NWValidateClientInSession(clientID, shouldBeInSession, nextHandler)
{
	db.users.findOne({clientID: clientID}, function(err, client)
	{
		if (err != null) return nextHandler(ERRUnknownServerError);

		if (client == null)
		{
			console.log("Rejecting request: clientID does not exist");
			return nextHandler(ERRInvalidClientID);
		}
		else if (shouldBeInSession == false && client.currentSession != null)
		{
			console.log("Rejecting request: the client is already in session with ID: " + client.currentSession);
			return nextHandler(ERRClientAlreadyInSession);
		}
		else if (shouldBeInSession == true && client.currentSession == null)
		{
			console.log("Rejecting request: The client is not a member of a session");
			return nextHandler(ERRClientNotMemberOfSession);
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
	console.log("... Retrieving info about players in sessionID: " + dbGameSessionInstance.sessionID);
	var dbCurrentPlayers = dbGameSessionInstance["currentPlayers"];
	var index = -1;

	console.log("... Retrieving info about players with IDs: " + JSON.stringify(dbCurrentPlayers));
	var localCompletionHandler = function ()
	{
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
	if (index < 0) return NWError(ERRClientNotMemberOfSession, res); 

	// Remove the current client from the current players array
	dbCurrentPlayers.splice(index, 1);
	
	
	globalNWCurrentPlayers = [];
	// check if zero the client could be the only person in the game
	if (dbCurrentPlayers.length == 0) return localCompletionHandler();

	
	// Each player needs a name, clientID, deviceID, and imageURL
	dbCurrentPlayers.forEach(function(playerID)
	{
		db.users.findOne({clientID: parseInt(playerID,10)}, function (err, dbPlayer) 
		{
			if (err != null) return NWError(ERRUnknownServerError, res);

			// Get the right data from dbplayer and push it onto the array
			globalNWCurrentPlayers.push(NWCurrentPlayer(dbPlayer))
			if (globalNWCurrentPlayers.length == dbCurrentPlayers.length)
			{
				return localCompletionHandler();
			}
		});
	});
	
}

/* Used for providing all active game sessions to a client */
function NWActiveGameSessionsQuery(dbGameSessionInstance) {
	// write database query to get all active game sessions
	
	return {
		"sessionName": 	dbGameSessionInstance["sessionName"],
		"sessionID": 	dbGameSessionInstance["sessionID"]
	};
}

function NWValidateClientID(clientID)
{
	if(clientID == null || isNaN(clientID) || clientID < 0 || clientID.toString().length > 10)
	{
		console.log("Rejecting clientID: '" + clientID + "', ID does not satisfy requirements");
		return true;
	}
	return false;
}

function NWValidateSessionID(sessionID)
{
	if(sessionID == null || isNaN(sessionID) || sessionID < 0 || sessionID.toString().length > 5)
	{
		console.log("Rejecting sessionID: '" + sessionID + "', ID does not satisfy requirements");
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
app.set('port', process.env.PORT || 3002);
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
	var userName = req.body.userName;
	var deviceID = parseInt(req.body.deviceID, 10);
	var clientID = parseInt(req.cookies.clientID, 10);
	var shouldUpdateExistingUser = false;
	
	console.log("Received a login Request from user with clientID: " + clientID);
	
	var completionHandler = function(redirectPath) 
	{
		console.log("Redirecting client to upload their profile");
		
		//setLoginRedirectPath(redirectPath.toString());
		res.redirect(302, redirectPath);
		console.log(consoleDivEnd);
	} 

	// Find the user using their userName and deviceID 
	if (userName == null || typeof userName == "undefined" || userName.length == 0 || userName.length > 20) 
	{
		console.log("Rejecting userName: '" + userName + "' name does not satisfy requirements");
		return NWError(ERRInvalidPostParameter, res);
	}
	else if(deviceID == null || isNaN(deviceID) || deviceID < 0 || deviceID > 99)
	{
		console.log("Error: deviceID '" + deviceID + "' does not satisfy requirements");
		
		return NWError(ERRInvalidPostParameter, res);
	}
	

	// First: Check if user is already in database
	var firstFunction;
	var secondFunction;
	var thirdFunction;
	var updateUserFunction;
	var createUserFunction;

	var validateFunction = function ()
	{	
		console.log(" - Checking if clientID already exists on the server...")
		// we want to allow a user to re-login
		if (NWValidateClientID(clientID)) return firstFunction();
		db.users.findOne({clientID: clientID}, function(err, user) 
		{			
			if (err != null) return NWError(ERRUnknownServerError, res);
			// If the user somehow has an invalid cookie, log them in with a new cookie
			if (user != null)
			{
				console.log("ID " + clientID + " Exists: allowing update of userName and DeviceID");
				shouldUpdateExistingUser = true;
			}

			return firstFunction();

		});
	}

	// Query the database to check if a user with the requested name exists
	firstFunction = function()
	{
		console.log(" - Checking if userName: '" + userName + "' is available...");
		db.users.findOne({userName: userName}, function(err, user) 
		{			
			if (err != null) return NWError(ERRUnknownServerError, res);

			if (user != null)
			{ 
				if (!shouldUpdateExistingUser || (shouldUpdateExistingUser && user.clientID != clientID))
				{
					console.log("Rejecting request: A user with that name already exists.");	
					return NWError(ERRUserNameAlreadyTaken, res);
				}
			}

			console.log(" - Username is available");
			// Get the count for users so we can create an unique clientID for the users
			secondFunction();	
		});	
	}


	// Second: check if device ID is already in database
	//console.log("Cheking if the deviceID is in the database");
	secondFunction = function()
	{
		console.log(" - Checking if deviceID: " + deviceID + " is available...");
		db.users.findOne({deviceID: deviceID}, function(err, user) 
		{			
			if (err != null) return NWError(ERRUnknownServerError, res);

			if (user != null)
			{ 
				if (!shouldUpdateExistingUser || (shouldUpdateExistingUser && user.clientID != clientID))
				{	
					console.log("Rejecting request: A user with that deviceID already exists.");	
					return NWError(ERRDeviceIDAlreadyTaken, res);
				}
			}
			console.log(" - Device ID is available");

			thirdFunction();	
		});
	}	

	// Multiplex to the completion of the request
	thirdFunction = function()
	{
		if (shouldUpdateExistingUser)
		{
			var redirectPath = kGameServerEndpoints.images.replace(":clientID", clientID.toString());
			return updateUserFunction(redirectPath);
		}
		else
		{	
			return fourthFunction();
		}
	}

	// Fourth: Count the number of clients so we can create a new unique clientID
	fourthFunction = function()
	{
		db.users.count(function (err, numberOfClients) 
		{
			if(err) 
			{
				return NWError(ERRUnknownServerError, res);
			}
			console.log("New Client's ID will be: '" + numberOfClients + "'");
		
			// Redirect path for the user to post their profile image
			var redirectPath = kGameServerEndpoints.images.replace(":clientID", numberOfClients.toString());
			createUserFunction(numberOfClients, redirectPath);
		});
	}

	// Update an existing user in the database
	updateUserFunction = function(redirectPath)
	{
		console.log('Executing update for client with ID: ' + clientID + " With new Name: '" + userName + "' and deviceID: " + deviceID);
		// First update the userName
		db.users.update({clientID: clientID}, 
					{$set:{userName: userName}}, 
					function(err, result) 
		{			
			if (err != null || result == null) return NWError(ERRUnknownServerError, res);

			// Second update the device ID
			db.users.update({clientID: clientID}, 
						{$set:{deviceID: deviceID}}, function(err, result) 
			{
				if (err != null) return NWError(ERRUnknownServerError, res);

				return completionHandler(redirectPath);
			});
		});
	}

	// Add a new user to the database
	createUserFunction = function (newClientID, redirectPath)
	{
		console.log('Executing creation of new client:' + newClientID + " With name: '" + userName + "' and deviceID: " + deviceID);
		db.users.save(
					{	userName: userName, 
						deviceID: deviceID, 
						clientID: newClientID, 
						hasCompletedLogin: false, 
						imageURL: redirectPath, 
						currentSession: null,
						creationTimeStamp: new Date()
					}, function(err, saved) 
		{	
			if( err || !saved ) 
			{
				return NWError(ERRUnknownServerError, res);
			}
			
			res.cookie('clientID', newClientID);				
			completionHandler(redirectPath);

		});
	}

	validateFunction();
	
});

/// POST a client image to the server
// Aproved for real on 4/11 at 11:44 Sam and Koki: 685f87c1
app.post(kGameServerEndpoints.images, function(req, res) 
{
	var clientID = parseInt(req.cookies.clientID, 10);
	console.log("Received an image POST from client with ID: " + clientID);

	if (NWValidateClientID(clientID)) return NWError(ERRInvalidClientID, res);

	var completionHandler = function() 
	{
		db.users.update({clientID: clientID}, 
			{$set:{hasCompletedLogin: true}}, function(err, result) 
		{
			if (err) NWError(ERRUnknownServerError, res);
		});

		res.send(200, "");
		console.log(consoleDivEnd);
	} 

	// Node stored the POST to a temporary file, copy it to the images directory
	fs.readFile(req.files.image.path, function (err, data) 
	{
		if(err != null) return NWError(ERRUnknownServerError, res);
		var imageName = clientID + '.png';
		
		var newPath = __dirname + "/images/" + imageName;

		// Do the actual write the the images directory
		console.log("Storing new image for client with ID: " + clientID)
		fs.writeFile(newPath, data,function (err) 
		{
			if(err != null) return NWError(ERRUnknownServerError, res);
			completionHandler();
		});
	});
});

/// Get a User Image
// Aproved for real on 4/11 at 5:35 Sam and Koki: 
app.get(kGameServerEndpoints.images, function(req, res)
{

	// Input Paremters: clientID From Cookie, requested clientID from URL
	var clientID = 			parseInt(req.cookies.clientID, 10);
	var requestedClientID = parseInt(req.params.clientID, 10);
	
	console.log( "Received an image request from client: " + clientID + " for the image of client: " + requestedClientID);

	// Validate: clientID, requestedClientID values
	if (NWValidateClientID(clientID)) 			return NWError(ERRInvalidClientID, res);
	if (NWValidateClientID(requestedClientID)) 	return NWError(ERRInvalidClientID, res);	

	// Output: Image file in .png format
	var completionHandler = function()
	{
		console.log("Sending image to the user");
		var filename = requestedClientID + '.png';

		var img = fs.readFileSync(__dirname + "/images/" + filename);
		res.writeHead(200, {'Content-Type': 'image/png'});
		res.end(img, 'binary');
		console.log(consoleDivEnd);
	}

	// DBValidate: verify that the clients are in the same session
	var validateFunction = function ()
	{
		db.users.findOne({clientID: clientID}, function(err, user)
		{
			if (err != null) 	return NWError(ERRUnknownServerError, res);
			if (user == null)	return NWError(ERRInvalidClientID, res);

			if (user.currentSession == null) return NWError(ERRClientNotMemberOfSession, res);

			db.users.findOne({clientID: requestedClientID}, function(err, requestedUser)
			{
				if (err != null) 			return NWError(ERRUnknownServerError, res);
				if (requestedUser == null)	return NWError(ERRInvalidPostParameter, res);

				if (user.currentSession != requestedUser.currentSession)
				{
					console.log("Rejecting request: client with ID: " + user.clientID + " is not a member of session: " + requestedUser.currentSession);
					return NWError(ERRNotInSameSession, res);
				}
				return completionHandler();
			});
		});
	};
	validateFunction();
});


//------------------ Game Sessions -------------------------//
// Get all game sessions
// Aproved for real on 4/11 at 12:15 Sam and koki Commit: 1ee640f8
app.get(kGameServerEndpoints.gameSessions, function(req, res) 
{
	console.log("Received a query for all game sessions");
	
	var clientID = parseInt(req.cookies.clientID, 10);
	if (NWValidateClientID(clientID)) return NWError(ERRInvalidClientID, res);

	var activeSessions = []; 
	
	var completionHandler = function (responseBody)
	{
		res.json(200, responseBody);
		console.log(consoleDivEnd);
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
// Approved for real on 4/11 at 3:46 Sam and koki Commit: 978edee2
app.post(kGameServerEndpoints.joinSession, function(req, res) 
{
	var clientID = parseInt(req.cookies.clientID, 10);
	var sessionID = parseInt(req.body.sessionID, 10);	//is a number(int), pass to db as string
	
	console.log("Received attempt from client: '" + clientID + "' to join session with ID: '" + sessionID + "'");
	if (NWValidateClientID(clientID)) 	return NWError(ERRInvalidClientID, res);
	if (NWValidateSessionID(sessionID)) return NWError(ERRInvalidPostParameter, res);

	var completionHandler = function (retVals)
	{
		res.json(retVals[0], retVals[1]);
		console.log(consoleDivEnd);
	}

	var firstFunction;
	var secondFunction;
	var thirdFunction;

	var validateFunction = function(nextHandler)
	{
		NWValidateClientInSession(clientID,false, nextHandler);
	}
	
	// First:  	Q1: Find the session that the user wants to join
	// 			Q2: Update the number of players in that session
	//			Q3: Add the clientID to the players array
	firstFunction = function (err)
	{
		if (err != null) return NWError(err, res);

		db.sessions.findOne({sessionID: sessionID}, function (err, session) 
		{
			if (err != null) return NWError(ERRUnknownServerError, res);
			if (session == null) return NWError(ERRInvalidPostParameter, res);

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
				{clientID: clientID	},
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

// POST Create game session
// Approved for real on 4/11 at 4:29 Sam and koki Commit: d3aae2f6
app.post(kGameServerEndpoints.createSession, function(req, res)
{
	// Input Parameters: clientID, newSessionName
	var clientID = parseInt(req.cookies.clientID, 10);
	var newSessionName = req.body.newSessionName; 
	
	console.log("Got an attempt from client: '" + clientID + "' to create a session with name: '" + newSessionName + "'");

	if (NWValidateClientID(clientID)) 	return NWError(ERRInvalidClientID, res);
	
	if (newSessionName == null || !(typeof newSessionName == 'string') || newSessionName.length == 0 || newSessionName.length > 30)
	{
		return NWError(ERRInvalidPostParameter, res);
	}
	
	// Output Parameters: full session info
	var completionHandler = function (retVals)
	{
		res.json(retVals[0], retVals[1]);
		console.log(consoleDivEnd);
	}

	var firstFunction;
	var secondFunction;
	var thirdFunction;
	var fourthFunction;
	var fifthFunction;

	// Validate: validate if the client is already in a session
	var validateFunction = function(nextHandler)
	{
		NWValidateClientInSession(clientID, false, nextHandler);
	}

	// First: Check if a session with that name already exists
	firstFunction = function (err)
	{
		if (err != null) return NWError(err, res);
		
		db.sessions.findOne({sessionName: newSessionName}, function(err, sessions) 
		{
			//when session is not found
			if(err != null || sessions != null)
			{
				return NWError(ERRSessionExists, res);
			}

			console.log("Session not found \"" + newSessionName + "\", Creating a new session"); 
			secondFunction();
		});
			
	}

	// Second: Count the number of sessions to create a new session ID
	secondFunction = function()
	{
		db.sessions.count(function (err, numberOfSessions) 
		{
			if (err != null) return NWError(ERRUnknownServerError, res);

			thirdFunction(numberOfSessions);
		});
	}
	// Third: Create the new session and save it to the database
	thirdFunction = function(numberOfSessions)
	{
		var newGameSession = DBGameSession(newSessionName, numberOfSessions, clientID);
		db.sessions.save(newGameSession, function(err, saved) 
		{
			if (err != null || saved == null) return NWError(ERRUnknownServerError, res);
			
			console.log("Created New game session: " + JSON.stringify(newGameSession));
			// Update the current session for the user 
			db.users.update({clientID: clientID}, {$set:{currentSession: saved.sessionID}}, function(err, result) 
			{
				if (err != null) return NWError(ERRUnknownServerError, res);

				console.log("... Updating session info for client with ID: " + clientID);
				return NWGameSessionQuery(clientID, newGameSession, completionHandler);

			});
		});
	}

	validateFunction(firstFunction);
});


// GET The user's current session
// Approved for real on 4/11 at 5:08pm Sam and koki Commit: d8a64367
app.get(kGameServerEndpoints.getSesionWithID, function(req, res) 
{

	// Input Parameters: clientID, sessionID
	var clientID  = parseInt(req.cookies.clientID, 10);
	var sessionID = parseInt(req.params.sessionID, 10);

	console.log("Received a query for sessionID: " + sessionID + " from client with ID: " + clientID);

	// Output: Sesion Info
	var completionHandler = function (retVals)
	{
		res.json(retVals[0], retVals[1]);
		console.log(consoleDivEnd);
	}

	// Validate: clientID, sessionID
	if (NWValidateClientID(clientID)) 	return NWError(ERRInvalidClientID, res);
	if (NWValidateSessionID(sessionID)) return NWError(ERRInvalidPostParameter, res);


	var firstFunction;
	var secondFunction;
	var thirdFunction;
	var fourthFunction;
	var fifthFunction;

	// Validate Function: Check if the user is actually in the session they asked for
	var validateFunction = function(nextHandler)
	{
		NWValidateClientInSession(clientID, true, nextHandler);
	}

	// First: Query for session 
	firstFunction = function (err)
	{
		console.log("... Retrieving session data");
		if (err != null) return NWError(err, res);
		db.sessions.findOne({sessionID: sessionID}, function(err, session)
		{
			if (err != null || session == null) return NWError(ERRUnknownServerError, res);

			return NWGameSessionQuery(clientID, session, completionHandler);
		});
	}

	validateFunction(firstFunction);
}); 

// Delete to leave game sessions
// Aproved for real on 4/11 at 6:44 Sam and Koki: 7927e244
app.delete(kGameServerEndpoints.leaveSession, function(req, res)
{
	
	// Input: Cookie clientID
	var clientID  = parseInt(req.cookies.clientID, 10);

	console.log("Received request to leave a session from clientID: " + clientID);

	if (NWValidateClientID(clientID)) 	return NWError(ERRInvalidClientID, res);
	// Output: 200 OK
	var completionHandler = function ()
	{
		res.send(200, "");
		console.log(consoleDivEnd);
	}

	var firstFunction;
	
	// DBValidate: Client exists and client must be in a session
	var validateFunction = function(nextHandler)
	{
		NWValidateClientInSession(clientID, true, nextHandler);
	}

	
	firstFunction = function (err)
	{
		if (err != null) return NWError(err, res);

		// Find the user with clientID
		db.users.findOne({clientID: clientID}, function(err, user)
		{
			if (err != null || user == null) return NWError(ERRUnknownServerError, res);

			console.log("Removing Client from session: " + user.currentSession);
			// Update the user's current session to null
			db.users.update({clientID: clientID}, {$set:{currentSession: null}}, function (err, result)
			{
				if (err != null || result == null) return NWError(ERRUnknownServerError, res);
				// Find the session
				db.sessions.findOne({sessionID: user.currentSession}, function(err, session)
				{
					if (err != null || session == null) return NWError(ERRUnknownServerError, res);

					var indexOfClientInSessionArray = session.currentPlayers.indexOf(user.clientID);

					if (indexOfClientInSessionArray < 0)
					{
						console.log("Internal Inconsistency: Client: " + user.clientID + " is marked to be in session: '" + session.sessionName + "'' but that session does not contain clientID: " + user.clientID);
						console.log("Ignoring request to alter the Session in the databse.");
						return completionHandler();
					}

					if (session.numberOfPlayers -1 == 0)
					{
						console.log("Session with name: '" + session.sesionName + "' is now empty; removing empty session");
						db.sessions.remove({sessionID: session.sessionID});
						return completionHandler();
					}
					// Update the session's current players array
					console.log("... Updating the current players array for session: " + session.sessionID);
					db.sessions.update({sessionID: session.sessionID}, 
						{$pull:{currentPlayers: clientID}}, 
						function(err, innerResult)
					{
						if (err != null || innerResult == null) return NWError(ERRUnknownServerError, res);

						// Update the session's number of players
						console.log("... Updating the number of players to: " + (session.numberOfPlayers - 1));
						db.sessions.update({sessionID: session.sessionID}, 
							{$set: {numberOfPlayers: session.numberOfPlayers-1}}, 
							function(err, finalResult)
						{
							// this is the world record for nested function
							if (err != null || finalResult == null) return NWError(ERRUnknownServerError, res);
							return completionHandler();
						});
					});
				});
			});
		});
		
	}

	validateFunction(firstFunction);
});

/************************************************************/
/*							Execution						*/
/************************************************************/ 
//console.log('Possible routes: ' + JSON.stringify(app.routes, null, '\t'));
var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
