var Service, Characteristic;
const request = require('request');
const url = require('url');

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-automower", "HomebridgeAutomower", myAutoMower);
  
};

function myAutoMower(log, config) {

  this.log = log;
  this.modelInfo = config['model'];
  this.login = config['email'];
  this.password = config['password'];
  this.mowerName = config['name'];

  this.headers = {'Accept': 'application/json', 'Content-type': 'application/json'};
  this.imApiUrl =  'https://iam-api.dss.husqvarnagroup.net/api/v3/';
  this.trackApiUrl =  'https://amc-api.dss.husqvarnagroup.net/app/v1/';
  this.log('myAutoMower intialized');
  this.authenticate(function(error)
    {
      if (!error) 
      {
        this.log('Authenticated'); 
      }
      else
      {
        this.log('Error authenticating at initilisation - check your config'); 
      }

    }.bind(this));
}

myAutoMower.prototype = {
  getServices: function () {
    this.services = [];
    //this.log('getServices');

    /* Information Service */

    let informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Husqvarna Group')
      .setCharacteristic(Characteristic.Model, this.modelInfo)
      .setCharacteristic(Characteristic.SerialNumber,  'NA');
    this.services.push(informationService);
    
    /* Battery Service */

    let batteryService = new Service.BatteryService();
    batteryService
      .getCharacteristic(Characteristic.BatteryLevel)
        .on('get', this.getBatteryLevelCharacteristic.bind(this));
    batteryService
      .getCharacteristic(Characteristic.ChargingState)
        .on('get', this.getChargingStateCharacteristic.bind(this));
    batteryService
      .getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getLowBatteryCharacteristic.bind(this));
    this.services.push(batteryService);
    
    
    /* Switch Service */

    let switchService = new Service.Switch(this.mowerName + " Auto/Park");
    switchService
      .getCharacteristic(Characteristic.On)
        .on('get', this.getSwitchOnCharacteristic.bind(this))
        .on('set', this.setSwitchOnCharacteristic.bind(this));
    this.services.push(switchService);
    
    /* Fan Service */

    let fanService = new Service.Fan(this.mowerName + " Mowing");
    fanService
      .getCharacteristic(Characteristic.On)
        .on('get', this.getMowerOnCharacteristic.bind(this))
        .on('set', this.setMowerOnCharacteristic.bind(this));
    this.services.push(fanService);
    

    this.informationService = informationService;
    this.batteryService = batteryService;
    this.switchService = switchService;
    this.fanService = fanService;

    
    return this.services;

  },
  getBatteryLevelCharacteristic: function (next) {
    //this.log('getBatteryLevelCharacteristic');
    const me = this;
    me.authenticate(function (error) { 
      if (error)
        return (next(null,0));
      else
      me.getMowers(function (error) { 
          if (!error && me.mowerStatus) {
            return next(null,me.mowerStatus.batteryPercent);
          }
          else {
            return next(null,0);
          }
      })
    });
  },
  getChargingStateCharacteristic: function (next) {
    //this.log('getChargingStateCharacteristic');
    const me = this;
    me.authenticate(function (error) { 
      if (error)
        return (next(null,0));
      else     
      me.getMowers(function (error) { 
        if (!error && me.mowerStatus && me.mowerStatus.connected && me.mowerStatus.batteryPercent < 100) {
          return next(null, 1);
        }
        else {
          return next(null,0);
        }
      })
    });
  },
  getLowBatteryCharacteristic: function (next) {
    //this.log('getLowBatteryCharacteristic');
    const me = this;
    me.authenticate(function (error) {  
      if (error)
        return (next(null,0));
      else     
      me.getMowers(function (error) { 
          if (!error && me.mowerStatus && me.mowerStatus.batteryPercent < 20){
            return next(null,1);
          }
          else{
            return next(null,0);
          }
      })
    });
  },

  getSwitchOnCharacteristic: function (next) {
    //this.log('getSwitchOnCharacteristic');
    const me = this;
    var onn = false;
    me.authenticate(function (error) {   
      if (error)
        return (next(null,0));
      else   
      me.getMowers(function (error) { 
          //console.log(me.mowerStatus);
          if (!error && me.mowerStatus && me.mowerStatus.mowerStatus.state.startsWith('IN_OPERATION') ){
            onn = true;
          }
          return next(null, onn);
      })
    });
  },  
  setSwitchOnCharacteristic: function (on, next) {
    //this.log('setSwitchOnCharacteristic - ' + on);
    const me = this;

    var commandURL;
    if(on){
      //startMainArea
      commandURL = me.trackApiUrl + 'mowers/' + me.mowerID + '/control/start/';
    }else{
      //park parkUntilNextStart
      commandURL= me.trackApiUrl + 'mowers/' + me.mowerID + '/control/park/duration/timer';
    }

    me.authenticate(function (error) {    
      if (error)
        return (next(null,0));
      else  
      me.getMowers(function (error) { 
        if (error)
          return next(error);
        else
          request({
                url: commandURL,
                method: 'POST',
                headers: me.headers,
                json: true
            }, 
            function (error, response, body) {
              me.log('Command sent' + commandURL);
              if (error) {
                me.log(error.message);
                return next(error);
              }
              else if (response && response.statusCode !== 200) {
                me.log('No 200 return ' + response.statusCode);
                return next(error);
              }
              else {
                return next();
              }
            });
        });
      });
  },

  getMowerOnCharacteristic: function (next) {
    //this.log('getMowerOnCharacteristic');
    const me = this;
    var mowing = 0;
    me.authenticate(function (error) {     
      if (error)
        return (next(null,0));
      else   
        me.getMowers(function (error) { 
            if (!error && me.mowerStatus && me.mowerStatus.mowerStatus.activity.startsWith('MOWING') ){
              mowing = 1;
            }
            return next(null, mowing);
        })
    });
  },
  setMowerOnCharacteristic: function (on, next) {
    //this.log('setMowerOnCharacteristic -' + on);
    const me = this;

    var commandURL;
    if(on){
      //startMainArea
      commandURL = me.trackApiUrl + 'mowers/' + me.mowerID + '/control/start/';
    }else{
      //pause
      commandURL= me.trackApiUrl + 'mowers/' + me.mowerID + '/control/pause';
    }

    me.authenticate(function (error) {   
      if (error)
        return (next(error));
      else  
      me.getMowers(function (error) { 
        if (error)
          return (next(error));
        else
          request({
                url: commandURL, 
                method: 'POST',
                headers: me.headers,
                json: true
            }, 
            function (error, response, body) {
              me.log('Command sent' + commandURL);
              if (error) {
                me.log(error.message);
                return next(error);
              }            
              else if (response && response.statusCode !== 200) {
                me.log('No 200 return ' + response.statusCode);
                return next(error);
              }
              else {
                return next();
              }
            });
        });
      });
  },

  authenticate: function(next) {
    const me = this;
    var dte = new Date();

    if (!me.token || (me.token && me.loginExpires && me.loginExpires < dte )) {
      me.log('authenticating' );

      var jsonBody = {
        "data": {
          "attributes": {
              "password": me.password,
              "username": me.login
          },
        "type": "token"
        }
      };

      request({
              url: me.imApiUrl + 'token',
              method: 'POST',
              headers: me.headers,
              body: jsonBody,
              json: true
          }, 
          function (error, response, body) {
            if (error) {
              me.log(error.message);
              return next(error);
            }
            else if (response && response.statusCode !== 201) {
              me.log('No 201 return ' + response.statusCode);
              return next(error);
            }
            else if (body && body.data) {
              me.token = body.data.id;
              me.tokenProvider = body.data.attributes.provider;
              me.loginExpiry = body.data.attributes.expires_in;
              me.loginExpires = new Date();
              me.loginExpires.setMilliseconds(me.loginExpires.getMilliseconds() + me.loginExpiry - 30000);
              me.headers['Authorization'] = 'Bearer ' + me.token;
              me.headers['Authorization-Provider'] = me.tokenProvider;
              return next();
            }
            else {
              me.log('No body');
              return next('No body');
            } 
          });
    }
    else
    {
      //me.log('allready authenticate expiration : ' + me.loginExpires + '-' + dte ) ;
      return next();
    }
    
  },

  getMowers: function(next){
    const me = this;
    request({
                url: me.trackApiUrl + 'mowers',
                method: 'GET',
                headers: me.headers,
                json: true
            }, 
            function (error, response, body) {
              if (error) {
                me.log(error.message);
                return next(error);
              }
              else if (response && response.statusCode !== 200) {
                me.log('No 200 return ' + response.statusCode );
                return next(error);
              }
              else if (body.length > 0) {
                body.forEach(mower => {
                  
                  if (mower.name == me.mowerName)
                  {
                    me.mowerID = mower.id;
                    me.mowerStatus = mower.status;  
                  }
                });
              }
              else {
                me.log('No body');
                return next('No body');
              }

              if (me.mowerID) {
                return next();
              }
              else {
                me.log('no automower detected');
                return next('no automower');
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

