//  OpenShift sample Node application
var express = require('express'),
    fs      = require('fs'),
    app     = express(),
    eps     = require('ejs'),
    resizer = require('./routes/resizer'),
    morgan  = require('morgan');


var router = express.Router();
var Jimp = require("jimp");
var md5 = require('md5');
var http = require('http');
var imagesFolder = "public/images/";
var path = require('path');
var Promise = require('es6-promise').Promise;
var request = require('request');
Object.assign=require('object-assign');

app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'))

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
      mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
      mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
      mongoPassword = process.env[mongoServiceName + '_PASSWORD']
      mongoUser = process.env[mongoServiceName + '_USER'];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;

  }
}
var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
  if (mongoURL == null) return;

  var mongodb = require('mongodb');
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: %s', mongoURL);
  });
};

app.get('/', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  var options = createOptions(req.query);
  getLocalCopyOfSourceImage(options, imagesFolder).then(function(filePath){
    var croppedFilePath = imagesFolder + md5(req.originalUrl) + path.extname(options.src);
    Jimp.read(filePath, function (err, lenna) {
      if (err) throw err;
      var jimpObj = lenna;
      fs.readFile(croppedFilePath, function(err, data){
        if (!err) {
          res.contentType(jimpObj._originalMime);
          res.end(data, 'binary');
        } else {
          jimpObj.resize(options.width, Jimp.AUTO)
              .quality(options.quality)
              .crop(0, 0, options.cropWidth, options.cropHeight)
              .write(croppedFilePath)
              .getBuffer(Jimp.AUTO, function (err, result) {
                res.contentType(jimpObj._originalMime);
                res.end(result, 'binary');
              })
        }
      });

    });

  }, function(){
    res.sendStatus(404);
  });



});

function createOptions(query){
  return options = {
    src: query.src,
    width: parseInt(query.width),
    cropWidth: parseInt(query.width),
    cropHeight: parseInt(query.height),
    quality: parseInt(query.quality) | 20
  };
}

function getLocalCopyOfSourceImage(options, imagesFolder){
  return new Promise(
      function(resolve, reject) {
        var src = options.src, localFilePath = imagesFolder + md5(src) + path.extname(src);
        fs.access(localFilePath, fs.constants.R_OK, function(err){
          if (!err) {
            resolve(localFilePath)
          } else {
            request.get(src, function (err, res, body) {
              console.log(res.statusCode); // 200
              console.log(res.headers['content-type']);
              if(res.statusCode = 200) {
                resolve(localFilePath)
              } else {
                reject({statusCode: 404})
              }
            }).pipe(fs.createWriteStream(localFilePath));
          }
        });
      }
  );
}



app.get('/pagecount', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    db.collection('counts').count(function(err, count ){
      res.send('{ pageCount: ' + count + '}');
    });
  } else {
    res.send('{ pageCount: -1 }');
  }
});

// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;
