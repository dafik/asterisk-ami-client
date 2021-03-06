"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Developer: Alex Voronyansky <belirafon@gmail.com>
 * Date: 27.04.2016
 * Time: 15:36
 */
const co = require("co");
const AmiClient_1 = require("../../lib/AmiClient");
co(function* () {
    const client = new AmiClient_1.default();
    yield client.connect("user", "secret", { host: "localhost", port: 5038 });
    client
        .on("connect", () => console.log("connect"))
        .on("event", (event) => console.log(event))
        .on("data", (chunk) => console.log(chunk))
        .on("response", (response) => console.log(response))
        .on("disconnect", () => console.log("disconnect"))
        .on("reconnection", () => console.log("reconnection"))
        .on("internalError", (error) => console.log(error))
        .action({
        Action: "Ping"
    });
    client.disconnect();
})
    .catch((error) => console.log(error));
//# sourceMappingURL=availableEvents.js.map