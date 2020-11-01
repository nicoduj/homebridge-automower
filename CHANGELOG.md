# Changelog

All notable changes to this project will be documented in this file.

## 1.4.0

- [NEW] #21 Add a switch to handle start / stop until further notice
- [FIX] #25 Lifted error not indicated
- [FIX] #24 Parked also means charging
- [NEW] #23 select which mower to use

## 1.3.2

**Platform Name change - you need to uninstall or modify configuration**

- [NEW] cleaning lost devices from cache

## 1.3.1

- [FIX] code improvments

## 1.3.0

**You need to cleanCache if you had installed before, with option cleanCache . Remember to remove it after restart - sorry for that**

- [FIX] better handling of api in order to prevent blocking homekit in case of timeout #16
- [NEW] motion sensor that will trigger in case of error of automower (only if you have background refresh or while refreshing )

## 1.2.2

- [FIX] automatic attemps to discovery if first one fails

## 1.2.1

- [FIX] cleanCache option

## 1.2.0

- [NEW] fix launch error for certification and moving to dynamic platform

## 1.1.9

- [NEW] fix log

## 1.1.8

- [NEW] dep bump and config check for homebridge verified plugin process

## 1.1.7

- [NEW] Supports config UI X configuration interface.

## 1.1.6

- [FIX] fixing #9 Concurrent api logins

## 1.1.5

- [FIX] log fix

## 1.1.4

- [FIX] fixing charging stae / battery level

## 1.1.3

- [NEW] huge refactoring to enhance code quality (I hope there won't be too much bugs ! )
- [NEW] refreshTimer for background refresh

## 1.1.2

- [FIX] charging status not correct

## 1.1.1

- [FIX] status not retrieved

## 1.1.0

- [NEW] #1 Moves to platform mode, so that automower discovery is auto. No need anymore to set the name / model . **CONFIG MUST BE CHANGED**
