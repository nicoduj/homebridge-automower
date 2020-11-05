var Service, Characteristic, Accessory, UUIDGen;

var AutoMowerAPI = require('./autoMowerAPI.js').AutoMowerAPI;
const AutoMowerConst = require('./autoMowerConst');

checkTimer = function (timer) {
  if (timer && timer > 0 && (timer < 30 || timer > 600)) return 300;
  else return timer;
};

checkParameter = function (parameter, def) {
  if (parameter == undefined) {
    return def;
  } else {
    if (typeof parameter === 'string') {
      switch (parameter.toLowerCase().trim()) {
        case 'true':
        case 'yes':
          return true;
        case 'false':
        case 'no':
        case null:
          return false;
        case 'undefined':
        default:
          return parameter;
      }
    } else {
      return parameter;
    }
  }
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

  this.startStopSwitch = checkParameter(config['startStopSwitch'], true);
  this.startStopUntilFurtherNoticeSwitch = checkParameter(
    config['startStopUntilFurtherNoticeSwitch'],
    false
  );
  this.mowersList = config['mowersList'];

  this.foundAccessories = [];
  this.autoMowerAPI = new AutoMowerAPI(log, this);

  this.loaded = false;

  this._confirmedAccessories = [];
  this._confirmedServices = [];

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
            'Automower',
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
  homebridge.registerPlatform('homebridge-automower', 'Automower', myAutoMowerPlatform, true);
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
  },

  //Cleaning methods
  cleanPlatform: function () {
    this.cleanAccessories();
    this.cleanServices();
  },

  cleanAccessories: function () {
    //cleaning accessories
    let accstoRemove = [];
    for (let acc of this.foundAccessories) {
      if (!this._confirmedAccessories.find((x) => x.UUID == acc.UUID)) {
        accstoRemove.push(acc);
        this.log('WARNING - Accessory will be Removed ' + acc.UUID + '/' + acc.displayName);
      }
    }

    if (accstoRemove.length > 0)
      this.api.unregisterPlatformAccessories('homebridge-automower', 'Automower', accstoRemove);
  },

  cleanServices: function () {
    //cleaning services
    for (let acc of this.foundAccessories) {
      let servicestoRemove = [];
      for (let serv of acc.services) {
        if (
          serv.subtype !== undefined &&
          !this._confirmedServices.find((x) => x.UUID == serv.UUID && x.subtype == serv.subtype)
        ) {
          servicestoRemove.push(serv);
        }
      }
      for (let servToDel of servicestoRemove) {
        this.log(
          'WARNING - Service Removed' +
            servToDel.UUID +
            '/' +
            servToDel.subtype +
            '/' +
            servToDel.displayName
        );
        acc.removeService(servToDel);
      }
    }
  },

  discoverAutoMowers: function () {
    this.autoMowerAPI.on('mowersRefreshError', () => {
      if (this.timerID == undefined) {
        this.log('ERROR - discoverAutoMowers - will retry in 1 minute');
        setTimeout(() => {
          this.autoMowerAPI.getMowers();
        }, 60000);
      }
    });

    this.autoMowerAPI.on('mowersUpdated', () => {
      this.log.debug('INFO - mowersUpdated event');
      if (!this.loaded) {
        this.loadMowers();
      } else {
        this.updateMowers();
      }
    });

    this.autoMowerAPI.getMowers();
  },

  loadMowers() {
    let result = this.autoMowerAPI.discoverdMowers;

    if (result && result instanceof Array && result.length > 0) {
      for (let s = 0; s < result.length; s++) {
        let mowerName = result[s].name;

        if (!this.mowersList || (this.mowersList && this.mowersList.includes(mowerName))) {
          let mowerModel = result[s].model;
          let mowerSeriaNumber = result[s].id;

          this.log('INFO - Discovered Mower : ' + mowerName);
          this.log.debug('Mower : ' + JSON.stringify(result[s]));

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

            this.api.registerPlatformAccessories('homebridge-automower', 'Automower', [
              myMowerAccessory,
            ]);

            this.foundAccessories.push(myMowerAccessory);
          }

          myMowerAccessory.mowerID = mowerSeriaNumber;
          myMowerAccessory.name = mowerName;

          let HKBatteryService = myMowerAccessory.getServiceByUUIDAndSubType(
            mowerName,
            'BatteryService' + mowerName
          );

          if (!HKBatteryService) {
            this.log('INFO - Creating  Battery Service ' + mowerName);
            HKBatteryService = new Service.BatteryService(mowerName, 'BatteryService' + mowerName);
            HKBatteryService.subtype = 'BatteryService' + mowerName;
            myMowerAccessory.addService(HKBatteryService);
          }

          this.bindBatteryLevelCharacteristic(HKBatteryService);
          this.bindChargingStateCharacteristic(HKBatteryService);
          this.bindStatusLowBatteryCharacteristic(HKBatteryService);

          let HKFanService = myMowerAccessory.getServiceByUUIDAndSubType(
            'Start/Pause ' + mowerName,
            'FanService' + mowerName
          );

          if (!HKFanService) {
            this.log('INFO - Creating  Fan Service ' + mowerName);
            HKFanService = new Service.Fan('Start/Pause ' + mowerName, 'FanService' + mowerName);
            HKFanService.subtype = 'FanService' + mowerName;
            myMowerAccessory.addService(HKFanService);
          }

          this.bindFanOnCharacteristic(myMowerAccessory, HKFanService);

          if (this.startStopSwitch) {
            let HKSwitchService = myMowerAccessory.getServiceByUUIDAndSubType(
              'Start/Park ' + mowerName,
              'SwitchService' + mowerName
            );

            if (!HKSwitchService) {
              this.log('INFO - Creating  Switch Service ' + mowerName);
              HKSwitchService = new Service.Switch(
                'Start/Park ' + mowerName,
                'SwitchService' + mowerName
              );
              HKSwitchService.subtype = 'SwitchService' + mowerName;
              myMowerAccessory.addService(HKSwitchService);
            }

            this.bindSwitchOnCharacteristic(myMowerAccessory, HKSwitchService);
            this._confirmedServices.push(HKSwitchService);
          }

          if (this.startStopUntilFurtherNoticeSwitch) {
            let HKSwitch2Service = myMowerAccessory.getServiceByUUIDAndSubType(
              'ParkUntilResume ' + mowerName,
              'SwitchServicePark' + mowerName
            );

            if (!HKSwitch2Service) {
              this.log('INFO - Creating  Switch Service ' + mowerName);
              HKSwitch2Service = new Service.Switch(
                'ParkUntilResume ' + mowerName,
                'SwitchServicePark' + mowerName
              );
              HKSwitch2Service.subtype = 'SwitchServicePark' + mowerName;
              myMowerAccessory.addService(HKSwitch2Service);
            }

            this.bindSwitchOn2Characteristic(myMowerAccessory, HKSwitch2Service);
            this._confirmedServices.push(HKSwitch2Service);
          }

          let HKMotionService = myMowerAccessory.getServiceByUUIDAndSubType(
            mowerName + ' needs attention',
            'MotionService' + mowerName
          );

          if (!HKMotionService) {
            this.log('INFO - Creating Motion Service ' + mowerName);
            HKMotionService = new Service.MotionSensor(
              mowerName + ' needs attention',
              'MotionService' + mowerName
            );
            HKMotionService.subtype = 'MotionService' + mowerName;
            myMowerAccessory.addService(HKMotionService);
          }
          this.bindMotionCharacteristic(HKMotionService);

          this._confirmedAccessories.push(myMowerAccessory);
          this._confirmedServices.push(HKBatteryService);
          this._confirmedServices.push(HKFanService);

          this._confirmedServices.push(HKMotionService);
        }
      }

      this.cleanPlatform();

      this.updateMowers();
      this.loaded = true;

      //timer for background refresh
      this.refreshBackground();
    } else {
      this.log('ERROR - discoverAutoMowers - no mower found, will retry in 1 minute - ' + result);

      setTimeout(() => {
        this.autoMowerAPI.getMowers();
      }, 60000);
    }
  },

  updateMowers() {
    for (let a = 0; a < this.foundAccessories.length; a++) {
      this.log.debug('INFO - refreshing - ' + this.foundAccessories[a].name);

      let result = this.autoMowerAPI.discoverdMowers;
      let mowerResult = undefined;

      if (result && result instanceof Array && result.length > 0) {
        for (let s = 0; s < result.length; s++) {
          if (result[s].id === this.foundAccessories[a].mowerID) {
            mowerResult = result[s];
            break;
          }
        }
      }

      if (mowerResult !== undefined) {
        this.refreshAutoMower(this.foundAccessories[a], mowerResult);
      } else {
        this.log('ERROR - updateMowers - no result for mower - ' + this.foundAccessories[a].name);
      }
    }
  },

  getBatteryLevel(homebridgeAccessory, result) {
    var percent = 0;

    if (result && result.status) {
      percent = result.status.batteryPercent;
    }

    return percent;
  },

  getBatteryLevelCharacteristic: function (service, callback) {
    this.log.debug('INFO - getBatteryLevelCharacteristic');

    var percent = service.getCharacteristic(Characteristic.BatteryLevel).value;
    callback(undefined, percent);

    this.autoMowerAPI.getMowers();
  },

  getChargingState(homebridgeAccessory, result) {
    var charging = 0;
    if (
      result &&
      result.status &&
      result.status.connected &&
      result.status.batteryPercent < 100 &&
      (result.status.mowerStatus.activity.startsWith(AutoMowerConst.CHARGING) ||
        result.status.mowerStatus.activity.startsWith(AutoMowerConst.PARKED))
    ) {
      charging = 1;
    }
    this.log.debug('INFO - getChargingState -' + charging);
    return charging;
  },

  getChargingStateCharacteristic: function (service, callback) {
    this.log.debug('INFO - getChargingStateCharacteristic');
    var charging = 0;

    var charging = service.getCharacteristic(Characteristic.ChargingState).value;
    callback(undefined, charging);

    //no update asked, handled by batteryLevel
  },

  isLowBattery(homebridgeAccessory, result) {
    var lowww = 0;

    if (result && result.status && result.status.batteryPercent < 20) {
      lowww = 1;
    }

    return lowww;
  },

  getLowBatteryCharacteristic: function (service, callback) {
    this.log.debug('INFO - getLowBatteryCharacteristic');
    var lowww = 0;

    var lowww = service.getCharacteristic(Characteristic.StatusLowBattery).value;
    callback(undefined, lowww);

    //no update asked, handled by batteryLevel
  },

  isInOperation(homebridgeAccessory, result) {
    var onn = false;

    if (
      result &&
      result.status &&
      result.status.mowerStatus.state.startsWith(AutoMowerConst.IN_OPERATION)
    ) {
      onn = true;
    }

    return onn;
  },

  getSwitchOnCharacteristic: function (service, callback) {
    this.log.debug('INFO - getSwitchOnCharacteristic');
    var onn = false;

    var onn = service.getCharacteristic(Characteristic.On).value;
    callback(undefined, onn);

    this.autoMowerAPI.getMowers();
  },
  setSwitchOnCharacteristic: function (homebridgeAccessory, characteristic, value, callback) {
    this.log.debug('INFO - setSwitchOnCharacteristic - ' + value);

    var currentValue = characteristic.value;
    callback();

    this.autoMowerAPI.sendCommand(
      homebridgeAccessory.mowerID +
        (value ? AutoMowerConst.START_COMMAND : AutoMowerConst.PARK_COMMAND),
      function (error) {
        if (error) {
          setTimeout(function () {
            characteristic.updateValue(currentValue);
          }, 200);
        }
      }
    );
  },

  setSwitchOn2Characteristic: function (homebridgeAccessory, characteristic, value, callback) {
    this.log.debug('INFO - setSwitchOn2Characteristic - ' + value);

    var currentValue = characteristic.value;
    callback();

    this.autoMowerAPI.sendCommand(
      homebridgeAccessory.mowerID + AutoMowerConst.PARK_COMMAND_UFN,
      function (error) {
        setTimeout(function () {
          characteristic.updateValue(false);
        }, 200);
      }
    );
  },

  isMowing(homebridgeAccessory, result) {
    var mowing = 0;

    if (result && result.status) {
      let status = result.status.mowerStatus.activity;
      if (status.startsWith(AutoMowerConst.MOWING)) mowing = 1;
      else if (status.startsWith(AutoMowerConst.STOPPED_IN_GARDEN)) mowing = -1;
      else if (
        result.status.mowerStatus.state &&
        result.status.mowerStatus.state.startsWith(AutoMowerConst.FATAL_ERROR)
      )
        mowing = -1;
    }

    return mowing;
  },

  getMowerOnCharacteristic: function (service, callback) {
    this.log.debug('getMowerOnCharacteristic');

    var mowing = service.getCharacteristic(Characteristic.On).value;
    callback(undefined, mowing);

    this.autoMowerAPI.getMowers();
  },
  setMowerOnCharacteristic: function (homebridgeAccessory, characteristic, value, callback) {
    this.log.debug('setMowerOnCharacteristic -' + value);

    var currentValue = characteristic.value;

    callback();

    this.autoMowerAPI.sendCommand(
      homebridgeAccessory.mowerID +
        (value ? AutoMowerConst.START_COMMAND : AutoMowerConst.PAUSE_COMMAND),
      function (error) {
        if (error) {
          setTimeout(function () {
            characteristic.updateValue(currentValue);
          }, 200);
        }
      }
    );
  },

  bindBatteryLevelCharacteristic: function (service) {
    service.getCharacteristic(Characteristic.BatteryLevel).on(
      'get',
      function (callback) {
        this.getBatteryLevelCharacteristic(service, callback);
      }.bind(this)
    );
  },

  bindChargingStateCharacteristic: function (service) {
    service.getCharacteristic(Characteristic.ChargingState).on(
      'get',
      function (callback) {
        this.getChargingStateCharacteristic(service, callback);
      }.bind(this)
    );
  },

  bindStatusLowBatteryCharacteristic: function (service) {
    service.getCharacteristic(Characteristic.StatusLowBattery).on(
      'get',
      function (callback) {
        this.getLowBatteryCharacteristic(service, callback);
      }.bind(this)
    );
  },

  bindFanOnCharacteristic: function (homebridgeAccessory, service) {
    service
      .getCharacteristic(Characteristic.On)
      .on(
        'get',
        function (callback) {
          this.getMowerOnCharacteristic(service, callback);
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
          this.getSwitchOnCharacteristic(service, callback);
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

  bindSwitchOn2Characteristic: function (homebridgeAccessory, service) {
    service
      .getCharacteristic(Characteristic.On)
      .on(
        'get',
        function (callback) {
          callback(false);
        }.bind(this)
      )
      .on(
        'set',
        function (value, callback) {
          this.setSwitchOn2Characteristic(
            homebridgeAccessory,
            service.getCharacteristic(Characteristic.On),
            value,
            callback
          );
        }.bind(this)
      );
  },

  bindMotionCharacteristic(service) {
    service.getCharacteristic(Characteristic.MotionDetected).on(
      'get',
      function (callback) {
        callback(false);
      }.bind(this)
    );
  },

  refreshBackground() {
    //timer for background refresh
    if (this.refreshTimer !== undefined && this.refreshTimer > 0) {
      this.log.debug(
        'INFO - Setting Timer for background refresh every  : ' + this.refreshTimer + 's'
      );
      this.timerID = setInterval(() => this.autoMowerAPI.getMowers(), this.refreshTimer * 1000);
    }
  },

  refreshAutoMower: function (myAutoMowerAccessory, result) {
    let mowerName = myAutoMowerAccessory.name;

    this.autoMowerAPI.logResult(result);

    let HKSwitchService = myAutoMowerAccessory.getServiceByUUIDAndSubType(
      'Start/Park ' + mowerName,
      'SwitchService' + mowerName
    );

    if (HKSwitchService) {
      HKSwitchService.getCharacteristic(Characteristic.On).updateValue(
        this.isInOperation(myAutoMowerAccessory, result)
      );
    }

    let HKSwitchService2 = myAutoMowerAccessory.getServiceByUUIDAndSubType(
      'Start/ParkUntilResume ' + mowerName,
      'SwitchService2' + mowerName
    );

    if (HKSwitchService2) {
      HKSwitchService2.getCharacteristic(Characteristic.On).updateValue(
        this.isInOperation(myAutoMowerAccessory, result)
      );
    }

    let HKFanService = myAutoMowerAccessory.getServiceByUUIDAndSubType(
      'Start/Pause ' + mowerName,
      'FanService' + mowerName
    );

    if (HKFanService) {
      let isMowing = this.isMowing(myAutoMowerAccessory, result);
      HKFanService.getCharacteristic(Characteristic.On).updateValue(isMowing > 0 ? true : false);

      let HKMotionService = myAutoMowerAccessory.getServiceByUUIDAndSubType(
        mowerName + ' needs attention',
        'MotionService' + mowerName
      );

      //handling error
      if (HKMotionService) {
        if (isMowing < 0) {
          HKMotionService.getCharacteristic(Characteristic.MotionDetected).updateValue(true);
          this.log.debug('INFO - MotionDetected');
        } else if (HKMotionService.getCharacteristic(Characteristic.MotionDetected).value) {
          HKMotionService.getCharacteristic(Characteristic.MotionDetected).updateValue(false);
          this.log.debug('INFO - MotionDetected reset ');
        }
      }
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
