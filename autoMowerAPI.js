const request = require('request');

module.exports = {
  AutoMowerAPI: AutoMowerAPI,
};

function AutoMowerAPI(log, platform) {
  this.log = log;
  this.platform = platform;
  this.login = platform.login;
  this.password = platform.password;

  this.headers = {
    Accept: 'application/json',
    'Content-type': 'application/json',
  };

  this.imApiUrl = 'https://iam-api.dss.husqvarnagroup.net/api/v3/';
  this.trackApiUrl = 'https://amc-api.dss.husqvarnagroup.net/app/v1/';
}

AutoMowerAPI.prototype = {
  logResult: function(result) {
    this.log.debug('INFO - mower status : ' + JSON.stringify(result.status));
    this.log.debug(
      'INFO - mower activity : ' + result.status.mowerStatus.activity
    );
  },

  authenticate: function(callback) {
    var dte = new Date();

    if (
      !this.token ||
      (this.token && this.loginExpires && this.loginExpires < dte)
    ) {
      this.log.debug('INFO - authenticating');

      var jsonBody = {
        data: {
          attributes: {
            password: this.password,
            username: this.login,
          },
          type: 'token',
        },
      };

      var that = this;
      request(
        {
          url: this.imApiUrl + 'token',
          method: 'POST',
          headers: this.headers,
          body: jsonBody,
          json: true,
        },
        function(error, response, body) {
          if (error) {
            that.log(error.message);
            callback(error);
          } else if (response && response.statusCode !== 201) {
            that.log('ERROR - No 201 return ' + response.statusCode);
            callback(error);
          } else if (body && body.data) {
            that.token = body.data.id;
            that.tokenProvider = body.data.attributes.provider;
            that.loginExpiry = body.data.attributes.expires_in;
            that.loginExpires = new Date();
            that.loginExpires.setMilliseconds(
              that.loginExpires.getMilliseconds() + that.loginExpiry - 30000
            );
            that.headers['Authorization'] = 'Bearer ' + that.token;
            that.headers['Authorization-Provider'] = that.tokenProvider;
            callback();
          } else {
            that.log('ERROR - No body');
            callback('No body');
          }
        }
      );
    } else {
      this.log.debug(
        'INFO - allready authenticate expiration : ' +
          this.loginExpires +
          '-' +
          dte
      );
      callback();
    }
  },

  getMowers: function(callback) {
    const that = this;
    request(
      {
        url: this.trackApiUrl + 'mowers',
        method: 'GET',
        headers: this.headers,
        json: true,
      },
      function(error, response, body) {
        if (error) {
          that.log('ERROR - retrieving mower - ' + error.message);
          callback(error);
        } else if (response && response.statusCode !== 200) {
          that.log('ERROR - No 200 return ' + response.statusCode);
          callback(error);
        } else if (body.length > 0) {
          let mowers = [];
          body.forEach(mower => {
            mowers.push(mower);
          });
          callback(mowers);
        } else {
          that.log('ERROR - No body returned from Automower API');
          callback('No body');
        }
      }
    );
  },
};

//URLS
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/start/';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/start/';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/start/override/period'; + JSON String "duration" in body
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/pause';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/park/duration/timer';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/park/duration/period'; + JSON String "duration" in body
