import registerWebworker from 'webworker-promise/lib/register';
/*
registerWebworker(async function (message, emit) {
    return new Promise((resolve, reject) => {
        console.log(message);
        fetchBinary('http://localhost:8888/data/visualize_data/head-binary-zlib.vti')
            .then(res => {
                resolve(res);
            })
            .catch(err => {
                console.log(err);
            })
    })

})

function fetchBinary(url, options = {}) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.onreadystatechange = (e) => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 0) {
                    resolve(xhr.response);
                } else {
                    reject({ xhr, e });
                }
            }
        };

        if (options && options.progressCallback) {
            xhr.addEventListener('progress', options.progressCallback);
        }

        // Make request
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.send();
    });
}
*/

let ws;

registerWebworker(async function (message, emit) {
    return new Promise((resolve, reject) => {

        if (message.init) {
            console.log('Creating socket');
            ws = new WebSocket('ws://localhost:8888/');
            ws.binaryType='arraybuffer';
            ws.onopen = function () {
                console.log('Socket open.');
            }
        }

        ws.onclose = function () {
            console.log('Socket close.');
        }

        ws.onerror = function (event) {
            console.error("WebSocket error observed:", event);
        };

        if (message.data) {
            let data = JSON.stringify(message.data);
            console.log("////////", data);
            ws.send(data);
        }

        ws.onmessage = function (message) {
            let arrayBuffer=message.data;
            console.log('Socket server message', arrayBuffer);
            resolve(new registerWebworker.TransferableResponse(arrayBuffer, [arrayBuffer]));
        };

    })
})