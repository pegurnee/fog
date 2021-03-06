var User = require('../models/users/user'),
  MongoClient = require('mongodb').MongoClient,
  ObjectId = require('mongodb').ObjectID,
  crypto = require('crypto'),
  database = require('../../config/config').db,
  success = 0,
  invalidUsername = 1,
  invalidPassword = 2,
  userExists = 3,
  insertError = 4;

exports.begin = function(req, res) {
  res.render('register/pages/register-home', {
    values: User.vals,
    user: {}
  });
};

exports.hashAndSalt = function(rawPassword, salt) {
  return crypto
      .createHash('sha1')
      .update(rawPassword + salt)
      .digest('hex');
};

exports.requiresNonBannedLogin = function(req, res, next) {
  var user = req.session.user;
  if (!user) {
    req.session.desiredPage = req.url;
    res.render('common/pages/login');
  } else if (user.status === 'banned') {
    res.render('common/pages/guess-what');
  } else {
    next();
  }
};

exports.login = function(req, res) {
  exports.getUser(req.body.username, req.body.password, function(err, user) {
    switch (err) {
      case invalidUsername:
        res.send({
          status: 'failure',
          message: 'That username doesn\'t exist'});
        break;
      case invalidPassword:
        res.send({
            status: 'failure',
            message: 'That\'s not your password!'
        });
        break;
      case success:
        req.session.user = user;

        var desiredPage = req.session.desiredPage;

        res.send({
          status: 'success',
          url: desiredPage || undefined
        });


    }
  });
};

exports.getUser = function(username, password, callback) {
  MongoClient.connect(database, function(err, db) {
    try {
      db.collection('users').findOne({
          username: username
        },
        function (err, doc) {
          if (!doc) {
            callback(invalidUsername);
          } else {

            var hashed = exports.hashAndSalt(password, doc.salt);
            if (hashed !== doc.password) {
              callback(invalidPassword);
            } else {
              callback(success, doc);
            }
          }
          db.close();
      });
    } catch (e) {
      res.render('common/pages/index');
    }
  });
};

exports.auth = function(req, res) {
  // var lookup = login(req.cookies['username'], req.cookies['password']);
  var lookup = login(req.body['username'], req.body['password']);
  console.log(lookup);
  res.end(lookup);
  // res.render('register/pages/register-home', {
  //   values: [req.body['username'], req.body['password']]
  // });
};

exports.findById = function(id, callback) {
  exports.find({_id: ObjectId(id)}, callback);
};

exports.find = function(query, callback) {
  MongoClient.connect(database, function(err, db) {
    db.collection('users').findOne(query || {}, function(err, user) {
      db.close();
      callback(err, user);
    });
  });
};

exports.register = function(user, callback) {
  user.salt = crypto.randomBytes(16);
  user.password = exports.hashAndSalt(user.password, user.salt);

  MongoClient.connect(database, function(err, db) {
    try {
      db.collection('users').insertOne(user,
        function (err, result) {
          db.close();
          if(result) {
              user._id = result.insertedId;
              callback(success, user);
          } else {
            user.password = '';
            callback(userExists, user);
          }
      });
    } catch (e) {
      console.log('Couldn\'t create user ' + username);

    }
  });
};

exports.create = function(req, res) {
  if (req.body.type === 'gamer') {
    req.body.games = {};
    req.body.creditCards = [];
  }
  exports.register(req.body, function(err, user) {
    if (err) {
      user.error = (err === userExists)? 'Username is taken': 'Unknown error';
      res.render('register/pages/register-home', {
        values: User.vals,
        user: user
      });
    } else {
      req.session.user = user;
      res.render('common/pages/index');
    }
  });
};

exports.logout = function(req, res) {
  req.session.user = undefined;
  req.session.desiredPage = undefined;
  res.render('common/pages/index');
};
