var Jimp = require("jimp");
var md5 = require('md5');
var imagesFolder = "images/";
var fs = require('fs');
var path = require('path');
var Promise = require('es6-promise').Promise;
var request = require('request');
fs.access(imagesFolder, fs.constants.R_OK, function(err){
	if (err) {
		fs.mkdir(imagesFolder);
	}
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

module.exports.route = function (req, res, next) {
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

};
