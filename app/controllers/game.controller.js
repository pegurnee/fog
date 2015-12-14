var config = require('../../config/config'),
    DecompressZip = require('decompress-zip'),
    fs = require('fs'),
    MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
    parseUrl = require('url').parse,
    path = require('path'),
    unzip = require('unzip2');

exports.play = function(req, res) {
  var game = req.game;
  res.render('games/pages/game', {
    title: game.title,
    scripts: game.config.scripts || [],
    styles: game.config.styles || [],
    startingPoint: game.config.startingPoint,
    gamePath: '/game-files/' + req.game.gamePath,
    cookie: req.cookies
  });
};

exports.checkout = function(req, res) {
  var user = req.session.user;

  req.session.desiredPage = req.url;

  if (!user || user.type !== 'gamer') {
    res.json({
      status: 'failure',
      message: 'You aren\'t logged in as a gamer'
    })
  } else if (user.creditCards && user.creditCards.length) {
    res.render('gamers/pages/purchase', {
      game: req.game,
      user: user
    })
  } else {
    res.redirect('/gamers/add-card');
  }
};

exports.purchase = function(req, res) {
  var user = req.session.user,
      game = req.game,
      gameId = game._id,
      discount = (100 - (game.sale || 0)) / 100,
      gameInfo = {
        id: gameId,
        playTime: 0,
        price: req.game.price
      };

  var gameObject = {};
  gameObject['games.' + gameId] = gameInfo;
  MongoClient.connect(config.db, function(err, db) {
    db.collection('users').update(
      { _id: ObjectId(user._id)},
      { $set: gameObject},
      function (err, game) {
        req.session.user.games[gameId] = gameInfo;
        res.render('gamers/pages/confirmation', {
          game: req.game
        });
      }
    );
  });
};

var extract = function(game) {
  var inputPath = game.files.compressed,
      outputPath = './uploads/games/published/' + game.developer + '/',
      originalDirectoryName = game.originalFilename.replace(/\..*/, ''),
      configPath = (outputPath + '/' + originalDirectoryName + '/fog.json');

  var unzipper = new DecompressZip(inputPath);

  unzipper.on('error', function (err) {
      console.log('Caught an error');
  });

  unzipper.on('extract', function (log) {
      console.log('Finished extracting');
  });

  unzipper.extract({
      path: outputPath,
      filter: function (file) {
          return file.type !== "SymbolicLink";
      }
  });

};

exports.accept = function(req, res) {
  var game = req.game,
      inputPath = './uploads/games/pending/' + game.files.compressed,
      outputPath = './uploads/games/published/' + game.developer,
      originalDirectoryName = game.originalFilename.replace(/\..*/, ''),
      configPath = (outputPath + '/' + originalDirectoryName + '/fog.json');

  var gameConfig = JSON.parse(fs.readFileSync(configPath));

  MongoClient.connect(config.db, function(err, db) {
    db.collection('games').update(game, {
      $set: {
        gamePath: game.developer + '/' + originalDirectoryName + '/',
        config: gameConfig,
        status: 'accepted'
      },
    }, function (err, game) {
      req.game = game;
      db.close();
      res.json({
        status: 'success'
      });
    });
  });
};

exports.download = function(req, res) {
  res.download(
    req.game.files.compressed,
    req.game.originalFilename
  );
};

exports.readPending = function(req, res) {
  res.render('dev/pages/pending', {
    game: req.game,
    cookie: req.cookies
  });
}

var mkdirRecursiveSync = function(directory) {

  try {
    fs.mkdirSync(directory);
  } catch (e) {
    if (e.errno !== -17) {
      mkdirRecursiveSync(path.dirname(directory));
      fs.mkdirSync(directory);
    }
  }
};

var saveMedia = function(file, game, callback) {
  var mediaDirectory = './uploads/media/',
      outputDirectory = mediaDirectory + game.developer + '/' + game.title,
      outputPath = outputDirectory + '/' + file.originalname;

  console.log('saving file: ' + outputPath);
  mkdirRecursiveSync(outputDirectory);//, function() {
  fs.renameSync(file.path, outputPath, function(data) {
    console.log('file saved: ' +  outputPath);
  });

  outputPath = outputPath.replace(mediaDirectory, '');
  return outputPath;
};

exports.newGame = function(req, res) {
  res.render('dev/pages/newGame', {
    cookie: req.cookies
  });
};

exports.submit = function(req, res) {
  var body = req.body,
      files = req.files;
  console.log('files');
  var gameFile = files['gameFile'][0],
      banner = files['banner'][0],
      icon = files['icon'][0],
      images = files['images'] || [],
      videos = files['videos'] || [],
      filePath = './' + gameFile.path.replace(/(\.\.\/)*/, ''),
      developer = req.session.user.username;

  var tempGame = {
    title: body.gameTitle,
    developer: developer
  }

  var bannerLocation = saveMedia(banner, tempGame);
  var iconLocation = saveMedia(icon, tempGame);
  var imageLocations = [];
  images.forEach(function(image) {
    imageLocations.push(saveMedia(image, tempGame));
  });

  var videoLocations = [];
  videos.forEach(function(video) {
    videoLocations.push(saveMedia(video, tempGame));
  });

  MongoClient.connect(config.db, function(err, db) {
    if (err) {
      console.log('error: ' + err);
    }
    db.collection('games').insertOne({
      title: body.gameTitle,
      description: body.description,
      developer: developer,
      originalFilename: gameFile.originalname,
      status: 'pending',
      price: body.price,
      files: {
        compressed: filePath,
        banner: bannerLocation,
        icon: iconLocation,
        images: imageLocations,
        videos: videoLocations
      }
    }, function(err, inserted) {
      inserted = inserted.ops[0];
      extract(inserted);
      db.close();
      res.redirect('/games/' + inserted._id);
    });
  });

};

exports.getGamesById = function(ids, callback) {
  var idList = [];
  ids.forEach(function(id) {
    idList.push({ _id: ObjectId(id)});
  });
  exports.getGames({$or: idList}, callback);
};

exports.getById = function(req, res, next, id) {
  MongoClient.connect(config.db, function(err, db) {
    try {
      db.collection('games').findOne({_id: ObjectId(id)},
        function (err, game) {
          req.game = game;
          db.close();
          next();
      });
    } catch (e) {
      console.log('Game not found: ' + id);
      next();
    }
  });
};

exports.store = function(req, res) {
var params = parseUrl(req.url, true).query,
    query = params['query'] || '',
    regex = new RegExp('.*' + query + '.*', 'i'),
    condition = query? {
      status: 'accepted',
      '$or': [
        { title: regex },
        { description: regex }
      ]
    } : {status: 'accepted'};

  exports.getGames(condition, function(games) {
    res.render('games/pages/store', {
      games: games
    });
  });
};

exports.getGames = function(query, callback, limit) {
  // allow for just a callback to be passed
  if (!callback) {
    callback = query;
    query = {};
  }

  //limit of 0 means no limit
  var limit = limit || 0;

  // find the games
  MongoClient.connect(config.db, function(err, db) {
    db.collection('games').find(query, function(err, cursor) {
      var games = [];

      cursor.limit(limit);
      cursor.each(function(err, game) {
        if (game) {
          games.push(game);
        } else {
          db.close();
          callback(games);
        }
      });
    });
  });
};

/*
  Gets N games or 5 if quantity field in query is not submitted.
  Gets featured games unless there are none, then
    it just gets any N games.
*/
exports.getFeatured = function(req, res) {
  var quantity = parseInt(req.query.quantity) || 0;
  exports.getGames({featured: true}, function(featuredGames) {

    if (featuredGames.length === 0) {
      exports.getGames({}, function(anyGames) {
        res.send(anyGames);
      });
    } else {
      res.send(featuredGames);
    }
  }, quantity);
};

exports.toggleFeatured = function(req, res) {
  var featured = false;
  if (req.game.featured === undefined || req.game.featured === false) {
    featured = true;
  }

  MongoClient.connect(config.db, function(err, db) {
    try {
      db.collection('games').update(
        { _id: ObjectId(req.game._id)},
        { $set: {featured: featured}},
        function (err, data) {
          if (err) {
            res.send(err);
          } else {
            res.send(featured);
          }
          db.close();
        }
      );
    } catch (err) {
      res.send(err);
    }
  });
};

exports.updateSale = function(req, res) {
  var sale = req.body.sale

  MongoClient.connect(config.db, function(err, db) {
    try {
      db.collection('games').update(
        { _id: ObjectId(req.game._id)},
        { $set: {sale: sale}},
        function (err, data) {
          if (err) {
            res.send(err);
          } else {
            res.send(sale);
          }
          db.close();
        }
      );
    } catch (err) {
      res.send(err);
    }
  });

};
