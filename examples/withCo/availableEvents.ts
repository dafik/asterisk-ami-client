/**
 * Developer: Alex Voronyansky <belirafon@gmail.com>
 * Date: 27.04.2016
 * Time: 15:36
 */
import * as co from "co";
import AmiClient from "../../lib/AmiClient";

co(function*() {
    const client = new AmiClient();

    yield client.connect("user", "secret", {host: "localhost", port: 5038});

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
