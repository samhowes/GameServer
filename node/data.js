/*var Session = require('./app.js'); 
 
//example 
var koki = new Session();
koki.sessionName = "I IS AWESOME";  

koki.save(function(error,koki) {
	if(error)
		console.log(error);
	else
		console.log('User saved:' + koki); 
}); 

/*var j = new session({name: "Jeannie rocks socks", sessionsID: 1}); 
var sam = new session({name: "ARtists", sessionsID: 0});
var livy = new session({name: "Your Mom's Session", sessionsID: 2});  */

//lol.Session.findOne({sessionName: "I IS AWESOME"}); 

/*
var databaseUrl = "mydb"; // "username:password@example.com/mydb"
var collections = ["users", "reports"]
var db = require("mongojs").connect(databaseUrl, collections);

db.users.save({email: "srirangan@gmail.com", password: "iLoveMongo", sex: "male"}, function(err, saved) {
  if( err || !saved ) console.log("User not saved");
  else console.log("User saved");
});

db.users.save({email: "srirangan@gmail.com", password: "iLoveMongo", sex: "male"}, function(err, saved) {
  if( err || !saved ) console.log("User not saved");
  else console.log("User saved");
});

db.users.find(function(err, users) {
  if (err) return console.error(err);
  console.dir(users);
});
*/
