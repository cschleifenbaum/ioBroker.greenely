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

class TemperaturNu extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "temperatur-nu",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));

        this.unloaded = false;
	}

    sleep(ms) {
        return new Promise(resolve => setTimeout(() => !this.unloaded && resolve(), ms));
    }

    async main() {
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
                response = await axios.get(url, {headers: {'user-agent': `ioBroker.temperatur-nu/${packJson.version}`}});
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
	    if ((!this.config.longitude && this.config.longitude !== 0) || isNaN(this.config.longitude) ||
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
        }



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


        await this.main();
        this.log.info('Update of data done, existing ...');
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
	module.exports = (options) => new TemperaturNu(options);
} else {
	// otherwise start the instance directly
	new TemperaturNu();
}
