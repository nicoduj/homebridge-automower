
# Homebridge-automower

<img src="https://user-images.githubusercontent.com/19813688/48661529-729f9600-ea73-11e8-8051-37adfd687922.PNG" width="25%" align="right"> 
<img src="https://user-images.githubusercontent.com/19813688/48661518-4c79f600-ea73-11e8-9c2f-45a8958106a5.PNG" width="25%" align="right"> 


Plugin for controlling your automower from Homekit through Homebridge.

Automower is shown through two devices :
- One switch that will handle Start / PARK (until next period) function
- One fan that will handle Start / Pause function and spin when your mower is cutting (and only cutting, not while getting back to its charging station)

The battery percentage / charging status is shown in the detail pane of the fan.


`npm install -g homebridge-automower`

## Homebridge configuration

Config as below:  

	{  
		"accessory": "HomebridgeAutomower",  
		"name": "name-of-your-mower",   
		"model": "Mower Model",   
		"email": "Your account email",  
		"password": "Your password"  
	}  

The name must be the real name of your mower. I think you can add two mowers if needed, but since I have only one I didn't check if it works !
The model property can be whatever you want.

### Notes  

Based on the following works : 
- https://github.com/dinmammas/homebridge-robonect
- https://github.com/chrisz/pyhusmow
  
I am not a pro in nodejs, so the code is probably a bit messy :)
