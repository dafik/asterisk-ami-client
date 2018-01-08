"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Developer: Alex Voronyansky <belirafon@gmail.com>
 * Date: 27.04.2016
 * Time: 15:36
 */
const AmiClient_1 = require("../lib/AmiClient");
let client = new AmiClient_1.default({
    reconnect: true,
    keepAlive: true
});
client.connect("user", "secret", { host: "localhost", port: 5038 })
    .then(() => {
    client
        .on("event", (event) => console.log(event))
        .on("response", (response) => {
        console.log(response);
        client.disconnect();
    })
        .on("internalError", (error) => console.log(error));
    client.action({ Action: "Ping" });
})
    .catch((error) => console.log(error));
//# sourceMappingURL=baseUsage.js.map