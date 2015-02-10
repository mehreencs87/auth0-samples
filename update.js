var request = require('request');
var util = require('util');
var async = require('async');
var _ = require('lodash');
var fs = require('fs');
var dotenv = require('dotenv');
dotenv.load();

if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
  console.log('You must set environmental variables for GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET');
  return;
}


var authQuery = util.format('&client_id=%s&client_secret=%s', process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET);
var reposUrl = 'https://api.github.com/users/%s/repos?page=%s' + authQuery; // 0: repo, 1: page number
var metadataUrl = 'https://raw.githubusercontent.com/%s/master/metadata.json'; // 0: repo.full_name

var SETTINGS_FILE = './index.json';
var GITHUB_ORG = 'auth0';

var githubHeaders = {
      'User-Agent': 'Auth0-Script',
      'Content-Type': 'application/json'
    };

var getRepositories = function(page, callback) {
  request({
    uri: util.format(reposUrl, GITHUB_ORG, page),
    headers: githubHeaders
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var obj = JSON.parse(body);
      callback(obj);
    } else {
      console.log(body)
    }
  });
}


var repos = [];
var p = 0;

var processRepositories = function(result) {
  if (result.length === 0) {
    // Github sometimes doesnt return uniq
    repos = _.uniq(repos, 'id');
    writeSettings();
  } else {
    async.each(result, processRepository,
      function(err) {
      if (err) {
        console.log(err);
      }
      getRepositories(p++, processRepositories);
    });
  }
};

var processRepository = function(repo, callback) {
  var buildObject = function(metadata) {
    var obj = {};
    obj.id = repo.name;
    obj.url = repo.html_url;
    obj.created_at = repo.created_at;
    obj.updated_at = repo.updated_at;
    obj.pushed_at = repo.pushed_at;
    obj.description = repo.description;
    obj.fork = repo.fork;
    _.merge(obj, metadata);

    repos.push(obj);

    callback();
  }

  request({
    uri: util.format(metadataUrl, repo.full_name),
    headers: githubHeaders
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log('Adding repos ' + repo.full_name);
      var metadata = JSON.parse(body);
      buildObject(metadata);
    } else {
      console.log('No metadata object, skipping repo ' + repo.full_name);
      callback();
    }
  })
};

var writeSettings = function() {
  var settings = {};
  if (fs.existsSync(SETTINGS_FILE)) {
    settings = JSON.parse(fs.readFileSync(SETTINGS_FILE));
    delete settings.repos;
    fs.unlinkSync(SETTINGS_FILE);
  }
  settings.repos = repos;
  var json = JSON.stringify(settings, null, '  ');
  fs.writeFileSync(SETTINGS_FILE, json);
  console.log('Sample settings successfully updated.');
}

getRepositories(p++, processRepositories);
