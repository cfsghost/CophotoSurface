var fs = require('fs');
var os = require('os');
var path = require('path');
var events = require('events');
var cofs = require('co-fs');
var parse = require('co-busboy');
var Router = require('koa-router');

var dispatcher = new events.EventEmitter();

/* Loading photo list */
var photoDir = path.join(__dirname, '..', 'photo');
var dataList = [];
fs.readdir(photoDir, function(err, list) {
	for (var index in list) {
		photo = list[index];

		var id = photo.split('.')[0];
		dataList.push({
			id: id,
			ts: id
		});
	}
});

var router = module.exports = new Router();

router.get('/', function *() {
    yield this.render('photosurface');
});

router.post('/', function *() {
    this.body = 'done';
});

router.get('/events/:ts', function *() {

	this.set('Cache-Control', 'no-cache');

	if (!this.params.ts) {
		this.body = {
			ts: Date.now()
		};
		return;
	}

	var updatedTime = parseInt(this.params.ts);

	var list = [];
	for (var index in dataList) {
		var photo = dataList[index];
		if (photo.ts <= updatedTime)
			continue;

		list.push(photo);
	}
	var result = {
		ts: Date.now(),
		photos: list
	};
	this.body = result;

	if (!list.length) {
		yield function(callback) {

			dispatcher.once('newphoto', function() {
				callback();
			});
		};
	}
});

router.get('/takephoto', function *() {
    yield this.render('takephoto');
});

router.post('/uploadphoto', function *() {

	if (!this.request.is('multipart/*'))
		return yield next;

	var parts = parse(this);
	var part;

	// Getting target path to put file
	var Id = Date.now();

	// Save one file only
	var part = yield parts;
	var filename = path.join(photoDir, Id + path.extname(part.filename));
	var stream = fs.createWriteStream(filename);
	part.pipe(stream);
	console.log('uploading %s -> %s', part.filename, stream.path);

	this.body = {
		id: Id 
	};

	dataList.push({
		id: Id,
		ts: Id
	});

	dispatcher.emit('newphoto');
});

router.get('/photo/:id', function *() {

	var id = this.params.id;
	var filename = path.join(photoDir, id);

	if (!id)
		return;

	if (yield cofs.exists(filename + '.jpg')) {
		this.type = '.jpg';
		this.body = fs.createReadStream(filename + '.jpg');
	} else if (yield cofs.exists(filename + '.png')) {
		this.type = '.png';
		this.body = fs.createReadStream(filename + '.png');
	} else if (yield cofs.exists(filename + '.gif')) {
		this.type = '.gif';
		this.body = fs.createReadStream(filename + '.gif');
	} else {
		this.status = 404;
		this.body = 'Not Found';
	}
});
