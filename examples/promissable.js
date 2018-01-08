"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Developer: Alex Voronyansky <belirafon@gmail.com>
 * Date: 27.04.2016
 * Time: 15:36
 */
const AmiClient_1 = require("../lib/AmiClient");
const client = new AmiClient_1.default({ reconnect: true });
client.connect("username", "secret", { host: "127.0.0.1", port: 5038 })
    .then(() => {
    return client.action({ Action: "Ping" }, true);
})
    .then((response1) => {
    console.log(response1);
})
    .then(() => {
    return client.action({ Action: "Ping" }, true);
})
    .then((response2) => {
    console.log(response2);
})
    .catch((error) => error)
    .then((error) => {
    client.disconnect(); // disconnect
    if (error instanceof Error) {
        throw error;
    }
});
//# sourceMappingURL=promissable.js.map