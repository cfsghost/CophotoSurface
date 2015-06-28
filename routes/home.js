
var Router = require('koa-router');

var router = module.exports = new Router();

router.get('/', function *() {
    yield this.render('index');
});

router.post('/', function *() {
    this.body = 'done';
});

router.get('/takephoto', function *() {
    yield this.render('takephoto');
});
