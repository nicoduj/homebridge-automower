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

  this.loaded = false;

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
        this.log.debug('Mower : ' + JSON.stringify(result[s]));

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

          this.api.registerPlatformAccessories('homebridge-automower', 'HomebridgeAutomower', [
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
      }

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
      (result.batteryPercent < 100 ||
        result.status.mowerStatus.activity.startsWith(AutoMowerConst.CHARGING))
    ) {
      charging = 1;
    }

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

    if (result && result.status && result.batteryPercent < 20) {
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
    this.autoMowerAPI.sendCommand(
      homebridgeAccessory,
      value ? AutoMowerConst.START_COMMAND : AutoMowerConst.PARK_COMMAND,
      characteristic,
      callback
    );
  },

  isMowing(homebridgeAccessory, result) {
    var mowing = 0;

    if (result && result.status) {
      let status = result.status.mowerStatus.activity;
      if (status.startsWith(AutoMowerConst.MOWING)) mowing = 1;
      else if (status.startsWith(AutoMowerConst.STOPPED_IN_GARDEN)) mowing = -1;
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
    this.autoMowerAPI.sendCommand(
      homebridgeAccessory,
      value ? AutoMowerConst.START_COMMAND : AutoMowerConst.PAUSE_COMMAND,
      characteristic,
      callback
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

    let HKFanService = myAutoMowerAccessory.getServiceByUUIDAndSubType(
      'Start/Pause ' + mowerName,
      'FanService' + mowerName
    );

    if (HKFanService) {
      let isMowing = this.isMowing(myAutoMowerAccessory, result);
      HKFanService.getCharacteristic(Characteristic.On).updateValue(isMowing > 0 ? true : false);

      //handling error
      if (isMowing < 0) {
        let HKMotionService = myMowerAccessory.getServiceByUUIDAndSubType(
          mowerName + ' needs attention',
          'MotionService' + mowerName
        );
        if (HKMotionService) {
          HKMotionService.getCharacteristic(Characteristic.MotionDetected).updateValue(true);
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
