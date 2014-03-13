/************************************************************/
/*		Network Classes and Template Functions				*/
/************************************************************/

var kGameSessionObjectKeys = {
	"name": "sessionName",
	"id": "id",
	"activeSessions": "activeSessions",
	"currentPlayers": "currentPlayers"
};

var ERRClientNotMemberOfSession = 1;
var ERRUserNameOrDeviceAlreadyTaken = 2;
var ERRInvalidPostParameter = 3;
var ERRCookieIDMismatch = 4;

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

		case UserNameOrDeviceAlreadyTaken:
			description = "That username or deviceID are already taken on this server";
			statusCode = 401;

		case ERRInvalidPostParameter:
			description = "Invalid HTTP body received by the server";
			statusCode = 400;

		case ERRCookieIDMismatch:
			description = "Your clientID does not match the image at that location"
			statusCode = 401; // Unauthorized

		default:
			description = "Unkown server error";
			statusCode = 400;
			break; 
	}
	error["description"] = description;
	return [statusCode, {"Error": error}];
}

/* Used for creating a game session to store in the database */
function DBGameSession(name, sessionID, clientID) {
	var value = {
		"sessionName": name,
		"sessionID": sessionID,
		"numberOfPlayers": 1,
		"currentPlayers": [clientID],
		"timeStamp": null
	};
	return value;
}

function _CurrentPlayer(name, deviceID)
{
	return {
		"name": name, 
		"deviceID": deviceID, 
		"imageURL": kGameServerEndpoints.images.replace(":clientID", "1234567890")
	};
}

/* Used for populating the "currentPlayers" array */
function NWCurrentPlayers(currentClientIDsArray)
{
	return [
		_CurrentPlayer("Jeannie", "33"),
		_CurrentPlayer("Livy", "44"),
		_CurrentPlayer("Koki", "55")
	];
}

/* "NetWork Game Session" Used for Providing game session information to a client 
 * @return: [statusCode, JSONObject]
 * @Parameter: clientID: the ID of the client that is requesting the game session
 * @Parameter: dbGameSessionInstance: an instance of a DBGameSession on the database
 */
function NWGameSessionQuery(clientID, dbGameSessionInstance) {
	var retVal = [-1, {}];

	var currentPlayers = dbGameSessionInstance["currentPlayers"];
	var index = -1;
	index = currentPlayers.indexOf(clientID);
	if (!(index > -1)) {
		retVal = NWError(ERRClientNotMemberOfSession);
	} else {
		// The final function will map the clientIDs to Player Names from  the database here
		// We'll make some fake data for now
		currentPlayers = //[{"name" Sam"]

		retVal[1] = {
			"sessionName": 			dbGameSessionInstance["sessionName"],
			"sessionID": 		dbGameSessionInstance["sessionID"],
			"numberOfPlayers": 	dbGameSessionInstance["numberOfPlayers"] - 1,
			"currentPlayers": 	currentPlayers
		};
		retVal[0] = 200;
	}

	return retVal;
}

/* Used for providing all active game sessions to a client */
function NWActiveGameSessionsQuery(dbGameSessionInstance) {
	return {
		"sessionName": 		dbGameSessionInstance["sessionName"],
		"sessionID": 	dbGameSessionInstance["sessionID"]
	};
}

console.log(kGameSessionObjectKeys.name);

var kGameServerEndpoints = {
	"gameSessions": "/game_sessions",
	"joinSession": 	"/game_sessions/join",
	"images": 		"/images/:clientID.png",
	"login": 		"/login"
};

/************************************************************/
/*					Configuration							*/
/************************************************************/

var express = require('express');
var http = require('http');
var path = require('path');
 
var app = express();
 
// all environments
app.set('port', process.env.PORT || 3000);
 
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
 

/************************************************************/
/*						Methods								*/
/************************************************************/

//--------------------- Login ------------------------------//

app.post(kGameServerEndpoints.login, function(req, res)
{
	console.log("Got a Login");
	try {
		var userName = req.body.username;
		var deviceID = req.body.deviceID;
		var clientID = 1234567890;
		if (1) {
			res.cookie('clientID',clientID);
			redirectPath = kGameServerEndpoints.images.replace(":clientID", clientID.toString());
			res.redirect(302, redirectPath)
		}
	}
	catch (err)
	{
		var retVals = NWError(ERRInvalidPostParameter); // returns: [statusCode, Error JSON]
		res.json(retVals[0], retVals[1]);
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
			//console.log("Recieved valid, complete login from client: " + clientID.toString() + " with data: " + req.data);
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
app.get(kGameServerEndpoints.gameSessions, function(req, res) {
	console.log("Got a game sessions query!");
	var activeSessions = [
		NWActiveGameSessionsQuery(DBGameSession("Koki's session LOL", 0, 1234567890)),
		NWActiveGameSessionsQuery(DBGameSession("Livy's awesome possum", 1, 1234567890)),
		NWActiveGameSessionsQuery(DBGameSession("Jeannie rocks socks", 2, 1234567890)),
		NWActiveGameSessionsQuery(DBGameSession("ARtists", 3, 1234567890)),
		NWActiveGameSessionsQuery(DBGameSession("Your Mom's Session", 4, 1234567890))
	];

	var message = {}
	message[kGameSessionObjectKeys.activeSessions] = activeSessions;
	
	res.json(200, message);
}); 

// Join a game session
app.post(kGameServerEndpoints.joinSession, function(req, res) {
	console.log("Got an attempt to join!");
	var clientID = req.cookies.clientID;
	var dbSession = DBGameSession("Jeannie rocks socks", 3, 1234567890);
	var retVal = NWGameSessionQuery(1234567890, dbSession);
	if (retVal[0] == 200) {
		var session = retVal[1];
		session.currentPlayers = NWCurrentPlayers(null);
		session.numberOfPlayers = session.currentPlayers.length;
		retVal[1] = session;
	}

	res.json(retVal[0], retVal[1]);

});

/************************************************************/
/*							Execution						*/
/************************************************************/ 
console.log('Possible routes: ' + JSON.stringify(app.routes, null, '\t'));
var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

