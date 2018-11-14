**WIP**  

# Homebridge-automower

<img src="" width="30%" align="right"> 

Development ongoing.  AS-IS it _should_ fetch battery percentage, simulate mowing with a fan accessory, and provide an "on/off"-switch for toggling auto/home.  To activate "end of day"-mode, click the fan accessory while it's mowing.

## Usage

`npm install -g homebridge-automower`

Config as below:  

	{  
		"accessory": "HomebridgeAutomower",  
		"name": "name-of-your-mower",   
		"model": "Mower Model",   
		"email": "Your account email",  
		"password": "Your password"  
	}  
  

### Note

