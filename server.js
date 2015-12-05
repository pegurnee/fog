var rl = require('readline').createInterface(process.stdin, process.stdout),
    express = require('express'),
    morgan = require('morgan'),
    app = express(),
    bodyParser = require('body-parser'),
    config = require('./config/config'),
    methodOverride = require('method-override'),
    session = require("express-session"),
    User = require('./app/models/users/user'),
    port = config.port || 8080;

app.set('views', './app/views');
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(methodOverride());

app.use(morgan('dev'));
app.use(session({resave: true, saveUninitialized: true,
  secret: 'NOTSOSECRET', cookie: { maxAge: 60000}}));
app.use(function(req, res, next) {
  res.locals.session = req.session;

  //temporary for development
  /*req.session.user = new User('thoffman_dev',
    'tyler', 'hoffman', '1234', 'thoff@power-cosmic.org');
  req.session.user.type = 'guest';*/

  next(null, req, res);
});

require('./app/routes/common.routes')(app);
require('./app/routes/forum.routes')(app);
require('./app/routes/game.routes')(app);
require('./app/routes/register.routes')(app);
require('./app/routes/dev.routes')(app);

app.use(express.static('./public'));

app.listen(port);
console.log('listening on port ' + port);

rl.on('line', function(line) {
  if (line.trim().match(/^exit|q(?:uit)?$/i)) {
    process.exit(0);
  }
});
