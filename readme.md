# Homebridge-automower

[![npm](https://img.shields.io/npm/v/homebridge-automower.svg)](https://www.npmjs.com/package/homebridge-automower)
[![npm](https://img.shields.io/npm/dw/homebridge-automower.svg)](https://www.npmjs.com/package/homebridge-automower)
[![npm](https://img.shields.io/npm/dt/homebridge-automower.svg)](https://www.npmjs.com/package/homebridge-automower)

[![Build Status](https://travis-ci.com/nicoduj/homebridge-automower.svg?branch=master)](https://travis-ci.com/nicoduj/homebridge-automower)
[![Known Vulnerabilities](https://snyk.io/test/github/nicoduj/homebridge-automower/badge.svg?targetFile=package.json)](https://snyk.io/test/github/nicoduj/homebridge-automower?targetFile=package.json)
[![Greenkeeper badge](https://badges.greenkeeper.io/nicoduj/homebridge-automower.svg)](https://greenkeeper.io/)

<img src="https://user-images.githubusercontent.com/19813688/48661529-729f9600-ea73-11e8-8051-37adfd687922.PNG" width="25%" align="right"> 
<img src="https://user-images.githubusercontent.com/19813688/48661518-4c79f600-ea73-11e8-9c2f-45a8958106a5.PNG" width="25%" align="right">

Plugin for controlling your [automower](https://www.husqvarna.com/fr/produits/robots-tondeuses/) from [Husqvarna](https://www.husqvarna.com/f) through [HomeBridge](https://github.com/nfarina/homebridge) .

Each Automower is shown through two services :

- One switch that will handle Start / PARK (until next period) function
- One fan that will handle Start / Pause function and spin when your mower is cutting (and only cutting, not while getting back to its charging station)

The battery percentage / charging status is shown in the detail pane of both services .

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

## Changelog

- 1.1.2
  - [FIX] charging status not correct
- 1.1.1
  - [FIX] status not retrieved
- 1.1.0
  - [NEW] #1 Moves to platform mode, so that automower discovery is auto. No need anymore to set the name / model . **CONFIG MUST BE CHANGED**

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
[paypal-nicoduj]: https://www.paypal.me/nicoduj/2.50

## License

As of Dec 01 2018, Nicolas Dujardin has released this repository and its contents to the public domain.

It has been released under the [UNLICENSE][].

[unlicense]: LICENSE
