const request = require('request');
var locks = require('locks');
var mutex = locks.createMutex();

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
  logResult: function (result) {
    this.log.debug('INFO - mower status : ' + JSON.stringify(result.status));
    this.log.debug('INFO - mower activity : ' + result.status.mowerStatus.activity);
  },

  authenticate: function (callback) {
    var dte = new Date();

    if (!this.token || (this.token && this.loginExpires && this.loginExpires < dte)) {
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

      mutex.lock(function () {
        request(
          {
            url: that.imApiUrl + 'token',
            method: 'POST',
            headers: that.headers,
            body: jsonBody,
            json: true,
          },
          function (error, response, body) {
            mutex.unlock();

            if (error) {
              that.log(error.message);
              callback(error);
            } else if (response && response.statusCode !== 201) {
              that.log(
                'ERROR - authenticate - No 201 return ' +
                  response.statusCode +
                  '/' +
                  JSON.stringify(response)
              );
              callback('No 201');
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
              that.log('ERROR - authenticate - No body');
              callback('No body');
            }
          }
        );
      });
    } else {
      this.log.debug('INFO - allready authenticate expiration : ' + this.loginExpires + '-' + dte);
      callback();
    }
  },

  getMowers: function (callback) {
    const that = this;
    request(
      {
        url: this.trackApiUrl + 'mowers',
        method: 'GET',
        headers: this.headers,
        json: true,
      },
      function (error, response, body) {
        if (error) {
          that.log('ERROR - getMowers - retrieving mower - ' + error.message);
          callback(error);
        } else if (response && response.statusCode !== 200) {
          that.log('ERROR - getMowers - No 200 return ' + response.statusCode + '/' + response);
          callback(error);
        } else if (body.length > 0) {
          let mowers = [];
          body.forEach((mower) => {
            mowers.push(mower);
          });
          callback(mowers);
        } else {
          that.log('ERROR - getMowers -No body returned from Automower API');
          callback('No body');
        }
      }
    );
  },

  sendCommand: function (homebridgeAccessory, command, characteristic, callback) {
    const that = this;
    var currentValue = characteristic.value;
    var commandURL;

    commandURL = this.trackApiUrl + 'mowers/' + homebridgeAccessory.mowerID + command;

    this.authenticate((error) => {
      if (error) {
        setTimeout(function () {
          characteristic.updateValue(currentValue);
        }, 200);
        callback(error);
      } else {
        request(
          {
            url: commandURL,
            method: 'POST',
            headers: that.headers,
            json: true,
          },
          function (error, response, body) {
            that.log('INFO - Command sent : ' + commandURL);
            that.log.debug('INFO - Body received : ' + JSON.stringify(body));
            if (error) {
              that.log(error.message);
              setTimeout(function () {
                characteristic.updateValue(currentValue);
              }, 200);
              callback(error);
            } else if (response && response.statusCode !== 200) {
              that.log('ERROR - sendCommand -  No 200 return ' + response.statusCode);
              setTimeout(function () {
                characteristic.updateValue(currentValue);
              }, 200);
              callback(error);
            } else {
              callback();
            }
          }
        );
      }
    });
  },
};

//URLS
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/start/';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/start/';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/start/override/period'; + JSON String "duration" in body
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/pause';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/park/duration/timer';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/park/duration/period'; + JSON String "duration" in body
