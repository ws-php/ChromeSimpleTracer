var requestSent = {},
    outputData = [],
    isCapturing = false,
    idleIconPath = './icon.png',
    recordingIconPath = './icon-rec.png';

function resetSession() {
    requestSent = {};
    outputData = [];
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
            outputData.push(serializeRequest(request, params.response));
        });
    }
}

function serializeRequest(request, response) {

    return {
        url: request.url,
        method: request.method,
        protocol: response.protocol,
        ip: response.remoteIPAddress,
        port: response.remotePort,
        mime: response.mimeType,
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
    if (outputData.length < 1) return;
    var blob = new Blob([JSON.stringify(outputData, null, 2)], {
        type: "text/plain;charset=utf-8"
    });

    var fileNameSuffix = new Date().toISOString().replace(/:/g, "-");
    saveAs(blob, "SessionTraces" + fileNameSuffix + ".txt");
}