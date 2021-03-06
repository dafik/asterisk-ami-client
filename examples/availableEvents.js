"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Developer: Alex Voronyansky <belirafon@gmail.com>
 * Date: 27.04.2016
 * Time: 15:36
 */
const AmiClient_1 = require("../lib/AmiClient");
let client = new AmiClient_1.default();
client.connect("user", "secret", { host: "localhost", port: 5038 })
    .then((amiConnection) => {
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
    setTimeout(() => {
        client.disconnect();
    }, 5000);
})
    .catch((error) => console.log(error));
//# sourceMappingURL=availableEvents.js.map