import request from 'request';
import {EventEmitter} from 'events';

export class AutoMowerAPI extends EventEmitter {
  constructor(log, platform) {
    super();

    this.log = log;
    this.platform = platform;
    this.login = platform.login;
    this.password = platform.password;

    this.discoverdMowers = [];

    this.headers = {
      Accept: 'application/json',
      'Content-type': 'application/json',
    };

    this.imApiUrl = 'https://iam-api.dss.husqvarnagroup.net/api/v3/';
    this.trackApiUrl = 'https://amc-api.dss.husqvarnagroup.net/app/v1/';
  }

  logResult(result) {
    this.log.debug('INFO - mower status : ' + JSON.stringify(result.status));
    this.log.debug('INFO - mower activity : ' + result.status.mowerStatus.activity);
  }

  authenticate(callback) {
    const dte = new Date();

    if (!this.token || (this.token && this.loginExpires && this.loginExpires < dte)) {
      this.log.debug('INFO - authenticating');

      const jsonBody = {
        data: {
          attributes: {
            password: this.password,
            username: this.login,
          },
          type: 'token',
        },
      };

      const that = this;

      request(
        {
          url: that.imApiUrl + 'token',
          method: 'POST',
          headers: that.headers,
          body: jsonBody,
          json: true,
        },
        function (error, response, body) {
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
    } else {
      this.log.debug('INFO - allready authenticate expiration : ' + this.loginExpires + '-' + dte);
      callback();
    }
  }

  getMowers() {
    const that = this;

    if (this.inProgress) return;

    this.inProgress = true;

    this.authenticate((error) => {
      if (error) {
        that.emit('mowersRefreshError');
        that.inProgress = false;
      } else {
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
              that.emit('mowersRefreshError');
            } else if (response && response.statusCode !== 200) {
              that.log('ERROR - getMowers - No 200 return ' + response.statusCode + '/' + response);
              that.emit('mowersRefreshError');
            } else if (body.length > 0) {
              const mowers = [];
              body.forEach((mower) => {
                mowers.push(mower);
              });
              that.discoverdMowers = mowers;
              that.emit('mowersUpdated');
            } else {
              that.log('ERROR - getMowers -No body returned from Automower API');
              that.emit('mowersRefreshError');
            }
            that.inProgress = false;
          }
        );
      }
    });
  }

  sendCommand(command, callback) {
    const that = this;
    const bodyToSend = {};
    const commandURL = this.trackApiUrl + 'mowers/' + command;

    this.authenticate((error) => {
      if (error) {
        callback(error);
      } else {
        request(
          {
            url: commandURL,
            method: 'POST',
            body: bodyToSend,
            headers: that.headers,
            json: true,
          },
          function (error, response, body) {
            that.log('INFO - Command sent : ' + commandURL);
            that.log.debug('INFO - Body received : ' + JSON.stringify(body));
            if (error) {
              that.log(error.message);
              callback(error);
            } else if (response && response.statusCode !== 200) {
              that.log('ERROR - sendCommand -  No 200 return ' + response.statusCode);
              callback(error);
            } else {
              callback();
            }
          }
        );
      }
    });
  }
}

//URLS
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/start/';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/start/';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/start/override/period'; + JSON String "duration" in body
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/pause';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/park/duration/timer';
//me.trackApiUrl + 'mowers/' + me.mowerID + '/control/park/duration/period'; + JSON String "duration" in body
