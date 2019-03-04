module.exports = {
  checkTimer: function(timer) {
    if (timer && timer > 0 && (timer < 30 || timer > 600)) return 180;
    else return timer;
  },

  AutoMowerAccessory: function(services) {
    this.services = services;
  },
};
