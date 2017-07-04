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
        date: '',
        requests: []
    }
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
    outputData.date = new Date().toISOString()

    var blob = new Blob([JSON.stringify(outputData, null, 2)], {
        type: "text/plain;charset=utf-8"
    });

    var fileNameSuffix = outputData.date.replace(/:/g, "-");
    saveAs(blob, "HttpMonitor" + fileNameSuffix + ".txt");
}