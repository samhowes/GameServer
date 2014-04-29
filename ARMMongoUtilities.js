/********************************************************************/
/* Utility Functions												*/
/********************************************************************/

var consoleDiv 	  = "---------------------------------------------------";
var consoleDivEnd = "***************************************************";
var listall = function()
{
	print(consoleDiv);
	print("Current Users: ")
	listUsers();
	print(consoleDiv);
	print("Current Sessions: ");
	listSessions();
	print(consoleDivEnd);
}

var listUsers = function()
{
	var query = db.users.find({},{_id:0, clientID:1, userName:1, deviceID:1, imageURL:1, currentSession:1}).sort({clientID:1});
	if (query.count() == 0)
	{
		print("No users in the database");
	}
	else
	{
		query.forEach(printjson)
	}
}

var listSessions = function()
{
	var query = db.sessions.find({},{_id:0, sessionID:1, sessionName:1, numberOfPlayers:1, currentPlayers:1}).sort({sessionID:1});
	if (query.count() == 0)
	{
		print("No sessions in the database");
	}
	else
	{
		query.forEach(printjson)
	}
}

/********************************************************************/
/* Demo Functions													*/
/********************************************************************/


var installDemo = function () 
{
	print("Inserting default users and a game session into the database...")
	installDemoUsers()
	installDemoSessions();

	print("Completed!");
	listall();
	
}

var removeDemo = function()
{
	print("Dropping the demo from the database...");
	removeDemoSession()
	removeDemoUsers();
	print("Completed!");
	listall();
}



var demoSessionID = 1000;
var demoSessionName = "The ARtists Demo";

var demoUsers = 
[{
	userName: "Sam", 
	deviceID: 1, 
	clientID: 1001, 
	hasCompletedLogin: true, 
	imageURL: "/images/1001.png", 
	currentSession: demoSessionID,
	creationTimeStamp: new Date()
},
{
	userName: "Livy", 
	deviceID: 2, 
	clientID: 1002, 
	hasCompletedLogin: true, 
	imageURL: "/images/1002.png", 
	currentSession: demoSessionID,
	creationTimeStamp: new Date()
},
{
	userName: "Koki", 
	deviceID: 3, 
	clientID: 1003, 
	hasCompletedLogin: true, 
	imageURL: "/images/1003.png", 
	currentSession: demoSessionID,
	creationTimeStamp: new Date()
}]

var demoSession = 
{
	"sessionName": "The ARtists Demo",
	"sessionID": demoSessionID,
	"numberOfPlayers": 3,
	"currentPlayers": [1001, 1002, 1003],
	"timeStamp": new Date()
};
var installDemo;
var installDemoUsers;
var installDemoSessions;
var removeDemo;
var removeDemoSession;
var removeDemoUsers;


installDemoUsers = function()
{
	demoUsers.forEach(function(element, index, array)
	{
		print("... Creating user: '" + element.userName + "'")
		db.users.save(element);
	});
}

installDemoSessions = function ()
{
	print("... Creating session with name: '" + demoSessionName + "' and ID: " + demoSessionID )
	db.sessions.save(demoSession);
}

removeDemoSession = function ()
{
	print("Dropping default session...")
	db.sessions.remove({sessionID:demoSessionID});
}

removeDemoUsers = function ()
{
	print("Dropping default users from the database...")
	demoUsers.forEach(function(element, index, array)
	{
		print("... Dropping user: '" + element.userName + "'")
		db.users.remove({clientID:element.clientID});
	});
}
