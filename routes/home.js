var fs = require('fs');
var os = require('os');
var child_process = require('child_process');
var path = require('path');
var events = require('events');
var cofs = require('co-fs');
var sharp = require('sharp');
//var sharp = '';
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
	console.log('[photo]', event, filename);
	if (event == 'rename') {
		fs.exists(path.join(photoDir, filename), function(exists) {
			if (!exists)
				return;

			var id = parseInt(filename.split('.')[0]);
			dataList.push({
				id: id,
				ts: Date.now()
			});
			dispatcher.emit('newphoto');
		});
	}
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
	console.log('[pending]', event, filename);
	if (event == 'rename') {
		fs.exists(path.join(pendingDir, filename), function(exists) {
			if (!exists)
				return;

			var id = parseInt(filename.split('.')[0]);
			pendingList.push({
				id: id,
				ts: Date.now()
			});

			dispatcher.emit('incoming', filename);
		});
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

router.post('/uploadphoto', function *(next) {

	if (!this.request.is('multipart/*'))
		return yield next;

	//console.log(this.req);

	var parts = parse(this, {
		partsLimit: function() {
			console.log('partsLimit');
		},
		filesLimit: function() {
			console.log('filesLimit');
		},
		fieldsLimit: function() {
			console.log('fieldsLimit');
		}
	});
	var part;

	// Getting target path to put file
	var Id = Date.now();

	// Save one file only
	var part = yield parts;
//console.log(part);
	var filename = path.join(uploadDir, Id + path.extname(part.filename));
	var targetFilename = path.join(tmpDir, Id + '.jpg');
	var stream = fs.createWriteStream(filename);
	part.pipe(stream);

	part.on('data', function(chunk) {
		console.log(chunk.length);
	});
//console.log(1);
	stream.on('close', function() {
//console.log(2);

		sharp(stream.path).rotate().jpeg().quality(100).toFile(targetFilename, function() {
//console.log(3);

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
console.log('DONE');
//	console.log('uploading %s -> %s', part.filename, stream.path);

	this.body = {
		id: Id 
	};
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

router.get('/incoming/:id/:action', function *() {
	var id = this.params.id;
	var action = this.params.action;

	var filename = path.join(pendingDir, id);

	if (!id)
		return;

	if (yield cofs.exists(filename + '.jpg')) {
		filename += '.jpg';
	} else if (yield cofs.exists(filename + '.png')) {
		filename += '.png';
	} else if (yield cofs.exists(filename + '.gif')) {
		filename += '.gif';
	} else {
		this.status = 404;
		this.body = 'Not Found';
	}

	if (action == 'approve') {
console.log('move', filename, photoDir);
		// Move photo to specific directory
		var moveCmd = child_process.spawn('mv', [ filename, photoDir ]);
		moveCmd.on('close', function() {

			for (index in pendingList) {
				var photo = pendingList[index];

				if (photo.id == id) {
					pendingList.splice(index, 1);
					break;
				}
			}

			dispatcher.emit('newphoto');
		});
	} else {
		var rmCmd = child_process.spawn('rm', [ '-fr', filename ]);
		rmCmd.on('close', function() {

			for (index in pendingList) {
				var photo = pendingList[index];

				if (photo.id == id) {
					pendingList.splice(index, 1);
					break;
				}
			}
		});
	}

	this.body = 'Done';
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
