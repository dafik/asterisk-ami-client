/**
 * Developer: Alex Voronyansky <belirafon@gmail.com>
 * Date: 27.04.2016
 * Time: 15:36
 */
import * as co from "co";
import AmiClient from "../../lib/AmiClient";

const client = new AmiClient({reconnect: true});

co(function*() {
    yield client.connect("username", "secret", {host: "127.0.0.1", port: 5038});

    const response1 = yield client.action({Action: "Ping"}, true);
    console.log(response1);

    const response2 = yield client.action({Action: "Ping"}, true);
    console.log(response2);

    client.disconnect();
}).catch((error) => console.log(error));
