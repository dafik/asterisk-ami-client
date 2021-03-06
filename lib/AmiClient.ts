/**
 * Developer: BelirafoN
 * Date: 27.04.2016
 * Time: 15:37
 */

import debug from "debug";
import amiConnector from "dfi-asterisk-ami-connector";
import AmiConnection from "dfi-asterisk-ami-connector/lib/AmiConnection";
import {EventEmitter} from "events";
import {IAmiAction, IAmiClientOptions, IAmiConnectionOptions, IAmiEvent, IDfiAMIResponse} from "./Interfaces";

const debugLog = debug("AmiClient");

/**
 * AmiClient class
 */
class AmiClient extends EventEmitter {

    private static _genActionId(prefix: string): string {
        prefix = prefix || "";
        return `${prefix}${Date.now()}`;
    }

    private _options: IAmiClientOptions;

    private _connector: amiConnector;

    private _connection: AmiConnection;
    private _connectionOptions: any | {};

    private _credentials: { user: any; secret: any };

    private _lastAction: IAmiAction;

    private _userDisconnect: boolean;

    private _kaTimer: NodeJS.Timer;
    private _kaActionId: string;

    private _prEmitter: EventEmitter;
    private _prPendingActions;

    private _specPrefix: string;

    get specPrefix(): string {
        return this._specPrefix;
    }

    constructor(options?: IAmiClientOptions) {
        super();
        this._connection = null;
        this._connectionOptions = {};
        this._connector = null;
        this._credentials = {user: null, secret: null};
        this._kaActionId = null;
        this._kaTimer = null;
        this._lastAction = null;
        this._options = {
            addTime: false,
            attemptsDelay: 1000,
            emitEventsByTypes: true,
            emitResponsesById: true,
            eventFilter: null,
            eventTypeToLowerCase: false,
            keepAlive: false,
            keepAliveDelay: 1000,
            maxAttemptsCount: 30,
            reconnect: false,

            ...(options || {})
        };
        this._prEmitter = new EventEmitter();
        this._prPendingActions = {};
        this._specPrefix = "--spec_";
        this._userDisconnect = false;

        this._prepareOptions();
        this._connector = amiConnector({
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

    public connect(user: string, secret: string, options: IAmiConnectionOptions): Promise<AmiConnection> {
        this._credentials = {user, secret};
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
                                this.connect(
                                    this._credentials.user,
                                    this._credentials.secret,
                                    this._connectionOptions
                                )
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
    public disconnect(): this {
        this._userDisconnect = true;
        clearTimeout(this._kaTimer);
        this.emit("disconnect");
        if (this._connection) {
            this._connection.close();
            setTimeout(this._connection.removeAllListeners, 1);
        }
        return this;
    }

    public action(message: IAmiAction, promisable?: boolean): this | Promise<IDfiAMIResponse> {
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

    public write(message: IAmiAction, promisable?: boolean): this | Promise<IDfiAMIResponse> {
        return this.action(message, promisable);
    }

    public send(message: IAmiAction, promisable?: boolean): this | Promise<IDfiAMIResponse> {
        return this.action(message, promisable);
    }

    public option(name: string, value?: any): any {
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

    public options(newOptions?: IAmiClientOptions): this | IAmiClientOptions {
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
     */
    private _keepAliveBit(): this {
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

    private _prepareOptions(): this {
        if (this._options.eventFilter && !(this._options.eventFilter instanceof Set)) {
            let eventNames: string[] | {} = this._options.eventFilter;

            if (!Array.isArray(eventNames)) {
                eventNames = Object.keys(this._options.eventFilter);
            }
            eventNames = (eventNames as string[]).reduce((result, eventName) => {
                const name = eventName ? eventName.toString() : "";
                if (name) {
                    result.push(name.toLowerCase());
                }
                return result;
            }, []);
            this._options.eventFilter = new Set((eventNames as string[]));
        }
        return this;
    }

    private _eventIsAllow(event: IAmiEvent): boolean {
        const eventName = event.Event ? event.Event.toLowerCase() : null;

        if (eventName && this._options.eventFilter) {
            return !this._options.eventFilter.has(eventName);
        }
        return true;
    }

    private _promisable(message: IAmiAction): this | Promise<IDfiAMIResponse> {
        return new Promise((resolve, reject) => {
            const resolveTimer = setTimeout(() => {
                reject(new Error("Timeout response came."));
            }, 10000);
            resolveTimer.unref();

            this._connection.write(message, (err?: Error) => {
                if (err) {
                    reject(err);
                }
            });
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
        }).catch((response) => {
            this._prEmitter.removeAllListeners(`disconnect_${message.ActionID}`);
            this._prEmitter.removeAllListeners(`resp_${message.ActionID}`);
            delete this._prPendingActions[message.ActionID];
            if (response instanceof Error) {
                throw response;
            }
            return response;
        });
    }

    get lastEvent(): IAmiEvent {
        return this._connection ? this._connection.lastEvent : null;
    }

    get lastResponse(): IDfiAMIResponse {
        const response = this._connection ? this._connection.lastResponse : null;
        if (response && response.ActionID && response.ActionID.startsWith(this._specPrefix)) {
            delete response.ActionID;
        }
        return response;
    }

    get isConnected(): boolean {
        return this._connection ? this._connection.isConnected : false;
    }

    get lastAction(): IAmiAction {
        return this._lastAction;
    }

    get connection(): AmiConnection {
        return this._connection;
    }
}

export default AmiClient;
