const express = require("express"); // Importing express module
const app = express(); // Creating express app
const server = require("http").Server(app); // Creating server using express app
const io = require("socket.io")(server); //importing the socket.io library and initializing it with the server object. This allows the server to listen for and handle WebSocket connections from clients.
const { v4: uuidV4 } = require("uuid");  // importing the uuid library and assigning the v4 method of the library to a variable named uuidV4. This method generates a random UUID (Universally Unique Identifier) which can be used as a unique identifier for various purposes in the application.
require("dotenv").config(); // For handling enviornment variables

const bodyParser = require("body-parser"); //The body-parser library is used to parse incoming request bodies in middleware before the handlers, making it easier to handle data sent in HTTP requests.
const ejs = require("ejs");
const mongoose = require("mongoose"); // Mongoose for handling mongo db
app.use("/", require("./routes/room.js")); // For '/' request send the room.js file

//This library provides middleware for creating and managing user sessions in an Express.js application. It allows the server to store session data on the server-side and associate it with a unique session ID that is sent to the client in a cookie. This enables the server to maintain stateful information about the user across multiple requests.
const session = require("express-session");
const passport = require("passport"); //is a popular authentication middleware for Node.js applications. It provides a flexible and modular way to implement authentication strategies, such as local authentication with username and password, OAuth, and OpenID. 
const passportLocalMongoose = require("passport-local-mongoose");// This library is a Mongoose plugin that simplifies building username and password login with Passport. It provides a set of methods to add username and password fields to a Mongoose schema, and to authenticate users against those fields. By using passport-local-mongoose, developers can easily add authentication to their Mongoose models.
const GoogleStrategy = require("passport-google-oauth20").Strategy;// For handling google authentication
const findOrCreate = require("mongoose-findorcreate"); // adding this method allows developers to search for a document in the database and create it if it doesn't exist, all in a single operation.

app.use(express.static("public")); // For using ejs as frontend
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

/***
 * The below code is setting up a session middleware using the express-session library. The session function takes an object with configuration options as its argument.
 * The secret option is a string used to sign the session ID cookie. It should be a long, random string to prevent attackers from guessing the session ID and hijacking the session.
 * The resave option determines whether the session should be saved back to the session store on every request, even if the session was not modified. Setting this to false can improve performance.
 * The saveUninitialized option determines whether a session should be created for a new user who hasn't logged in yet. Setting this to false can help reduce server storage usage and comply with privacy laws.
*/
app.use(
  session({
    secret: "Our Little Secret",
    resave: false,
    saveUninitialized: false,
  })
);


/***
 * The below code is setting up Passport.js middleware for authentication in an Express.js application.
 * passport.initialize() initializes Passport and adds it as middleware to the Express.js application. This middleware is responsible for setting up Passport's authentication strategies and mounting Passport's middleware functions to the application's request object.
 * passport.session() adds middleware to the Express.js application that will restore any existing login session from a user's cookie. This middleware is required for persistent login sessions, as it allows Passport to deserialize the user object from the session data stored on the server.
 */
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB"); // Connecting to mongodb platform

// Creating the schema for the MongoDb application
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
});

// Adding the two extra methods that we already imported
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema); // Creating a MongoDb user

/***
 * The selected code is setting up Passport.js authentication strategies and serialization functions for a User model in an Express.js application.
 * passport.use(User.createStrategy()) sets up a local authentication strategy for Passport using the User model. This strategy will be used to authenticate users based on their username and password.
 * passport.serializeUser() is a function that is called by Passport to serialize the user object into the session. The User object is passed as the second argument to the done function, which is called when serialization is complete.
 * passport.deserializeUser() is a function that is called by Passport to deserialize the user object from the session. The User object is passed as the second argument to the done function, which is called when deserialization is complete.
 */
passport.use(User.createStrategy());
passport.serializeUser(function (User, done) {
  done(null, User);
});

passport.deserializeUser(function (User, done) {
  done(null, User);
});

let connections = []; // Making a list of all the connections

//socket handels users joining/leaving and messaging
io.on("connection", (socket) => {
  //request for joining room
  socket.on("join-room", (roomId, userId, userName) => {
    socket.join(roomId); //joining the mentioned room
    socket.broadcast.to(roomId).emit("user-connected", userId, userName);
    socket.on("send-message", (inputMsg, userName) => {
      io.to(roomId).emit("recieve-message", inputMsg, userName);
    });
    socket.on("disconnect", () => {
      socket.broadcast.to(roomId).emit("user-disconnected", userId, userName);
    });
  });
});

// 
io.on("connect", (socket) => {
  connections.push(socket); // Pushing the socket object once a client is connected
  console.log(`${socket.id} has connected`);

  socket.on("down", () => {
    console.log("down data");
    // connections.forEach((con) => {
    //   if (con.id !== socket.id) {
    //     con.emit("ondown", { x: data.x, y: data.y });
    //   }
    // });
  });
  

  socket.on("draw", (data) => {
    console.log("my data", data);
    connections.forEach((con) => {
      if (con.id !== socket.id) {
        con.emit("ondraw", { x: data.x, y: data.y });
      }
    });
  });
  // If some client gets disconnected
  socket.on("disconnect", (reason) => {
    console.log(`${socket.id} is disconnected`);
    connections = connections.filter((con) => con.id !== socket.id); // filter the connections array removing the socket object of the particular client
  });
});

//   passport.use(new GoogleStrategy({
//     clientID:    process.env.CLIENT_ID,
//     clientSecret: process.env.CLIENT_SECRET,
//     callbackURL: "http://localhost:3000/auth/google/helper",
//     passReqToCallback: true

//   },
//   function(request, accessToken, refreshToken, profile, done) {
//     User.findOrCreate({ googleId: profile.id }, function (err, user) {
//         console.log(user);
//       return done(err, user);
//     });
//   }
// ));

// Authenticating users using the passport-google-oauth20 library.

let vish;
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/helper",
      passReqToCallback: true,
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (request, accessToken, refreshToken, profile, cb) {
      console.log(profile);
      vish=profile.emails[0].value; 
      // finds or creates a User document in the database using the findOrCreate method from the passport-local-mongoose library.
      User.findOrCreate(
        { username: profile.emails[0].value, googleId: profile.id },
        function (err, user) {
         
          return cb(err, user);
        }
      );
    }
  )
);

let a;

// a = uuidV4() generates a random UUID (Universally Unique Identifier) using the uuidV4 function from the uuid library and assigns it to a variable named a. This UUID can be used as a unique identifier for the client's session.
app.get("/", function (req, res) {
  a = uuidV4();
  res.redirect(`/${a}`);
});

app.get("/helper", function (req, res) {
  console.log("dddd");

  console.log("qwerty");
  res.redirect("/" + a);
});

app.get("/:room", function (req, res) {
  console.log("123");
  if (req.isAuthenticated()) {
    console.log("faf");
    res.render("room", { roomId: req.params.room,vish:vish});
  } else {
    console.log("ff");
    res.redirect("/auth/google");
  }
});

// app.get('/auth/google',
//   passport.authenticate('google', { scope:
//       ['profile'] }
// ));
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/helper",
  passport.authenticate("google", {
    successRedirect: "/helper",
    failureRedirect: "/auth/google",
  })
);

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    socket.on("ready", () => {
      socket.to(roomId).emit("user-connected", userId);
    });
    socket.on("message", (senderID, message) => {
      console.log(message);
      io.to(roomId).emit("createMessage", senderID, message);
    });
socket.on("pee_to_mon",(id)=>{
  
})
    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });
});

server.listen(3000);
