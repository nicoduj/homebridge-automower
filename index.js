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
  this.trackApiUrl =  'https://amc-api.dss.husqvarnagroup.net/v1/';

}

myAutoMower.prototype = {
  getServices: function () {
    this.services = [];
    

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

    let switchService = new Service.Switch("Auto/Home");
    switchService
      .getCharacteristic(Characteristic.On)
        .on('get', this.getSwitchOnCharacteristic.bind(this))
        .on('set', this.setSwitchOnCharacteristic.bind(this));
    this.services.push(switchService);
    
    /* Fan Service */

    let fanService = new Service.Fan("Mowing");
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
    const me = this;
    me.authenticate(function () {       
      me.getMowers(function () { 
          return next(null,me.mowerStatus.batteryPercent);
      })
    });
  },
  getChargingStateCharacteristic: function (next) {
    const me = this;
    me.authenticate(function () {       
      me.getMowers(function () { 
        if (me.mowerStatus.connected && me.mowerStatus.batteryPercent < 100) {
          return next(null, 1);
        }
        else {
          return next(null,0);
        }
      })
    });
  },
  getLowBatteryCharacteristic: function (next) {

    const me = this;
    me.authenticate(function () {       
      me.getMowers(function () { 
          if (me.mowerStatus.batteryPercent < 20){
            return next(null,1);
          }
          else{
            return next(null,0);
          }
      })
    });
  },

  getSwitchOnCharacteristic: function (next) {
    const me = this;
    var onn = false;
    me.authenticate(function () {       
      me.getMowers(function () { 
          if (me.mowerStatus.mowerStatus.startsWith('OK_') ){
            onn = true;
          }
          return next(null, onn);
      })
    });
  },  
  setSwitchOnCharacteristic: function (on, next) {

    const me = this;
    var command; //PARK, STOP, START
    if(on){
      command = 'PARK';
    }else{
      command= 'START';
    }
    me.authenticate(function () {       
      me.getMowers(function () { 
        request({
              url: me.trackApiUrl + 'mowers/' + me.mowerID + '/control',
              method: 'POST',
              headers: me.headers,
              body: {"action": command},
              json: true
          }, 
          function (error, response, body) {
            console.log(body);
            if (error) {
              console.log(error.message);
              return next(error);
            }
            return next();
          });
        });
      });
  },

  getMowerOnCharacteristic: function (next) {

    const me = this;
    var mowing = 0;
    me.authenticate(function () {       
      me.getMowers(function () { 
          if (me.mowerStatus.mowerStatus == 'OK_CUTTING' ){
            mowing = 1;
          }
          return next(null, mowing);
      })
    });
  },
  setMowerOnCharacteristic: function (on, next) {
    const me = this;
    var command; //PARK, STOP, START
    if(on){
      command = 'STOP';
    }else{
      command= 'START';
    }
    me.authenticate(function () {       
      me.getMowers(function () { 
        request({
              url: me.trackApiUrl + 'mowers/' + me.mowerID + '/control',
              method: 'POST',
              headers: me.headers,
              body: {"action": command},
              json: true
          }, 
          function (error, response, body) {
            console.log(body);
            if (error) {
              console.log(error.message);
              return next(error);
            }
            return next();
          });
        });
      });
  },

  authenticate: function(next) {
    const me = this;
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
            console.log(error.message);
            return next(error);
          }
          me.token = body.data.id;
          me.tokenProvider = body.data.attributes.provider;
          me.headers['Authorization'] = 'Bearer ' + me.token;
          me.headers['Authorization-Provider'] = me.tokenProvider;
          
          return next();
        });

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
                console.log(error.message);
                return next(error);
              }

              if (body.length > 0)
              {
                body.forEach(mower => {
                  
                  if (mower.name == me.mowerName)
                  {
                    me.mowerID = mower.id;
                    me.mowerStatus = mower.status;  
                  }
                });
              }
              if (me.mowerID) {
                return next();
              }
              else
              {
                console.log('no automower');
                return next('no automower');
              }
            });
  }


};

//var email = ;
//var pwd = ;
//var test = new myRobo(null,{'email':email,'password':pwd,'name':'Rosalie'});
//test.setMowerOnCharacteristic (false,function(){});
//test.setSwitchOnCharacteristic (false,function(){});

//test.getBatteryLevelCharacteristic(function(a,b){console.log(b)});
//test.getChargingStateCharacteristic(function(a,b){console.log(b)});
//test.getLowBatteryCharacteristic(function(a,b){console.log(b)});
//test.getMowerOnCharacteristic(function(a,b){console.log(b)});
//test.getSwitchOnCharacteristic(function(a,b){console.log(b)});
//test.authenticate(function(){ test.getMowers(function(){console.log(test);}) });

//
//OK_CUTTING
//PAUSED
//OK_SEARCHING
//PARKED_PARKED_SELECTED