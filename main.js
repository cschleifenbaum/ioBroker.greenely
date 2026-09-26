// @ts-nocheck
"use strict";

const { Adapter } = require("@iobroker/adapter-core");
/*
 * Created with @iobroker/create-adapter v1.29.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require('axios');

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;

/**
 * Starts the adapter instance
 * @param {Partial<utils.AdapterOptions>} [options]
 */
function startAdapter(options) {
    // Create the adapter and define its methods
    return adapter = utils.adapter(Object.assign({}, options, {
        name: "greenely",

        // The ready callback is called when databases are connected and adapter received configuration.
        // start here!
        ready: main, // Main method defined below for readability

        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: (callback) => {
            try {
                // Here you must clear all timeouts or intervals that may still be active
                // clearTimeout(timeout1);
                // clearTimeout(timeout2);
                // ...
                // clearInterval(interval1);

                callback();
            } catch (e) {
                callback();
            }
        },

        // // is called if a subscribed state changes
        // stateChange: (id, state) => {
        //     if (state) {
        //         // The state was changed
        //         adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        //     } else {
        //         // The state was deleted
        //         adapter.log.info(`state ${id} deleted`);
        //     }
        // },
    }));
}

async function fetchData(url, headers, data = null) {
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

function createObject(id, type, unit = null) {
    adapter.log.debug('createObject ' + id);
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
    adapter.getObject(id, (err, oldObj) => {
        if (!err && oldObj) {
            adapter.extendObject(id, objData, null);
        } else {
            adapter.setObjectNotExists(id, objData, null);
        }
    });

}
 
function compareValues(key, order = 'asc') {
    return function innerSort(a, b) {
      if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
        // property doesn't exist on either object
        return 0;
      }
  
      const varA = (typeof a[key] === 'string')
        ? a[key].toUpperCase() : a[key];
      const varB = (typeof b[key] === 'string')
        ? b[key].toUpperCase() : b[key];
  
      let comparison = 0;
      if (varA > varB) {
        comparison = 1;
      } else if (varA < varB) {
        comparison = -1;
      }
      return (
        (order === 'desc') ? (comparison * -1) : comparison
      );
    };
  }

async function main() {

    // adapter.log.info("aWATTar API URL: " + adapter.config.aWATTarApiUrl);
    // adapter.log.info("Loading Threshold Start: " + adapter.config.LoadingThresholdStart);
    // adapter.log.info("Loading Threshold End: " + adapter.config.LoadingThresholdEnd);
    
    const url = adapter.config.greenelyApiUrl;
    const vat = parseInt(adapter.config.VATRate);
    const username = adapter.config.username;
    const password = adapter.config.password;
    const device_id = adapter.config.device_id;
    const vatRate = (vat + 100) / 100;
    const workRate = parseFloat(adapter.config.WorkRate);
//    const loadingThresholdStart = adapter.config.LoadingThresholdStart;
//    if (isNaN(parseInt(loadingThresholdStart))) {return adapter.log.error("loadingThresholdStart NaN")}
//    const loadingThresholdEnd = adapter.config.LoadingThresholdEnd;
//    if (isNaN(parseInt(loadingThresholdStart))) {return adapter.log.error("loadingThresholdEnd NaN")}

    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    today.setDate(today.getDate() + 1);
    const tomorrowString = today.toISOString().split('T')[0];
    today.setDate(today.getDate() + 1);
    const dayAfterTomorrowString = today.toISOString().split('T')[0];
//    const loadingThresholdStartDateTime = new Date(heute.getFullYear(),heute.getMonth(),heute.getDate(),parseInt(loadingThresholdStart),0,0)
//    const loadingThresholdEndDateTime = new Date(heute.getFullYear(),heute.getMonth(),heute.getDate() + 1,parseInt(loadingThresholdEnd),0,0)

//    let epochToday = new Date(heute.getFullYear(),heute.getMonth(),heute.getDate()).getTime();
//    let epochTomorrow = new Date(heute.getFullYear(),heute.getMonth(),heute.getDate()+2).getTime() - 1;
//    let urlEpoch = url.concat("?start=", epochToday.toString(), "&end=", epochTomorrow.toString());

    let loginData = { email: username,
                      password: password,
                      device_id: device_id };

    let headers = { 'User-Agent': "iOS 2 266" };

    let content = await fetchData(url.concat("login"), headers, loginData);
    let jwt = content.jwt;

    headers = { 'User-Agent': "iOS 2 266",
                'Authorization': 'JWT '+ jwt};


    // load user's facilities
    content = await fetchData(url.concat("facilities/%3Fincludes=parameters"), headers);

    const facility = content.data[0].id;
    adapter.log.debug("Using facility with ID: " + facility);

    // load today's spot price
    let urlSpot = url.concat("facilities/" + facility + "/spot-price?from=" + todayString + "&resolution=hourly&to=" + tomorrowString);
    content = await fetchData(urlSpot, headers);
    
    let i = -1;
    await adapter.delObjectAsync("facilities." + facility + ".spot-price.today", { recursive: true });
    for (var key in content.data) {
        ++i;
        let value = content.data[key];
        adapter.log.debug(key + " " + value.price);
        let stateBaseName = "facilities." + facility + ".spot-price.today." + i + ".";
        let stateBaseNameCurrent = "facilities." + facility + ".spot-price.current.";

        //calculate prices / timestamps
        let startDate = new Date(key * 1000);
        let endDate = new Date(key * 1000 + 3599999);
        let price = value.price / 1000.0;

        if (value.price == null)
            continue;

        createObject(stateBaseName + "start", "string");
        createObject(stateBaseName + "end", "string");
        createObject(stateBaseName + "price", "number", "öre/kWh");

        //write prices / timestamps to their data points
        await Promise.all(
            [adapter.setStateAsync(stateBaseName + "start", startDate.toISOString(), true),
             adapter.setStateAsync(stateBaseName + "end", endDate.toISOString(), true),
             adapter.setStateAsync(stateBaseName + "price", price, true)
            ])

        let now = Date.now();
        if (now >= key * 1000 && now < key * 1000 + 3600000) {
            createObject(stateBaseNameCurrent + "start", "string");
            createObject(stateBaseNameCurrent + "end", "string");
            createObject(stateBaseNameCurrent + "price", "number", "öre/kWh");

            await Promise.all(
                [adapter.setStateAsync(stateBaseNameCurrent + "start", startDate.toISOString(), true),
                 adapter.setStateAsync(stateBaseNameCurrent + "end", endDate.toISOString(), true),
                 adapter.setStateAsync(stateBaseNameCurrent + "price", price, true)
            ])
        }
    }

    // load tomorrow's spot price
    urlSpot = url.concat("facilities/" + facility + "/spot-price?from=" + tomorrowString + "&resolution=hourly&to=" + dayAfterTomorrowString);
    content = await fetchData(urlSpot, headers);
    
    i = -1;
    await adapter.delObjectAsync("facilities." + facility + ".spot-price.tomorrow", { recursive: true });
    for (var key in content.data) {
        ++i;
        let value = content.data[key];
        adapter.log.debug(key + " " + value.price);
        let stateBaseName = "facilities." + facility + ".spot-price.tomorrow." + i + ".";

        //calculate prices / timestamps
        let startDate = new Date(key * 1000);
        let endDate = new Date(key * 1000 + 3599999);
        let price = value.price / 1000.0;

        if (value.price == null)
            continue;

        createObject(stateBaseName + "start", "string");
        createObject(stateBaseName + "end", "string");
        createObject(stateBaseName + "price", "number", "öre/kWh");

        //write prices / timestamps to their data points
        await Promise.all(
            [adapter.setStateAsync(stateBaseName + "start", startDate.toISOString(), true),
             adapter.setStateAsync(stateBaseName + "end", endDate.toISOString(), true),
             adapter.setStateAsync(stateBaseName + "price", price, true)
            ])
    }

    return;

    //write raw data to data point
    await adapter.setObjectNotExistsAsync("Rawdata", {
        type: "state",
        common: {
            name: "Rawdata",
            type: "string",
            role: "value",
            desc: "Beinhaltet die Rohdaten des Abfrageergebnisses als JSON",
            read: true,
            write: false
        },
        native: {}
    });
    await adapter.setStateAsync("Rawdata", JSON.stringify(content), true);

    let array = content.data;

    for(let i = 0; i < array.length; i++) {
        let stateBaseName = "prices." + i + ".";

        //ensure all necessary data points exist
        await adapter.setObjectNotExistsAsync(stateBaseName + "start", {
            type: "state",
            common: {
                name: "Gultigkeitsbeginn (Uhrzeit)",
                type: "string",
                role: "value",
                desc: "Uhrzeit des Beginns der Gültigkeit des Preises",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "startTimestamp", {
            type: "state",
            common: {
                name: "startTimestamp",
                type: "number",
                role: "value",
                desc: "Timestamp des Beginns der Gültigkeit des Preises",
                read: true,
                write: false
            },
            native: {}
        });
		
        await adapter.setObjectNotExistsAsync(stateBaseName + "startDate", {
            type: "state",
            common: {
                name: "Gultigkeitsbeginn (Datum)",
                type: "string",
                role: "value",
                desc: "Datum des Beginns der Gültigkeit des Preises",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "end", {
            type: "state",
            common: {
                name: "Gultigkeitsende (Uhrzeit)",
                type: "string",
                role: "value",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "endTimestamp", {
            type: "state",
            common: {
                name: "endTimestamp",
                type: "number",
                role: "value",
                desc: "Timestamp des Endes der Gültigkeit des Preises",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "endDate", {
            type: "state",
            common: {
                name: "Gultigkeitsende (Datum)",
                type: "string",
                role: "value",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "nettoPriceKwh", {
            type: "state",
            common: {
                name: "Preis pro KWh (excl. MwSt.)",
                type: "number",
                role: "value",
                unit: "Cent / KWh",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "bruttoPriceKwh", {
            type: "state",
            common: {
                name: "Preis pro KWh (incl. MwSt.)",
                type: "number",
                role: "value",
                unit: "Cent / KWh",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "totalPriceKwh", {
            type: "state",
            common: {
                name: "Gesamtpreis pro KWh (incl. MwSt.)",
                type: "number",
                role: "value",
                unit: "Cent / KWh",
                read: true,
                write: false
            },
            native: {}
        });

        //calculate prices / timestamps
		let startTs = array[i].start_timestamp;
        let start = new Date(startTs);
        let startTime = start.toLocaleTimeString('de-DE');
        let startDate = start.toLocaleDateString('de-DE');
		let endTs = array[i].end_timestamp;
        let end = new Date(endTs);
        let endTime = end.toLocaleTimeString('de-DE');
        let endDate = end.toLocaleDateString('de-DE');
        let nettoPriceKwh = array[i].marketprice / 10; //price is in eur per MwH. Convert it in cent per KwH
        let bruttoPriceKwh = nettoPriceKwh * vatRate; 
        let toalPriceKwh = bruttoPriceKwh + workRate ; 

        //write prices / timestamps to their data points
        await Promise.all(
            [adapter.setStateAsync(stateBaseName + "start", startTime, true)
            ,adapter.setStateAsync(stateBaseName + "startTimestamp", startTs, true)
			,adapter.setStateAsync(stateBaseName + "startDate", startDate, true)
            ,adapter.setStateAsync(stateBaseName + "end", endTime, true)
			,adapter.setStateAsync(stateBaseName + "endTimestamp", endTs, true)
            ,adapter.setStateAsync(stateBaseName + "endDate", endDate, true)
            ,adapter.setStateAsync(stateBaseName + "nettoPriceKwh", nettoPriceKwh, true)
            ,adapter.setStateAsync(stateBaseName + "bruttoPriceKwh", bruttoPriceKwh, true)
            ,adapter.setStateAsync(stateBaseName + "totalPriceKwh", toalPriceKwh, true)
            ])
    }

    adapter.log.debug('all prices written to their data points');

    //ordered prices
    let sortedArray = array.sort(compareValues("marketprice", "asc"));
    let j= 0;

    for(let k = 0; k < sortedArray.length; k++) {
		let startTs = array[k].start_timestamp;
        let start = new Date(startTs);
		let endTs = array[k].end_timestamp;
        let end = new Date(endTs);

        if (start >= loadingThresholdStartDateTime && end < loadingThresholdEndDateTime) {
            let stateBaseName = "pricesOrdered." + j + ".";

            //ensure all necessary data points exist
            await adapter.setObjectNotExistsAsync(stateBaseName + "start", {
                type: "state",
                common: {
                    name: "Gultigkeitsbeginn (Uhrzeit)",
                    type: "string",
                    role: "value",
                    desc: "Uhrzeit des Beginns der Gültigkeit des Preises",
                    read: true,
                    write: false
                },
                native: {}
            });

			await adapter.setObjectNotExistsAsync(stateBaseName + "startTimestamp", {
				type: "state",
				common: {
					name: "startTimestamp",
					type: "number",
					role: "value",
					desc: "Timestamp des Beginns der Gültigkeit des Preises",
					read: true,
					write: false
				},
				native: {}
			});

            await adapter.setObjectNotExistsAsync(stateBaseName + "startDate", {
                type: "state",
                common: {
                    name: "Gultigkeitsbeginn (Datum)",
                    type: "string",
                    role: "value",
                    desc: "Datum des Beginns der Gültigkeit des Preises",
                    read: true,
                    write: false
                },
                native: {}
            });

            await adapter.setObjectNotExistsAsync(stateBaseName + "end", {
                type: "state",
                common: {
                    name: "Gultigkeitsende (Uhrzeit)",
                    type: "string",
                    role: "value",
                    read: true,
                    write: false
                },
                native: {}
            });

			await adapter.setObjectNotExistsAsync(stateBaseName + "endTimestamp", {
				type: "state",
				common: {
					name: "endTimestamp",
					type: "number",
					role: "value",
					desc: "Timestamp des Endes der Gültigkeit des Preises",
					read: true,
					write: false
				},
				native: {}
			});

            await adapter.setObjectNotExistsAsync(stateBaseName + "endDate", {
                type: "state",
                common: {
                    name: "Gultigkeitsende (Datum)",
                    type: "string",
                    role: "value",
                    read: true,
                    write: false
                },
                native: {}
            });

            await adapter.setObjectNotExistsAsync(stateBaseName + "priceKwh", {
                type: "state",
                common: {
                    name: "Preis pro KWh (excl. MwSt.)",
                    type: "number",
                    role: "value",
                    unit: "Cent / KWh",
                    read: true,
                    write: false
                },
                native: {}
            });

            //calculate prices / timestamps
            let startTime = start.toLocaleTimeString('de-DE');
            let startDate = start.toLocaleDateString('de-DE');
            let endTime = end.toLocaleTimeString('de-DE');
            let endDate = end.toLocaleDateString('de-DE');
            let priceKwh = array[k].marketprice / 10; //price is in eur per MwH. Convert it in cent per KwH

            //write prices / timestamps to their data points
            await Promise.all(
                [adapter.setStateAsync(stateBaseName + "start", startTime, true)
                ,adapter.setStateAsync(stateBaseName + "startTimestamp", startTs, true)
                ,adapter.setStateAsync(stateBaseName + "startDate", startDate, true)
                ,adapter.setStateAsync(stateBaseName + "end", endTime, true)
				,adapter.setStateAsync(stateBaseName + "endTimestamp", endTs, true)
                ,adapter.setStateAsync(stateBaseName + "endDate", endDate, true)
                ,adapter.setStateAsync(stateBaseName + "priceKwh", priceKwh, true)
                ])
            j++;
        }

    }

    adapter.log.debug('all ordered prices written to their data points');

    setTimeout(function () {
        adapter.stop();
    }, 10000)
   
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}
