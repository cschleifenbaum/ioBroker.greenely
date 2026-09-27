"use strict";

const axios = require('axios')

const packJson = require('./package.json');

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:
// const fs = require("fs");

class Greenely extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "greenely",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));

        this.unloaded = false;
        this.jwt = undefined;
	}

    sleep(ms) {
        return new Promise(resolve => setTimeout(() => !this.unloaded && resolve(), ms));
    }

    async fetchDataRaw(url, data = null) {
        let headersDefault = { "User-Agent": "iOS 2 266" };
        let headersLoggedIn = { "User-Agent": "iOS 2 266", "Authorization": "JWT " + this.jwt };
        let headers = this.jwt === undefined ? headersDefault : headersLoggedIn;
        this.log.debug("local request started: " + url);
        let fullurl = this.config["greenelyApiUrl"] + url;
        this.log.debug("local request started: " + fullurl);
        this.log.debug(JSON.stringify(headers));
        this.log.debug(JSON.stringify(data));

        let response;
        try {
            response = await axios({
                method: data == null ? 'get' : 'post',
                baseURL: fullurl,
                headers: headers,
                timeout: 10000,
                data: data,
                responseType: 'json'
           });
        } catch (error) {
            this.log.error(JSON.stringify(this.config));
            this.log.error(fullurl);
            this.log.error("Received error " + error);
            (error) => {
                if (error.response) {
                    // The request was made and the server responded with a status code

                    this.log.warn('received error ' + error.response.status + ' response with content: ' + JSON.stringify(error.response.data));
                } else if (error.request) {
                    // The request was made but no response was received
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js<div></div>
                    this.log.error(error.message);
                } else {
                    // Something happened in setting up the request that triggered an Error
                    this.log.error(error.message);
                }
            }
            return null;
        }
        this.log.debug('local request done');
        this.log.debug('received data (' + response.status + '): ' + JSON.stringify(response.data));
        return response.data;
    }

    async fetchSpotPrices(facility, date, dayName) {
        try {
            const dateString = date.toISOString().split('T')[0];
            date.setDate(date.getDate() + 1);
            const endDateString = date.toISOString().split('T')[0];

            let content = await this.fetchDataRaw("facilities/" + facility + "/spot-price?from=" + dateString + "&resolution=hourly&to=" + endDateString);

            var hour = -1;
            var quarter = -1;

            this.log.debug("These are the prices for " + dayName);

            let stateTotalBaseName = "facilities." + facility + ".spot-price." + dayName;
            await this.delObjectAsync(stateTotalBaseName, { recursive: true });

            return;

            for (var key in content.data) {
                ++hour;
                let value = content.data[key];
                this.log.debug(JSON.stringify(value));
                this.log.debug(hour + " " + value.price);
                let stateBaseName = stateTotalBaseName + "." + hour + ".";
                let stateBaseNameCurrent = "facilities." + facility + ".spot-price.current.";

                let startDate = new Date(key * 1000);
                let endDate = new Date(key * 1000 + 3599999);
                let price = value.price / 1000.0;

                if (value.price == null) {
                    continue;
                }

                this.createObject(stateBaseName + "start", "string");
                this.createObject(stateBaseName + "end", "string");
                this.createObject(stateBaseName + "price", "number", "öre/kWh");

                //write prices / timestamps to their data points
                this.setState(stateBaseName + "start", startDate.toISOString(), true);
                this.setState(stateBaseName + "end", endDate.toISOString(), true);
                this.setStateAsync(stateBaseName + "price", price, true);

                // if it's the current hour, mark it as current
                let now = Date.now();
                if (now >= key * 1000 && now < key * 1000 + 3600000) {
                    this.createObject(stateBaseNameCurrent + "start", "string");
                    this.createObject(stateBaseNameCurrent + "end", "string");
                    this.createObject(stateBaseNameCurrent + "price", "number", "öre/kWh");

                    this.setState(stateBaseNameCurrent + "start", startDate.toISOString(), true);
                    this.setState(stateBaseNameCurrent + "end", endDate.toISOString(), true);
                    this.setState(stateBaseNameCurrent + "price", price, true);
                }
            }
        } catch (error) {
            this.log.error(`Error while fetching spot prices: ${error.message}`);
        }
    }

    createObject(id, type, unit = null) {
        this.log.debug('createObject ' + id);
        let objData = {
                type: "state",
                common: {
                    type: type,
                    role: "value",
                    read: true,
                    write: false,
                    unit: unit
                },
        };
        this.getObject(id, (err, oldObj) => {
            if (!err && oldObj) {
                this.extendObject(id, objData, null);
            } else {
                this.setObjectNotExists(id, objData, null);
            }
        });
    }

    async fetchData() {
        let content = await this.fetchDataRaw("facilities/?includes=parameters");

        this.log.debug(JSON.stringify(content));

        for (var f in content["data"]) {
            var facility = content["data"][f];
            var facilityId = facility["id"];
            this.log.info("Fetching data for facility " + facility["id"]);


            var today = new Date();
            await this.fetchSpotPrices(facilityId, today, "today");

            var tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            await this.fetchSpotPrices(facilityId, tomorrow, "tomorrow");
        }
    }

    async login() {
        let loginData = { email: this.config.username,
            password: this.config.password,
            device_id: this.config.device_id
        };

        let data = await this.fetchDataRaw("login", loginData);
        if (data === null) {
            return false;
        }

        this.jwt = data["jwt"];

        return this.jwt !== undefined;;
	}

    async main() {
        if (this.jwt === undefined) {
            // login required
            if (!(await this.login())) {
                this.log.error("Login failed!");
                return;
            }
            this.log.debug("Logged in.");
        }


        this.fetchData();


        let apiParam = '';
        if (
            this.config.latitude !== undefined && this.config.longitude !== undefined &&
            this.config.latitude !== null && this.config.longitude !== null &&
            this.config.latitude !== '' && this.config.longitude !== '' &&
            !isNaN(this.config.latitude) && !isNaN(this.config.longitude)
        ) {
            apiParam += `&lat=${this.config.latitude}&lon=${this.config.longitude}`;
            const url = 'https://api.temperatur.nu/tnu_1.17.php?cli=tnu' + apiParam;
            this.log.info(`Get forecast from ${url}`)
            let response;
            try {
                response = await axios.get(url, {headers: {'user-agent': `ioBroker.greenely/${packJson.version}`}});
            } catch (err) {
                this.log.error(`Error while requesting data: ${err.message}`);
                this.log.error('Please check your settings!');
            }
            if (response) {
                try {
                    await this.updateData(response.data);
                } catch (err) {
                    this.log.error(`Error while updating data: ${err.message}`);
                }
            }
            this.log.info('Data updated.');
        } else {
            this.log.error('Longitude or Latitude not set correctly.');
        }
    }

    async updateData(data) {
        this.log.info(`Raw data: ${JSON.stringify(data)}`);

        const device = 'station';
        const now = Date.now();

        await this.setObjectNotExistsAsync(device, {
            type: 'device',
            common: {
                name: 'station',
                role: 'wheater'
            },
            native: {},
        });

        await this.setObjectNotExistsAsync(device + '.title', {
            type: 'state',
            common: {
                name: 'station title',
                role: 'text',
                read: true,
                write: false,
                unit: '',
                type: 'string'
            },
            native: {},
        });
        // Update existing
        this.extendObjectAsync(device + '.title', {
            common: {
                type: 'string',
                role: 'text'
            }
        });
        await this.setStateAsync(device + '.title', data.stations[0].title, true);


        await this.setObjectNotExistsAsync(device + '.id', {
            type: 'state',
            common: {
                name: 'station id',
                role: 'text',
                read: true,
                write: false,
                unit: '',
                type: 'string'
            },
            native: {},
        });
        // Update existing
        this.extendObjectAsync(device + '.id', {
            common: {
                type: 'string',
                role: 'text'
            }
        });
        await this.setStateAsync(device + '.id', data.stations[0].id, true);


        await this.setObjectNotExistsAsync(device + '.temperature', {
            type: 'state',
            common: {
                name: 'current temperature',
                role: 'value.temperature',
                read: true,
                write: false,
                unit: '°C',
                type: 'number'
            },
            native: {},
        });
        // Update existing
        this.extendObjectAsync(device + '.temperature', {
            common: {
                type: 'number',
                role: 'value.temperature'
            }
        });
        await this.setStateAsync(device + '.temperature', parseFloat(data.stations[0].temp), true);
    }

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
	    /*if ((!this.config.longitude && this.config.longitude !== 0) || isNaN(this.config.longitude) ||
            (!this.config.latitude && this.config.latitude !== 0) || isNaN(this.config.latitude)
        ) {
            this.log.info('longitude/longitude not set, get data from system');
            try {
                const state = await this.getForeignObjectAsync('system.config');
                this.config.longitude = state.common.longitude;
                this.config.latitude = state.common.latitude;
                this.log.info(`system latitude: ${this.config.latitude} longitude: ${this.config.longitude}`);
            } catch (err) {
                this.log.error(err);
            }
        } else {
            this.log.info(`longitude/longitude will be set by self-Config - longitude: ${this.config.longitude} latitude: ${this.config.latitude}`);
        }*/



        // now start fetching the actual data
        const delay = Math.floor(Math.random() * 30000);
        this.log.info(`Delay execution by ${delay}ms to better spread API calls`);
        await this.sleep(delay);

        // Force terminate after 5min
        setTimeout(() => {
            this.unloaded = true;
            this.log.error('force terminate');
            this.terminate ? this.terminate() : process.exit(0);
        }, 300000);


        try {
            await this.main();
        } catch (error) {
            this.log.error(error);
        }
        this.log.info('Update of data done, exiting ...');
        this.terminate ? this.terminate() : process.exit(0);
    }

	onUnload(callback) {
        this.unloaded = true;
        callback && callback();
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Greenely(options);
} else {
	// otherwise start the instance directly
	new Greenely();
}
