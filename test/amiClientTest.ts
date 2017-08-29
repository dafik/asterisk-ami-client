/**
 * Developer: Alex Voronyansky <belirafon@gmail.com>
 * Date: 27.04.2016
 * Time: 15:37
 */
import * as assert from "assert";
import debug from "debug";
import AmiConnection from "local-asterisk-ami-connector/lib/AmiConnection";
import amiUtils from "local-asterisk-ami-event-utils";
import AmiTestServer from "local-asterisk-ami-test-server";
import AmiClient from "../lib/AmiClient";
import {IAmiAction, IDfiAMIResponse} from "../lib/Interfaces";

const debugLog = debug("AmiClientTest");

const USERNAME = "test";
const SECRET = "test";

process.on("unhandledRejection", (reason, p) => {
    debugLog("Unhandled Rejection at: Promise", p, "reason:", reason);
    // application specific logging, throwing an error, or other logic here
});

const serverOptions = {

    credentials: {
        secret: SECRET,
        username: USERNAME
    },
    silent: true
};
const socketOptions = {
    host: "127.0.0.1",
    port: 5038
};

describe("Ami Client internal functionality", () => {

    let server: AmiTestServer = null;
    let client: AmiClient = null;

    afterEach((done) => {
        if (server instanceof AmiTestServer) {
            server.close();
            server.removeAllListeners();
            server = null;
        }
        if (client instanceof AmiClient) {
            client.disconnect();
            client = null;
        }
        setTimeout(done, 100);
    });

    describe("Regular connection with default configuration", () => {

        beforeEach((done) => {
            client = new AmiClient();
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions)
                .then(() => done())
                .catch((err) => {
                    done(err);
                });
        });

        it("Connect with correct credentials", (done) => {
            client.connect(USERNAME, SECRET, socketOptions)
                .then(() => done())
                .catch((err) => {
                    done(err);
                });
        });

        it("Connector returns instance of AmiConnection", (done) => {
            client.connect(USERNAME, SECRET, socketOptions)
                .then((amiConnection) => {
                    assert.ok(amiConnection instanceof AmiConnection);
                    done();
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Connect with invalid credentials", (done) => {
            client.connect("username", "secret", socketOptions)
                .catch((error) => {
                    assert.ok(error instanceof Error);
                    assert.equal("ami message: authentication failed", error.message.toLowerCase());
                    done();
                });
        });
    });

    describe("Reconnection functionality", () => {

        beforeEach(() => {
            server = new AmiTestServer(serverOptions);
        });

        it("Reconnection with correct credentials", (done) => {
            client = new AmiClient({
                reconnect: true
            });
            client.connect(USERNAME, SECRET, socketOptions)
                .then(() => {
                    done();
                })
                .catch((err) => {
                    done(err);
                });
            setTimeout(() => {
                server.listen(socketOptions);
            }, 1500);
        }).timeout(3000);

        it("Reconnection with invalid credentials", (done) => {
            client = new AmiClient({
                reconnect: true
            });
            client.connect("username", "secret", socketOptions).catch((error) => {
                assert.ok(error instanceof Error);
                assert.equal("ami message: authentication failed", error.message.toLowerCase());
                done();
            });
            setTimeout(() => {
                server.listen(socketOptions);
            }, 1000);
        });

        it("Limit of attempts of reconnection", (done) => {
            client = new AmiClient({

                maxAttemptsCount: 1,
                reconnect: true
            });
            client.connect(USERNAME, SECRET, socketOptions).catch((error) => {
                assert.ok(error instanceof Error);
                assert.equal("reconnection error after max count attempts.", error.message.toLowerCase());
                done();
            });
            setTimeout(() => {
                server.listen(socketOptions);
            }, 1500);
        });

        it("Ban for reconnection", (done) => {
            client = new AmiClient({
                reconnect: false
            });
            client.connect(USERNAME, SECRET, socketOptions).catch((error) => {
                assert.ok(error instanceof Error);
                assert.equal("connect ECONNREFUSED 127.0.0.1:5038", error.message);
                done();
            });
        });

        it("Reconnection after disconnect from Asterisk", (done) => {
            let wasDisconnect = false;
            let connectCounter = 0;

            client = new AmiClient({
                attemptsDelay: 1000,
                maxAttemptsCount: null,
                reconnect: true

            });
            client
                .on("disconnect", () => {
                    wasDisconnect = true;
                })
                .on("connect", () => {
                    if (++connectCounter === 2 && wasDisconnect) {
                        done();
                    }
                });

            server.listen(socketOptions)
                .then(() => {
                    client.connect(USERNAME, SECRET, socketOptions)
                        .then(() => {
                            server.close();
                            setTimeout(() => {
                                server.listen(socketOptions);
                            }, 1000);
                        })
                        .catch((err) => {
                            done(err);
                        });
                })
                .catch((err) => {
                    done(err);
                });
        });
    });

    describe("Last event/response/action", () => {

        beforeEach((done) => {
            client = new AmiClient();
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions)
                .then(() => done())
                .catch((err) => {
                    done(err);
                });
        });

        it("Get last Event after event", (done) => {
            const testEvent = {
                Event: "TestEvent",
                Value: "TestValue"
            };
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    server.broadcast(amiUtils.fromObject(testEvent));
                    client.once("event", (event) => {
                        assert.deepEqual(event, client.lastEvent);
                        done();
                    });
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Get last Event before event", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    assert.equal(null, client.lastEvent);
                    done();
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Get last Response after action", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    client.action({Action: "Ping"});
                    client.once("response", (response) => {
                        assert.equal(response.Response, "Success");
                        assert.equal(response.Ping, "Pong");
                        done();
                    });
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Get last Response before action", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    assert.equal(null, client.lastResponse);
                    done();
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Get last Action after action (without ActionID)", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    const testAction = {Action: "Ping"};
                    client.action(testAction);
                    assert.deepEqual(testAction, client.lastAction);
                    done();
                });
        });

        it("Get last Action after action (with ActionID)", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    const testAction = {
                        Action: "Ping",
                        ActionID: "1234567"
                    };
                    client.action(testAction);
                    assert.deepEqual(testAction, client.lastAction);
                    done();
                })
                .catch((err) => {
                    done(err);
                });

        });

        it("Get last Action before action", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    assert.equal(null, client.lastAction);
                    done();
                })
                .catch((err) => {
                    done(err);
                });
        });

    });

    describe("Client's events", () => {

        beforeEach((done) => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions)
                .then(() => done())
                .catch((err) => {
                    done(err);
                });
        });

        it("Connect event", (done) => {
            client.on("connect", () => done());
            client.connect(USERNAME, SECRET, {port: socketOptions.port});
        });

        it("Disconnect event", (done) => {
            client.once("disconnect", done);
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    setTimeout(server.close.bind(server), 100);
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Reconnect event", (done) => {
            client = new AmiClient({reconnect: true});
            client.once("reconnection", () => done());
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    server.close();
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Event event", (done) => {
            const testEvent = {
                Event: "TestEvent"
            };

            client.on("event", (event) => {
                assert.deepEqual(event, testEvent);
                done();
            });

            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    server.broadcast(amiUtils.fromObject(testEvent));
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Event by event's type", (done) => {
            const testEvent = {
                Event: "TestEvent"
            };

            client.on("TestEvent", (event) => {
                assert.deepEqual(event, testEvent);
                done();
            });

            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    server.broadcast(amiUtils.fromObject(testEvent));
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Response event", (done) => {
            client.on("response", (response) => {
                assert(response.Response, "Success");
                assert(response.Ping, "Pong");
                done();
            });

            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    client.action({Action: "Ping"});
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Response event by ActionID", (done) => {
            client.on("resp_1234567", (response) => {
                assert(response.Response, "Success");
                assert(response.Ping, "Pong");
                done();
            });

            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    client.action({
                        Action: "Ping",
                        ActionID: "1234567"
                    });
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Data event", (done) => {
            const testChunk = amiUtils.fromString("test chunk");
            client.once("data", (chunk) => {
                assert.equal(chunk.toString(), testChunk);
                done();
            });

            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    server.broadcast(testChunk);
                })
                .catch((err) => {
                    done(err);
                });
        });

    });

    describe("Action-method and aliases", () => {

        beforeEach((done) => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions)
                .then(() => done())
                .catch((err) => {
                    done(err);
                });
        });

        it("Call action before connection => exception", () => {
            assert.throws(() => {
                client.action({Action: "Ping"});
            }, (error) => {
                assert.ok(error instanceof Error);
                assert.equal(`Call 'connect' method before.`, error.message);
                return true;
            });
        });

        it("Write is a alias of action", (done) => {
            const originalAction = client.action;
            const testAction = {Action: "Ping"};

            client.action = (message: IAmiAction): AmiClient | Promise<IDfiAMIResponse> => {
                client.action = originalAction;

                assert.deepEqual(testAction, message);
                done();
                return;
            };
            client.write(testAction);
        });

        it("Send is a alias of action", (done) => {
            const originalAction = client.action;
            const testAction = {Action: "Ping"};

            client.action = (message: IAmiAction): AmiClient | Promise<IDfiAMIResponse> => {
                client.action = originalAction;

                assert.deepEqual(testAction, message);
                done();
                return;
            };
            client.send(testAction);
        });

        it("Action is promisable", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    const promise: Promise<IDfiAMIResponse> = (client.action({Action: "Ping"}, true) as Promise<IDfiAMIResponse>);
                    promise
                        .then(() => {
                            done();
                        })
                        .catch((err) => {
                            done(err);
                        });
                    assert.ok(promise instanceof Promise);
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Resolving promisable action with ActionID", (done) => {
            const action = {
                Action: "Ping",
                ActionID: "1234567"
            };

            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    (client.action(action, true) as Promise<{}>)
                        .then((response) => {
                            delete (response as { Timestamp: any }).Timestamp;
                            assert.deepEqual({
                                ActionID: action.ActionID,
                                Ping: "Pong",
                                Response: "Success"
                            }, response);
                            done();
                        })
                        .catch((err) => {
                            done(err);
                        });
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Resolving promisable action without ActionID", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    ( client.action({Action: "Ping"}, true)   as Promise<{}>)
                        .then((response) => {
                            delete (response as { Timestamp: any }).Timestamp;
                            assert.deepEqual({
                                Ping: "Pong",
                                Response: "Success"
                            }, response);
                            done();
                        })
                        .catch((err) => {
                            done(err);
                        });
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Last response not have $time field after resolving promisable action without ActionID", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    (client.action({Action: "Ping"}, true) as Promise<{}>)
                        .then(() => {
                            assert.ok(client.lastResponse.$time === undefined);
                            done();
                        })
                        .catch((err) => {
                            done(err);
                        });
                })
                .catch((err) => {
                    done(err);
                });
        });

    });

    describe("Client's configuration", () => {

        beforeEach((done) => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions)
                .then(() => done())
                .catch((err) => {
                    done(err);
                });
        });

        it("Get all options of client", () => {
            assert.deepEqual(client.options(), {
                addTime: false,
                attemptsDelay: 1000,
                emitEventsByTypes: true,
                emitResponsesById: true,
                eventFilter: null,
                eventTypeToLowerCase: false,
                keepAlive: false,
                keepAliveDelay: 1000,
                maxAttemptsCount: 30,
                reconnect: false
            });
        });

        it("Set all options of client", () => {
            const newOptions = {
                addTime: true,
                attemptsDelay: 5000,
                emitEventsByTypes: false,
                emitResponsesById: false,
                eventFilter: new Set(["Dial"]),
                eventTypeToLowerCase: true,
                keepAlive: true,
                keepAliveDelay: 5000,
                maxAttemptsCount: 5,
                reconnect: true
            };

            client.options({...newOptions, undefinedOption: "testValue"});
            assert.deepEqual(client.options(), newOptions);
        });

        it("Get value of exists option", () => {
            assert.equal(client.option("maxAttemptsCount"), 30);
        });

        it("Get value of not exists option", () => {
            assert.equal(client.option("notExistsOption"), undefined);
        });

        it("Set value for exists option", () => {
            const optionName = "maxAttemptsCount";
            const result = client.option(optionName, 1);
            assert.equal(client.option(optionName), 1);
            assert.equal(result, true);
        });

        it("Set value for not exists option", () => {
            const result = client.option("notExistsOption", 1);
            assert.equal(result, false);
        });

        it("Set event filter from array", () => {
            const eventNames = ["Dial", "Hangup", "Dial"];
            client.option("eventFilter", eventNames);
            assert.ok(client.option("eventFilter") instanceof Set);
            assert.deepEqual(
                Array.from(client.option("eventFilter")),
                Array.from(new Set(eventNames)).map((name) => name.toLowerCase())
            );
        });

        it("Set event filter from object", () => {
            const eventNames = {
                Dial: 1,
                Hangup: 1
            };
            client.option("eventFilter", eventNames);
            assert.ok(client.option("eventFilter") instanceof Set);
            assert.deepEqual(
                Array.from(client.option("eventFilter")),
                Object.keys(eventNames).map((name) => name.toLowerCase())
            );
        });

        it("Set event filter from Set", () => {
            const eventNames = new Set(["Dial", "Hangup", "Dial"]);
            client.option("eventFilter", eventNames);
            assert.deepEqual(client.option("eventFilter"), eventNames);
        });

        it("Event not have $time field", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    client.on("event", (event) => {
                        assert.ok(event.$time === undefined);
                        done();
                    });
                    server.broadcast(amiUtils.fromObject({Event: "TestEvent"}));
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Response not have $time field", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    client
                        .on("response", (response) => {
                            assert.ok(response.$time === undefined);
                            done();
                        })
                        .action({Action: "Ping"});
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Event has $time field", (done) => {
            client = new AmiClient({addTime: true});
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    client.once("event", (event) => {
                        assert.ok(/^\d{13}$/.test(event.$time));
                        done();
                    });
                    server.broadcast(amiUtils.fromObject({Event: "TestEvent"}));
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Response has $time field", (done) => {
            client = new AmiClient({addTime: true});
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    client.once("response", (response) => {
                        assert.ok(/^\d{13}$/.test(response.$time));
                        done();
                    })
                        .action({Action: "Ping"});
                })
                .catch((err) => {
                    done(err);
                });
        });

    });

    describe("Connection state", () => {

        beforeEach((done) => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions)
                .then(() => done())
                .catch((err) => {
                    done(err);
                });
        });

        it('State of AmiConnection before connect is "disconnected"', () => {
            assert.equal(client.connection, null);
        });

        it('State of AmiConnection after connect is "connected"', (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    assert.ok(client.connection instanceof AmiConnection);
                    done();
                })
                .catch((err) => {
                    done(err);
                });
        });

        it('State of connection before connect is "disconnected"', () => {
            assert.ok(!client.isConnected);
        });

        it('State of connection after connect is "connected"', (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    assert.ok(client.isConnected);
                    done();
                })
                .catch((err) => {
                    done(err);
                });
        });

        it('State of connection after disconnect is "disconnected"', (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    server.close();
                    setTimeout(() => {
                        assert.ok(!client.isConnected);
                        done();
                    }, 100);
                })
                .catch((err) => {
                    done(err);
                });
        });

    });

    describe("Event filtering", () => {

        beforeEach((done) => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions)
                .then(() => done())
                .catch((err) => {
                    done(err);
                });
        });

        it("Filter is disabled", (done) => {
            const srcEvents = [
                {Event: "Test1", Value: "TestValue1"},
                {Event: "Test2", Value: "TestValue2"}
            ];
            const controlEvents = [];

            assert.equal(null, client.option("eventFilter"));
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    client
                        .on("event", (event) => {
                            controlEvents.push(event);
                        })
                        .on("response", () => {
                            assert.deepEqual(controlEvents, [
                                {Event: "Test1", Value: "TestValue1"},
                                {Event: "Test2", Value: "TestValue2"}
                            ]);
                            done();
                        });

                    srcEvents.forEach((event) => {
                        server.broadcast(amiUtils.fromObject(event));
                    });
                    server.broadcast(amiUtils.fromObject({
                        Response: "Success"
                    }));
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("Filter is enabled", (done) => {
            const srcEvents = [
                {Event: "Test1", Value: "TestValue1"},
                {Event: "Test2", Value: "TestValue2"}
            ];
            const controlEvents = [];

            client.option("eventFilter", ["Test1"]);
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    client
                        .on("event", (event) => {
                            controlEvents.push(event);
                        })
                        .on("response", () => {
                            assert.deepEqual(controlEvents, [
                                {Event: "Test2", Value: "TestValue2"}
                            ]);
                            done();
                        });

                    srcEvents.forEach((event) => {
                        server.broadcast(amiUtils.fromObject(event));
                    });
                    server.broadcast(amiUtils.fromObject({
                        Response: "Success"
                    }));
                })
                .catch((err) => {
                    done(err);
                });
        });

    });

    describe("Keep-alive", () => {

        beforeEach((done) => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions)
                .then(() => done())
                .catch((err) => {
                    done(err);
                });
        });

        it("keep-alive is disabled", (done) => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    const clientEventsStream = server.getAuthClients()[0]._eventStream;
                    const timeout = setTimeout(() => {
                        clientEventsStream.removeAllListeners("amiAction");
                        done();
                    }, 2000);

                    clientEventsStream.on("amiAction", (action) => {
                        if (action.Action === "Ping") {
                            clearTimeout(timeout);
                        }
                    });
                })
                .catch((err) => {
                    done(err);
                });
        }).timeout(3000);

        it("keep-alive is enabled", (done) => {
            client = new AmiClient({
                keepAlive: true,
                keepAliveDelay: 100
            });
            client.connect(USERNAME, SECRET, {port: socketOptions.port})
                .then(() => {
                    const clientEventsStream = server.getAuthClients()[0]._eventStream;
                    clientEventsStream.on("amiAction", (action) => {
                        if (action.Action === "Ping") {
                            assert.ok(action.ActionID.startsWith(client.specPrefix));
                            clientEventsStream.removeAllListeners("amiAction");
                            done();
                        }
                    });
                })
                .catch((err) => {
                    done(err);
                });
        });

    });

});
