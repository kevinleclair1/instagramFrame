"use strict"

const app = require('express')();
const ig = require('instagram-node').instagram();
const bodyParser = require('body-parser');
const request = require('request');
const fs = require('fs');
const ngrokify = require('ngrok-my-server');
const config = require('./config.js');

app.use( bodyParser.json() );

ngrokify(app).then(appInit);

function appInit(url){

	const ngrokUrl = url;
	const local = `http://localhost:4000`
	const redirect_uri = `${local}/addSub`;
	const callback_uri = `${ngrokUrl}/test`;

	ig.use({
		client_id: config.CLIENT_ID,
		client_secret: config.CLIENT_SEC
	});

	app.get('/', function (req, res) {
	  res.redirect(ig.get_authorization_url(redirect_uri, {
	  	scope: ['basic', 'public_content']
	  }));
	});

	app.get('/test', function(req, res){
		console.log('subscribing');
		if (req.param("hub.verify_token") == "test")
		    res.send(req.param("hub.challenge"));
		else res.status(500).json({err: "Verify token incorrect"});
	})

	app.post('/test', function(req, res){
		//need to use public content so i can use my own static access token
		ig.use({
			access_token: config.TOKEN
		});
		ig.media(req.body[0].data.media_id, function(err, media, remaining, limit) {
			if (err) throw err
			writeImg(media);
		});
	});

	app.get('/addSub', function(req, res){
		userAuth(req.query.code, redirect_uri).then(function(result){
			res.send('Authorized');
			return getSubs()
		})
		.then(function(subs){
			if (subs[0].callback_uri !== callback_uri){
				return addSub(callback_uri)
			}
		});
	});

	var server = app.listen(4000, function () {
	  var host = server.address().address;
	  var port = server.address().port;

	  console.log('Example app listening at http://%s:%s', host, port);
	});
}


function userAuth(code, url){
	return new Promise((res, rej) => {
			ig.authorize_user(code, url, function(err, result) {
			    if (err) throw err;
		        console.log('Access token is ' + result.access_token);
		        res(result);
			});
	});
}

function addSub(url){
	return new Promise((res, rej) => {
		ig.add_user_subscription(url, {
			verify_token: 'test'
		}, function(err, result, remaining, limit){
			if (err) throw err;
			console.log(result);
			console.log('sub added');
		});
	});
}

function getSubs(){
	return new Promise((res, rej) => {
		ig.subscriptions(function(err, subs, remaining, limit){
			if (err) throw err;
			res(subs);
		});
	});
}

function writeImg(media){
	var imageUrl = media.images.standard_resolution.url.replace('s640x640', 's1080x1080');

	var r = request(imageUrl).pipe(fs.createWriteStream(writePath(media.id)));
    r.on('close', function(){
    	console.log('saved');
    });
    r.on('error', function(err){
    	throw err;
    });
}

function writePath(name){
	return `${__dirname}/Gallery/${name}.jpg`
}