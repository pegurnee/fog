var path = require('path');

module.exports = function(app) {

  var libPath = path.join(__dirname, '../../public/lib/');

  app.get('/', function(req, res) {
    res.render('common/pages/index');
  });

  app.get('/lib/ajaxer.js', function(req, res) {
    res.sendFile(libPath + 'ajaxer/lib/ajaxer.js');
  });

  app.get('/lib/jqlite.js', function(req, res) {
    res.sendFile(libPath + 'jqlite/lib/jqlite.js');
  });
};
