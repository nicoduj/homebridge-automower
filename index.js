var Service, Characteristic, Accessory, UUIDGen;

var AutoMowerAPI = require('./autoMowerAPI.js').AutoMowerAPI;
const AutoMowerConst = require('./autoMowerConst');

checkTimer = function (timer) {
  if (timer && timer > 0 && (timer < 30 || timer > 600)) return 300;
  else return timer;
};

function myAutoMowerPlatform(log, config, api) {
  if (!config) {
    log('No configuration found for homebridge-automower');
    return;
  }

  this.api = api;
  this.log = log;
  this.login = config['email'];
  this.password = config['password'];
  this.refreshTimer = checkTimer(config['refreshTimer']);
  this.cleanCache = config['cleanCache'];

  this.foundAccessories = [];
  this.autoMowerAPI = new AutoMowerAPI(log, this);

  this.api
    .on(
      'shutdown',
      function () {
        this.end();
      }.bind(this)
    )
    .on(
      'didFinishLaunching',
      function () {
        this.log('DidFinishLaunching');

        if (this.cleanCache) {
          this.log('WARNING - Removing Accessories');
          this.api.unregisterPlatformAccessories(
            'homebridge-automower',
            'HomebridgeAutomower',
            this.foundAccessories
          );
          this.foundAccessories = [];
        }
        this.discoverAutoMowers();
      }.bind(this)
    );
}

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Accessory = homebridge.platformAccessory;
  UUIDGen = homebridge.hap.uuid;
  HomebridgeAPI = homebridge;
  homebridge.registerPlatform(
    'homebridge-automower',
    'HomebridgeAutomower',
    myAutoMowerPlatform,
    true
  );
};

myAutoMowerPlatform.prototype = {
  configureAccessory: function (accessory) {
    this.log.debug(accessory.displayName, 'Got cached Accessory ' + accessory.UUID);

    this.foundAccessories.push(accessory);
  },

  end() {
    this.log('INFO - shutdown');
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = undefined;
    }

    //TODO logout / clear listeners ...
  },

  discoverAutoMowers: function () {
    this.autoMowerAPI.authenticate((error) => {
      if (error == undefined) {
        this.autoMowerAPI.getMowers((result) => {
          if (result && result instanceof Array && result.length > 0) {
            for (let s = 0; s < result.length; s++) {
              this.log.debug('Mower : ' + JSON.stringify(result[s]));
              let services = [];
              let mowerName = result[s].name;
              let mowerModel = result[s].model;
              let mowerSeriaNumber = result[s].id;

              let uuid = UUIDGen.generate(mowerName);
              let myMowerAccessory = this.foundAccessories.find((x) => x.UUID == uuid);

              if (!myMowerAccessory) {
                myMowerAccessory = new Accessory(mowerName, uuid);
                myMowerAccessory.name = mowerName;
                myMowerAccessory.model = mowerModel;
                myMowerAccessory.manufacturer = 'Husqvarna Group';
                myMowerAccessory.serialNumber = mowerSeriaNumber;
                myMowerAccessory.mowerID = mowerSeriaNumber;

                myMowerAccessory
                  .getService(Service.AccessoryInformation)
                  .setCharacteristic(Characteristic.Manufacturer, myMowerAccessory.manufacturer)
                  .setCharacteristic(Characteristic.Model, myMowerAccessory.model)
                  .setCharacteristic(Characteristic.SerialNumber, myMowerAccessory.serialNumber);

                this.api.registerPlatformAccessories(
                  'homebridge-automower',
                  'HomebridgeAutomower',
                  [myMowerAccessory]
                );

                this.foundAccessories.push(myMowerAccessory);
              }

              myMowerAccessory.mowerID = mowerSeriaNumber;
              myMowerAccessory.name = mowerName;

              let HKBatteryService = myMowerAccessory.getServiceByUUIDAndSubType(
                mowerName,
                'BatteryService' + mowerName
              );

              if (!HKBatteryService) {
                this.log('INFO - Creating  Battery Service ' + mowerName + '/' + mowerName);
                HKBatteryService = new Service.BatteryService(
                  mowerName,
                  'BatteryService' + mowerName
                );
                HKBatteryService.subtype = 'BatteryService' + mowerName;
                myMowerAccessory.addService(HKBatteryService);
              }

              this.bindBatteryLevelCharacteristic(myMowerAccessory, HKBatteryService);
              this.bindChargingStateCharacteristic(myMowerAccessory, HKBatteryService);
              this.bindStatusLowBatteryCharacteristic(myMowerAccessory, HKBatteryService);

              let HKFanService = myMowerAccessory.getServiceByUUIDAndSubType(
                mowerName,
                'FanService' + mowerName
              );

              if (!HKFanService) {
                this.log('INFO - Creating  Fan Service ' + mowerName + '/' + mowerName);
                HKFanService = new Service.Fan(mowerName, 'FanService' + mowerName);
                HKFanService.subtype = 'FanService' + mowerName;
                myMowerAccessory.addService(HKFanService);
              }

              this.bindFanOnCharacteristic(myMowerAccessory, HKFanService);

              let HKSwitchService = myMowerAccessory.getServiceByUUIDAndSubType(
                mowerName,
                'SwitchService' + mowerName
              );

              if (!HKSwitchService) {
                this.log('INFO - Creating  Switch Service ' + mowerName + '/' + mowerName);
                HKSwitchService = new Service.Switch(mowerName, 'SwitchService' + mowerName);
                HKSwitchService.subtype = 'SwitchService' + mowerName;
                myMowerAccessory.addService(HKSwitchService);
              }

              this.bindSwitchOnCharacteristic(myMowerAccessory, HKSwitchService);
            }

            //timer for background refresh
            this.refreshBackground();
          } else {
            this.log('ERROR - gettingMowers - no mower found - ' + result);
          }
        });
      }
    });
  },

  getBatteryLevel(homebridgeAccessory, result) {
    var percent = 0;
    if (result && result instanceof Array && result.length > 0) {
      for (let s = 0; s < result.length; s++) {
        this.autoMowerAPI.logResult(result[s]);
        if (result[s].id === homebridgeAccessory.mowerID) {
          percent = result[s].status.batteryPercent;
          break;
        }
      }
    }
    return percent;
  },

  getBatteryLevelCharacteristic: function (homebridgeAccessory, callback) {
    this.log.debug('INFO - getBatteryLevelCharacteristic');
    var percent = 0;
    this.autoMowerAPI.authenticate((error) => {
      if (error) {
        callback(undefined, percent);
      } else {
        this.autoMowerAPI.getMowers((result) => {
          percent = this.getBatteryLevel(homebridgeAccessory, result);
          callback(undefined, percent);
        });
      }
    });
  },

  getChargingState(homebridgeAccessory, result) {
    var charging = 0;
    if (result && result instanceof Array && result.length > 0) {
      for (let s = 0; s < result.length; s++) {
        this.autoMowerAPI.logResult(result[s]);
        if (
          result[s].id === homebridgeAccessory.mowerID &&
          result[s].status &&
          result[s].status.connected &&
          (result[s].batteryPercent < 100 ||
            result[s].status.mowerStatus.activity.startsWith(AutoMowerConst.CHARGING))
        ) {
          charging = 1;
          break;
        }
      }
    }
    return charging;
  },

  getChargingStateCharacteristic: function (homebridgeAccessory, callback) {
    this.log.debug('INFO - getChargingStateCharacteristic');
    var charging = 0;

    this.autoMowerAPI.authenticate((error) => {
      if (error) {
        callback(undefined, charging);
      } else
        this.autoMowerAPI.getMowers((result) => {
          charging = this.getChargingState(homebridgeAccessory, result);
          callback(undefined, charging);
        });
    });
  },

  isLowBattery(homebridgeAccessory, result) {
    var lowww = 0;
    if (result && result instanceof Array && result.length > 0) {
      for (let s = 0; s < result.length; s++) {
        this.autoMowerAPI.logResult(result[s]);
        if (
          result[s].id === homebridgeAccessory.mowerID &&
          result[s].status &&
          result[s].batteryPercent < 20
        ) {
          lowww = 1;
          break;
        }
      }
    }
    return lowww;
  },

  getLowBatteryCharacteristic: function (homebridgeAccessory, callback) {
    this.log.debug('INFO - getLowBatteryCharacteristic');
    var lowww = 0;
    this.autoMowerAPI.authenticate((error) => {
      if (error) {
        callback(undefined, lowww);
      } else
        this.autoMowerAPI.getMowers((result) => {
          lowww = this.isLowBattery(homebridgeAccessory, result);
          callback(undefined, lowww);
        });
    });
  },

  isInOperation(homebridgeAccessory, result) {
    var onn = false;
    if (result && result instanceof Array && result.length > 0) {
      for (let s = 0; s < result.length; s++) {
        this.autoMowerAPI.logResult(result[s]);
        if (
          result[s].id === homebridgeAccessory.mowerID &&
          result[s].status &&
          result[s].status.mowerStatus.state.startsWith(AutoMowerConst.IN_OPERATION)
        ) {
          onn = true;
          break;
        }
      }
    }
    return onn;
  },

  getSwitchOnCharacteristic: function (homebridgeAccessory, callback) {
    this.log.debug('INFO - getSwitchOnCharacteristic');
    var onn = false;
    this.autoMowerAPI.authenticate((error) => {
      if (error) {
        callback(undefined, onn);
      } else
        this.autoMowerAPI.getMowers((result) => {
          this.log.debug('INFO - mowers result : ' + JSON.stringify(result));
          onn = this.isInOperation(homebridgeAccessory, result);

          callback(undefined, onn);
        });
    });
  },
  setSwitchOnCharacteristic: function (homebridgeAccessory, characteristic, value, callback) {
    this.log.debug('INFO - setSwitchOnCharacteristic - ' + value);
    this.autoMowerAPI.sendCommand(
      homebridgeAccessory,
      value ? AutoMowerConst.START_COMMAND : AutoMowerConst.PARK_COMMAND,
      characteristic,
      callback
    );
  },

  isMowing(homebridgeAccessory, result) {
    var mowing = 0;
    if (result && result instanceof Array && result.length > 0) {
      for (let s = 0; s < result.length; s++) {
        this.autoMowerAPI.logResult(result[s]);
        if (
          result[s].id === homebridgeAccessory.mowerID &&
          result[s].status &&
          result[s].status.mowerStatus.activity.startsWith(AutoMowerConst.MOWING)
        ) {
          mowing = 1;
          break;
        }
      }
    }
    return mowing;
  },

  getMowerOnCharacteristic: function (homebridgeAccessory, callback) {
    this.log.debug('getMowerOnCharacteristic');

    var mowing = 0;
    this.autoMowerAPI.authenticate((error) => {
      if (error) {
        callback(undefined, mowing);
      } else
        this.autoMowerAPI.getMowers((result) => {
          this.log.debug('INFO - mowers result : ' + JSON.stringify(result));
          mowing = this.isMowing(homebridgeAccessory, result);
          callback(undefined, mowing);
        });
    });
  },
  setMowerOnCharacteristic: function (homebridgeAccessory, characteristic, value, callback) {
    this.log.debug('setMowerOnCharacteristic -' + value);
    this.autoMowerAPI.sendCommand(
      homebridgeAccessory,
      value ? AutoMowerConst.START_COMMAND : AutoMowerConst.PAUSE_COMMAND,
      characteristic,
      callback
    );
  },

  bindBatteryLevelCharacteristic: function (homebridgeAccessory, service) {
    service.getCharacteristic(Characteristic.BatteryLevel).on(
      'get',
      function (callback) {
        this.getBatteryLevelCharacteristic(homebridgeAccessory, callback);
      }.bind(this)
    );
  },

  bindChargingStateCharacteristic: function (homebridgeAccessory, service) {
    service.getCharacteristic(Characteristic.ChargingState).on(
      'get',
      function (callback) {
        this.getChargingStateCharacteristic(homebridgeAccessory, callback);
      }.bind(this)
    );
  },

  bindStatusLowBatteryCharacteristic: function (homebridgeAccessory, service) {
    service.getCharacteristic(Characteristic.StatusLowBattery).on(
      'get',
      function (callback) {
        this.getLowBatteryCharacteristic(homebridgeAccessory, callback);
      }.bind(this)
    );
  },

  bindFanOnCharacteristic: function (homebridgeAccessory, service) {
    service
      .getCharacteristic(Characteristic.On)
      .on(
        'get',
        function (callback) {
          this.getMowerOnCharacteristic(homebridgeAccessory, callback);
        }.bind(this)
      )
      .on(
        'set',
        function (value, callback) {
          this.setMowerOnCharacteristic(
            homebridgeAccessory,
            service.getCharacteristic(Characteristic.On),
            value,
            callback
          );
        }.bind(this)
      );
  },

  bindSwitchOnCharacteristic: function (homebridgeAccessory, service) {
    service
      .getCharacteristic(Characteristic.On)
      .on(
        'get',
        function (callback) {
          this.getSwitchOnCharacteristic(homebridgeAccessory, callback);
        }.bind(this)
      )
      .on(
        'set',
        function (value, callback) {
          this.setSwitchOnCharacteristic(
            homebridgeAccessory,
            service.getCharacteristic(Characteristic.On),
            value,
            callback
          );
        }.bind(this)
      );
  },

  refreshBackground() {
    //timer for background refresh
    if (this.refreshTimer !== undefined && this.refreshTimer > 0) {
      this.log.debug(
        'INFO - Setting Timer for background refresh every  : ' + this.refreshTimer + 's'
      );
      this.timerID = setInterval(() => this.refreshAllMowers(), this.refreshTimer * 1000);
    }
  },

  refreshAllMowers: function () {
    this.autoMowerAPI.authenticate((error) => {
      if (error) {
        callback(undefined);
      } else {
        this.autoMowerAPI.getMowers((result) => {
          for (let a = 0; a < this.foundAccessories.length; a++) {
            this.log.debug('INFO - refreshing - ' + this.foundAccessories[a].name);
            this.refreshAutoMower(this.foundAccessories[a], result);
          }
        });
      }
    });
  },

  refreshAutoMower: function (myAutoMowerAccessory, result) {
    let mowerName = myAutoMowerAccessory.name;

    let HKSwitchService = myAutoMowerAccessory.getServiceByUUIDAndSubType(
      mowerName,
      'SwitchService' + mowerName
    );

    if (HKSwitchService) {
      HKSwitchService.getCharacteristic(Characteristic.On).updateValue(
        this.isInOperation(myAutoMowerAccessory, result)
      );
    }

    let HKFanService = myAutoMowerAccessory.getServiceByUUIDAndSubType(
      mowerName,
      'FanService' + mowerName
    );

    if (HKFanService) {
      HKFanService.getCharacteristic(Characteristic.On).updateValue(
        this.isMowing(myAutoMowerAccessory, result)
      );
    }

    let HKBatteryService = myAutoMowerAccessory.getServiceByUUIDAndSubType(
      mowerName,
      'BatteryService' + mowerName
    );

    if (HKBatteryService) {
      HKBatteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(
        this.getBatteryLevel(myAutoMowerAccessory, result)
      );
      HKBatteryService.getCharacteristic(Characteristic.ChargingState).updateValue(
        this.getChargingState(myAutoMowerAccessory, result)
      );
      HKBatteryService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(
        this.isLowBattery(myAutoMowerAccessory, result)
      );
    }
  },
};
