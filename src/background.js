var requestSent = {},
    outputData = initOutputData(),
    isCapturing = false,
    idleIconPath = './icon.png',
    recordingIconPath = './icon-rec.png';

function initOutputData() {
    return {
        name: 'HttpMonitor Echo',
        description: 'Monitor all HTTP/HTTPs traffic from your browser.',
        public: true,
        generator: 'httpmonitor@lianzhi.com',
        version: '1.0',
        date: generateDate(),
        requests: []
    }
}

function generateDate()
{
    var x = new Date();
    var y = x.getFullYear();
    var m = x.getMonth()+1; m = m < 10 ? '0' + m : m;
    var d = x.getDate(); d = d < 10 ? '0' + d : d;
    var h = x.getHours(); h = h < 10 ? '0' + h : h;
    var i = x.getMinutes(); i = i < 10 ? '0' + i : i;
    var s = x.getSeconds(); s = s < 10 ? '0' + s : s;
    return [y, m, d, 'T', h, i, s].join('')
}

function resetSession() {
    requestSent = {};
    outputData = initOutputData();
}

function toggle(currentTab) {
    var target = {
        tabId: currentTab.id
    };

    if (!isCapturing) {
        startCapturing(target);
    } else {
        stopCapturing(target);
        exportSession();
    }
    resetSession();

    isCapturing = !isCapturing;
}
chrome.browserAction.onClicked.addListener(toggle);

function startCapturing(target) {
    chrome.debugger.attach(target, "1.0");
    chrome.debugger.sendCommand(target, "Network.enable");
    chrome.debugger.onEvent.addListener(onDebuggerEvent);
    chrome.browserAction.setIcon({
        path: recordingIconPath
    });
}

function stopCapturing(target) {
    chrome.debugger.detach(target);
    chrome.browserAction.setIcon({
        path: idleIconPath
    });
}

function onDebuggerEvent(debugee, message, params) {

    if (message == "Network.requestWillBeSent") {
        requestSent[params.requestId] = params.request;
    } else if (message == "Network.responseReceived") {
        chrome.debugger.sendCommand(debugee, "Network.getResponseBody", params, function(responseBody) {
            params.response.base64Encoded = responseBody.base64Encoded;
            params.response.body = responseBody.body;

            var request = requestSent[params.requestId];
            if (!request) return;
            outputData.requests.push(serializeRequest(params.type, request, params.response));
        });
    }
}

function serializeRequest(callType, request, response) {

    return {
        url: request.url,
        method: request.method,
        protocol: response.protocol,
        ip: response.remoteIPAddress,
        port: response.remotePort,
        mime: response.mimeType,
        callType: callType,
        status: response.status,
        statusText: response.statusText,
        base64Encoded: response.base64Encoded,
        requestHeaders: response.requestHeaders || {},
        postData: request.postData || "",
        responseHeaders: response.headers || {},
        // responseBody: response.body || "",
        timing: response.timing
    }
}

function exportSession() {
    if (outputData.requests.length < 1) return;
    outputData.date = generateDate();

    var blob = new Blob([JSON.stringify(outputData, null, 2)], {
        type: "text/plain;charset=utf-8"
    });

    var fileNameSuffix = outputData.date;
    saveAs(blob, "HttpMonitor" + fileNameSuffix + ".txt");
}