/*
	MediaCenterJS - A NodeJS based mediacenter solution
	
    Copyright (C) 2013 - Jan Smolders

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var express = require('express')
	, app = express()
	, fs = require ('fs')
	, dateFormat = require('dateformat')
	, lingua = require('lingua')
	, colors = require('colors')
	, rimraf = require('rimraf')
	, dblite = require('dblite')
	, http = require('http')
	, configuration_handler = require('./lib/handlers/configuration-handler');

var config = configuration_handler.initializeConfiguration();

var language = null;
if(config.language === ""){
	language = 'en';
} else {
	language = config.language;
}

process.env.NODE_ENV = 'development';

app.configure(function(){
	app.set('view engine', 'jade');
	app.set('views', __dirname + '/views');
	app.setMaxListeners(100);
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(__dirname + '/public'));
	app.use(express.favicon(__dirname + '/public/core/favicon.ico'));
	app.use(lingua(app, {
		defaultLocale: 'translation_' + language,
		storageKey: 'lang',
		path: __dirname+'/public/translations/',
		cookieOptions: {
            httpOnly: false,        
            expires: new Date(Date.now(-1)),  
            secure: false
        }
	}));
	app.use(app.router);
	app.locals.pretty = true;
});

app.configure('development', function(){   
	app.enable('verbose errors');
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));  
});

app.configure('production', function(){
	app.disable('verbose errors');
	app.use(express.errorHandler()); 
});   

require('./lib/routing/routing')(app,{ verbose: !module.parent });

app.use(function(req, res) {
    res.status(404).render('404',{ selectedTheme: config.theme});
    res.status(500).render('404',{ selectedTheme: config.theme});
});

app.get("/", function(req, res, next) {  
	if(	config.moviepath == '' && config.language == '' && config.location == '' || config.moviepath == null || config.moviepath == undefined){
		res.render('setup');	
	} else {
		
		var apps = [];

		//Search core app folder for apps and check if tile icon is present
		fs.readdirSync(__dirname + '/apps').forEach(function(name){
			if(fs.existsSync(__dirname + '/public/'+name+'/tile.png')){
				var obj = {
					appLink: name, 
					tileLink: name
				}
				apps.push(obj);
			}
		});

		//search node_modules for plugins
		var nodeModules = __dirname + '/node_modules';
		var pluginPrefix = 'mediacenterjs-'; //TODO: externalize in config file

		fs.readdirSync(nodeModules).forEach(function(name){

			//Check if the folder in the node_modules starts with the prefix
			if(name.substr(0, pluginPrefix.length) !== pluginPrefix)
				return;

			var pluginPath = nodeModules + '/' + name;
			if(fs.existsSync( pluginPath + '/public/tile.png')){
				var obj = {
					appLink: name, 
					tileLink: name + '/public'
				}
				apps.push(obj);
			}

		});

		var now = new Date();
		var time = dateFormat(now, "HH:MM");
		var date = dateFormat(now, "dd-mm-yyyy");
		req.setMaxListeners(0);
		res.render('index', {
			title: 'Homepage',
			selectedTheme: config.theme,
			time: time,
			date: date,
			apps: apps
		});	
	}
});


app.post('/removeModule', function(req, res){
	var incommingModule = req.body
	, module = incommingModule.module
	, appDir = './apps/'+module+'/'
	, publicdir = './public/'+module+'/';

	rimraf(appDir, function (e){if(e)console.log('Error removing module', e .red)});
	rimraf(publicdir, function (e) { 
		if(e) {
			console.log('Error removing module', e .red);
		} else {
			res.redirect('/');
		}
	});
});

app.post('/clearCache', function(req, res){
	var app_cache_handler = require('./lib/handlers/app-cache-handler');
	var incommingCache = req.body,
		cache = incommingCache.cache;
	
	console.log('clearing ' + cache + ' cache');
	app_cache_handler.clearCache(cache, function(err) {
		if (err) {
			console.log('Error removing module', e .red);
			return res.send('Error clearing cache', e);
		}
		// Init Database
		if(config.platform === 'OSX'){
			dblite.bin = "./bin/sqlite3/osx/sqlite3";
		}else {
			dblite.bin = "./bin/sqlite3/sqlite3";
		}
		var db = dblite('./lib/database/mcjs.sqlite');

		db.query('DROP TABLE IF EXISTS ' + cache);

		db.on('info', function (text) { console.log(text) });
		db.on('error', function (err) { console.error('Database error: ' + err) });

		return res.send('done');
	});
});

app.post('/setuppost', function(req, res){
	writeSettings(req, res, function(){
		res.render('finish');
	});
});

app.get('/configuration', function(req, res){
	res.send(config);
});
	
app.post('/submit', function(req, res){
	writeSettings(req, res, function(){
		res.redirect('/');
	});
});

function writeSettings(req, res){
	configuration_handler.saveSettings(req.body, function() {
		res.redirect('/');
	});
}

app.set('port', process.env.PORT || 3000);

// Open App socket
if (config.port == "" || config.port == undefined ){
	var defaultPort = app.get('port');
	console.log('First run, Setup running on localhost:'+defaultPort);
	app.listen(parseInt(defaultPort));
} else{
	console.log("MediacenterJS listening on port:", config.port .green.bold); 
	app.listen(parseInt(config.port));
}
