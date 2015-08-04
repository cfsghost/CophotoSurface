var fs = require('fs');
var os = require('os');
var child_process = require('child_process');
var path = require('path');
var events = require('events');
var cofs = require('co-fs');
//var sharp = require('sharp');
var sharp = '';
var parse = require('co-busboy');
var Router = require('koa-router');

var dispatcher = new events.EventEmitter();
dispatcher.setMaxListeners(0);

/* Loading photo list */
var uploadDir = path.join(__dirname, '..', 'uploads');
var tmpDir = path.join(__dirname, '..', 'tmp');
var pendingDir = path.join(__dirname, '..', 'pending');
var photoDir = path.join(__dirname, '..', 'photo');
var dataList = [];
fs.readdir(photoDir, function(err, list) {
	for (var index in list) {
		photo = list[index];
		if (photo[0] == '.')
			continue;

		var id = photo.split('.')[0];
		dataList.push({
			id: id,
			ts: id
		});
	}
});

fs.watch(photoDir, function(event, filename) {
	if (event == 'rename')
		dispatcher.emit('newphoto');
});

// Pending
var pendingList = [];
fs.readdir(pendingDir, function(err, list) {
	for (var index in list) {
		photo = list[index];
		if (photo[0] == '.')
			continue;

		var id = photo.split('.')[0];
		pendingList.push({
			id: id,
			ts: id
		});
	}
});

fs.watch(pendingDir, function(event, filename) {
	console.log(event, filename);
	if (event == 'rename') {

		var ts = parseInt(filename.split('.')[0]);
		console.log(ts);
		pendingList.push({
			id: ts,
			ts: ts
		});

		dispatcher.emit('incoming', filename);
	}
});

var router = module.exports = new Router();

router.get('/pending/events', function *() {

	this.set('Cache-Control', 'no-cache');

	this.body = {
		ts: Date.now(),
		photos: pendingList
	};
});

router.get('/pending/events/:ts', function *() {

	this.set('Cache-Control', 'no-cache');

	if (!this.params.ts) {
		this.body = {
			ts: Date.now()
		};
		return;
	}

	var updatedTime = parseInt(this.params.ts);

	var list = [];
	for (var index in pendingList) {
		var photo = pendingList[index];
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
		var self = this;
		yield function(callback) {

			dispatcher.once('incoming', function() {
				callback();
			});
		};
	}
});

router.get('/', function *() {
    yield this.render('photosurface');
});

router.get('/incoming', function *() {
    yield this.render('incoming');
});

router.post('/', function *() {
    this.body = 'done';
});

router.get('/events', function *() {

	this.set('Cache-Control', 'no-cache');

	this.body = {
		ts: Date.now(),
		photos: dataList
	};
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
		var self = this;
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
	var filename = path.join(uploadDir, Id + path.extname(part.filename));
	var targetFilename = path.join(tmpDir, Id + '.jpg');
	var stream = fs.createWriteStream(filename);
	part.pipe(stream);

	stream.on('close', function() {

		sharp(stream.path).rotate().jpeg().quality(100).toFile(targetFilename, function() {

			console.log('uploading %s -> %s -> %s', part.filename, stream.path, targetFilename);

			fs.unlink(stream.path, function() {

				// Move photo to specific directory
				var moveCmd = child_process.spawn('mv', [ targetFilename, pendingDir ]);
				moveCmd.on('close', function() {
					//dispatcher.emit('newphoto');
				});
			});
		});
	});

//	console.log('uploading %s -> %s', part.filename, stream.path);

	this.body = {
		id: Id 
	};

	dataList.push({
		id: Id,
		ts: Id
	});
});

router.get('/incoming/:id', function *() {

	var id = this.params.id;
	var filename = path.join(pendingDir, id);

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
