"use strict";
/**
 * Developer: BelirafoN
 * Date: 27.04.2016
 * Time: 15:37
 */
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("debug");
const events_1 = require("events");
const local_asterisk_ami_connector_1 = require("local-asterisk-ami-connector");
const debugLog = debug_1.default("AmiClient");
const debugError = debug_1.default("AmiClient:error");
/**
 * AmiClient class
 */
class AmiClient extends events_1.EventEmitter {
    static _genActionId(prefix) {
        prefix = prefix || "";
        return `${prefix}${Date.now()}`;
    }
    get specPrefix() {
        return this._specPrefix;
    }
    /**
     * Constructor
     */
    constructor(options) {
        super();
        this._connection = null;
        this._connectionOptions = {};
        this._connector = null;
        this._credentials = { user: null, secret: null };
        this._kaActionId = null;
        this._kaTimer = null;
        this._lastAction = null;
        this._options = Object.assign({ addTime: false, attemptsDelay: 1000, emitEventsByTypes: true, emitResponsesById: true, eventFilter: null, eventTypeToLowerCase: false, keepAlive: false, keepAliveDelay: 1000, maxAttemptsCount: 30, reconnect: false }, (options || {}));
        this._prEmitter = new events_1.EventEmitter();
        this._prPendingActions = {};
        this._specPrefix = "--spec_";
        this._userDisconnect = false;
        this._prepareOptions();
        this._connector = local_asterisk_ami_connector_1.default({
            attemptsDelay: this._options.attemptsDelay,
            maxAttemptsCount: this._options.maxAttemptsCount,
            reconnect: this._options.reconnect
        });
        this.on("disconnect", () => {
            Object.keys(this._prPendingActions).forEach((actionId) => {
                this._prEmitter.emit(`disconnect_${actionId}`);
                debugLog(`disconnect_${actionId}`);
            }, this);
        });
    }
    /**
     *
     * @param user
     * @param secret
     * @param options
     * @returns {Promise}
     */
    connect(user, secret, options) {
        this._credentials = { user, secret };
        this._connectionOptions = options || {};
        return this._connector.connect(user, secret, options)
            .then((amiConnection) => {
            this._connection = amiConnection;
            this._userDisconnect = false;
            this.emit("connect", this._connection);
            this._connection
                .on("event", (event) => {
                if (!this._eventIsAllow(event)) {
                    return;
                }
                if (this._options.addTime) {
                    event.$time = Date.now();
                }
                this.emit("event", event);
                if (this._options.emitEventsByTypes && event.Event) {
                    const eventName = this._options.eventTypeToLowerCase ?
                        event.Event.toLowerCase() : event.Event;
                    this.emit(eventName, event);
                }
            })
                .on("response", (response) => {
                if (this._options.keepAlive && response.ActionID === this._kaActionId) {
                    debugLog("keep-alive heart bit");
                    this._keepAliveBit();
                    return;
                }
                if (this._options.addTime) {
                    response.$time = Date.now();
                }
                if (response.ActionID) {
                    if (this._options.emitResponsesById) {
                        this.emit(`resp_${response.ActionID}`, response);
                    }
                    this._prEmitter.emit(`resp_${response.ActionID}`, response);
                    if (response.ActionID.startsWith(this._specPrefix)) {
                        delete response.ActionID;
                    }
                }
                this.emit("response", response);
            })
                .on("data", (chunk) => this.emit("data", chunk))
                .on("error", (error) => this.emit("internalError", error))
                .on("close", () => {
                clearTimeout(this._kaTimer);
                this.emit("disconnect");
                this._prEmitter.emit("disconnect");
                setTimeout(() => {
                    this._connection.removeAllListeners();
                    if (!this._userDisconnect && this._options.reconnect) {
                        this.emit("reconnection");
                        this.connect(this._credentials.user, this._credentials.secret, this._connectionOptions)
                            .catch((error) => this.emit("internalError", error));
                    }
                }, 1);
            });
            if (this._options.keepAlive) {
                this._keepAliveBit();
            }
            return this._connection;
        });
    }
    /**
     * Disconnect from Asterisk
     */
    disconnect() {
        this._userDisconnect = true;
        clearTimeout(this._kaTimer);
        this.emit("disconnect");
        if (this._connection) {
            this._connection.close();
            setTimeout(this._connection.removeAllListeners, 1);
        }
        return this;
    }
    action(message, promisable) {
        if (!this._connection) {
            throw new Error(`Call 'connect' method before.`);
        }
        this._lastAction = message;
        this.emit("action", message);
        if (!message.ActionID) {
            message.ActionID = AmiClient._genActionId(this._specPrefix);
        }
        if (promisable) {
            return this._promisable(message);
        }
        this._connection.write(message);
        return this;
    }
    write(message, promisable) {
        return this.action(message, promisable);
    }
    send(message, promisable) {
        return this.action(message, promisable);
    }
    option(name, value) {
        if (!Object.hasOwnProperty.call(this._options, name)) {
            return value === undefined ? undefined : false;
        }
        if (value !== undefined) {
            this._options[name] = value;
            this._prepareOptions();
            return true;
        }
        return this._options[name];
    }
    options(newOptions) {
        if (newOptions === undefined) {
            return this._options;
        }
        Object.keys(this._options).forEach((optionName) => {
            if (Object.hasOwnProperty.call(newOptions, optionName)) {
                this._options[optionName] = newOptions[optionName];
            }
        }, this);
        return this._prepareOptions();
    }
    /**
     * Keep-alive heart bit handler
     * @private
     */
    _keepAliveBit() {
        this._kaTimer = setTimeout(() => {
            if (this._options.keepAlive && this._connection && this.isConnected) {
                this._kaActionId = AmiClient._genActionId(this._specPrefix);
                this._connection.write({
                    Action: "Ping",
                    ActionID: this._kaActionId
                });
            }
        }, this._options.keepAliveDelay);
        this._kaTimer.unref();
        return this;
    }
    _prepareOptions() {
        if (this._options.eventFilter && !(this._options.eventFilter instanceof Set)) {
            let eventNames = this._options.eventFilter;
            if (!Array.isArray(eventNames)) {
                eventNames = Object.keys(this._options.eventFilter);
            }
            eventNames = eventNames.reduce((result, eventName) => {
                const name = eventName ? eventName.toString() : "";
                if (name) {
                    result.push(name.toLowerCase());
                }
                return result;
            }, []);
            this._options.eventFilter = new Set(eventNames);
        }
        return this;
    }
    /**
     *
     * @param event
     * @private
     */
    _eventIsAllow(event) {
        const eventName = event.Event ? event.Event.toLowerCase() : null;
        if (eventName && this._options.eventFilter) {
            return !this._options.eventFilter.has(eventName);
        }
        return true;
    }
    /**
     *
     * @param message
     * @private
     */
    _promisable(message) {
        return new Promise((resolve, reject) => {
            const resolveTimer = setTimeout(() => {
                reject(new Error("Timeout response came."));
            }, 10000);
            resolveTimer.unref();
            this._connection.write(message);
            this._prPendingActions[message.ActionID] = message;
            this._prEmitter
                .on(`resp_${message.ActionID}`, (response) => {
                clearTimeout(resolveTimer);
                resolve(response);
            })
                .on(`disconnect_${message.ActionID}`, () => {
                clearTimeout(resolveTimer);
                reject(new Error("Client disconnected."));
            });
        })
            .catch((error) => error)
            .then((response) => {
            this._prEmitter.removeAllListeners(`disconnect_${message.ActionID}`);
            this._prEmitter.removeAllListeners(`resp_${message.ActionID}`);
            delete this._prPendingActions[message.ActionID];
            if (response instanceof Error) {
                throw response;
            }
            return response;
        });
    }
    /**
     *
     * @returns {null}
     */
    get lastEvent() {
        return this._connection ? this._connection.lastEvent : null;
    }
    /**
     *
     * @returns {null}
     */
    get lastResponse() {
        const response = this._connection ? this._connection.lastResponse : null;
        if (response && response.ActionID && response.ActionID.startsWith(this._specPrefix)) {
            delete response.ActionID;
        }
        return response;
    }
    /**
     *
     * @returns {boolean}
     */
    get isConnected() {
        return this._connection ? this._connection.isConnected : null;
    }
    /**
     *
     * @returns {null}
     */
    get lastAction() {
        return this._lastAction;
    }
    /**
     *
     * @returns {T|*}
     */
    get connection() {
        return this._connection;
    }
}
exports.default = AmiClient;
//# sourceMappingURL=AmiClient.js.map