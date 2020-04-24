# Homebridge-automower

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

[![npm](https://img.shields.io/npm/v/homebridge-automower.svg)](https://www.npmjs.com/package/homebridge-automower)
[![npm](https://img.shields.io/npm/dw/homebridge-automower.svg)](https://www.npmjs.com/package/homebridge-automower)
[![npm](https://img.shields.io/npm/dt/homebridge-automower.svg)](https://www.npmjs.com/package/homebridge-automower)

[![CodeFactor](https://www.codefactor.io/repository/github/nicoduj/homebridge-automower/badge)](https://www.codefactor.io/repository/github/nicoduj/homebridge-automower)
[![Build Status](https://travis-ci.com/nicoduj/homebridge-automower.svg?branch=master)](https://travis-ci.com/nicoduj/homebridge-automower)
[![Known Vulnerabilities](https://snyk.io/test/github/nicoduj/homebridge-automower/badge.svg?targetFile=package.json)](https://snyk.io/test/github/nicoduj/homebridge-automower?targetFile=package.json)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

<img src="https://user-images.githubusercontent.com/19813688/80208719-1a3dd200-8631-11ea-9e7b-c72abeee8ea9.jpeg" width="25%" align="right"> 
<img src="https://user-images.githubusercontent.com/19813688/80208728-1d38c280-8631-11ea-9169-c5204946db4c.PNG" width="25%" align="right">

Plugin for controlling your [automower](https://www.husqvarna.com/fr/produits/robots-tondeuses/) from [Husqvarna](https://www.husqvarna.com/f) through [HomeBridge](https://github.com/nfarina/homebridge) .

Each Automower is shown through 3 services :

- One switch that will handle Start / PARK (until next period) function
- One fan that will handle Start / Pause function and spin when your mower is cutting (and only cutting, not while getting back to its charging station)
- One Motion sensor that will be triggered when your mower needs attention while cutting

The battery percentage / charging status is shown in the detail pane of each service.

`npm install -g homebridge-automower`

## Homebridge configuration

Config as below:

```json
"platforms": [
  {
    "platform": "HomebridgeAutomower",
	  "email": "toto@titi.com",
    "password": "toto"
  }
]
```

Fields:

- `platform` must be "HomebridgeAutomower" (required).
- `email` email used for your automower account (required).
- `password` password of your automower account (required).
- `refreshTimer` Optional - enable refresh of autoMower state every X seconds, for automation purpose if you need to activate something else based on its state change (defaults : disable, accepted range : 30-600s).
- `cleanCache` Set it to true in case you want to remove the cached accessory (only those from this plugin). You have to restart homebridge after applying the option. Remove it after restart, otherwise it will be recreated at each startup.

## Changelog

See [CHANGELOG][].

[changelog]: CHANGELOG.md

## Inspiration

Many thanks to :

- [dinmammas] for plugin inspiration
- [chrisz] for automower api samples
- every tester / contributor that test, and give feedback in any way !

[dinmammas]: https://github.com/dinmammas/homebridge-robonect
[chrisz]: https://github.com/chrisz/pyhusmow

## Donating

Support this project and [others by nicoduj][nicoduj-projects] via [PayPal][paypal-nicoduj].

[![Support via PayPal][paypal-button]][paypal-nicoduj]

[nicoduj-projects]: https://github.com/nicoduj/
[paypal-button]: https://img.shields.io/badge/Donate-PayPal-green.svg
[paypal-nicoduj]: https://www.paypal.me/nicoduj

## License

As of Dec 01 2018, Nicolas Dujardin has released this repository and its contents to the public domain.

It has been released under the [UNLICENSE][].

[unlicense]: LICENSE
