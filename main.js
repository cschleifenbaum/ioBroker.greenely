"use strict";

/*
 * Created with @iobroker/create-adapter v3.1.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:
// const fs = require("fs");

class Greenely extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
     */
    constructor(options) {
        super({
            ...options,
            name: "greenely",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.log.info("Test");

        this.unloaded = false;
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        this.log.info("Greenely adapter is ready.");

        // Force terminate after 5min
        setTimeout(() => {
            this.unloaded = true;
            this.log.error('force terminate');
            this.terminate ? this.terminate() : process.exit(0);
        }, 300000);

        // Fetch data
        this.fetchData();

        this.log.info('Update of data done, existing ...');
        this.terminate ? this.terminate() : process.exit(0);
    }

    async fetchData() {
        // Initialize your adapter here
        this.log.info("Greenely fetching electricity prices");

        let headers = { "User-Agent": "iOS 2 266" };

        let loginData = { email: adapter.config.username,
                          password: adapter.config.password,
                          device_id: adapter.config.device_id };

        let content = await fetchDataRaw(url.concat("login"), headers, loginData);

        this.log.debug("Login complete");
        this.log.debug(content);
    }

    async fetchDataRaw(url, headers, data = null) {
        adapter.log.debug('local request started: ' + url);
        adapter.log.debug(JSON.stringify(headers));
        adapter.log.debug(JSON.stringify(data));
        let response;
        try {
            response = await axios({
                method: data == null ? 'get' : 'post',
                baseURL: url,
                headers: headers,
                timeout: 10000,
                data: data,
                responseType: 'json'
           });
        } catch (error) {
            adapter.log.error('received error ' + error);
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
        adapter.log.debug('local request done');
        adapter.log.debug('received data (' + response.status + '): ' + JSON.stringify(response.data));
        return response.data;
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param {() => void} callback - Callback function
     */
    onUnload(callback) {
        try {
            this.unloaded = true;
            callback();
        } catch (error) {
            this.log.error(`Error during unloading: ${error.message}`);
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     *
     * @param {string} id - State ID
     * @param {ioBroker.State | null | undefined} state - State object
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

            if (state.ack === false) {
                // This is a command from the user (e.g., from the UI or other adapter)
                // and should be processed by the adapter
                this.log.info(`User command received for ${id}: ${state.val}`);

                // TODO: Add your control logic here
            }
        } else {
            // The object was deleted or the state value has expired
            this.log.info(`state ${id} deleted`);
        }
    }
}

adapter.log.info("Quak Test");

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
     */
    module.exports = options => new Greenely(options);
} else {
    // otherwise start the instance directly
    new Greenely();
}
