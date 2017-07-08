/**
{ frameId: 0, method: "GET", parentFrameId: -1, requestId: "172306", tabId: 340…}
frameId
:
0
method
:
"GET"
parentFrameId
:
-1
requestId
:
"172306"
tabId
:
340
timeStamp
:
1499484918518.229
type
:
"main_frame"
url
:
"http://so.gushiwen.org/guwen/bookv_964.aspx"}
 */

(function () {
    //组装参数
    var pubArgs = {}, viewData = {};
    pubArgs.latestChromeVersion = 58;
    pubArgs.limitedRecordNum = 300;
    pubArgs.sendMessageIntevel = 0;
    pubArgs.openedWinPopup = null;
    pubArgs.sendMessageBgToWinStatus = true;
    pubArgs.filters = {urls: ['http://*/*', 'https://*/*']};
    var urlPopup = '../../popup.html?version=' + chrome.app.getDetails().version;
    var urlOpenWin = 'about:blank';

    //点击 Gripper 图标操作
    chrome.browserAction.onClicked.addListener(function () {

        var userBrowserInfo = getBrowserInfo();

        if (!$.isEmptyObject(userBrowserInfo)) {
            var userBrowser = userBrowserInfo[0];
            var userBrowserVersion = parseInt(userBrowserInfo[1]);

            switch (userBrowser) {
                case 'Chrome':
                    if (userBrowserVersion < pubArgs.latestChromeVersion) {
                        alert('为了您更好的使用脚本录制器，建议您使用最新Chrome浏览器（58版本以上）');
                        return false;
                    } else {
                        //获取popup 窗口 ID，如果有则更新 popup 窗口并选中，反之新建 popup 窗口
                        if (pubArgs.openedWinPopup) {
                            chrome.windows.get(pubArgs.openedWinPopup, function (openWin) {
                                if (openWin) {
                                    chrome.windows.update(openWin.id, {focused : true})
                                } else {
                                    createWins();
                                }
                            })
                        } else {
                            createWins();
                        }
                    }
                    break;
                default:
                    break;
            }
        } else {
            alert('浏览器版本获取失败');
        }
    });

    //获取浏览器版本号
    function getBrowserInfo() {
        var ua = navigator.userAgent, tem,
            M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];

        if (/trident/i.test(M[1])) {
            tem =  /\brv[ :]+(\d+)/g.exec(ua) || [];
            return 'IE '+(tem[1] || '');
        }

        if (M[1] === 'Chrome') {
            tem = ua.match(/\b(OPR|Edge)\/(\d+)/);
            if(tem != null) return tem.slice(1).join('').replace('OPR', 'Opera');
        }

        M = M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];

        if ((tem = ua.match(/version\/(\d+)/i))!= null) M.splice(1, 1, tem[1]);
        return M;
    }

    //创建 popup 和 tab 页面
    function createWins() {
        //窗口参数
        var openWinArgs = {
            width : parseInt(window.screen.availWidth / 2),
            height : parseInt(window.screen.availHeight)
        };

        var createWinPopupData = {
            url: urlPopup,
            type: 'popup',
            left : 0,
            top : 0,
            width: openWinArgs.width,
            height: parseInt(openWinArgs.height/2)
        };

        var createWinTabData = {
            url: urlOpenWin,
            left : openWinArgs.width,
            top : 0,
            width: openWinArgs.width,
            height: openWinArgs.height
        };

        //创建2个新窗口
        chrome.windows.create(createWinPopupData, function (openWin) {
            pubArgs.openedWinPopup = openWin.id;
        });

        chrome.windows.create(createWinTabData, function (openWin) {
            pubArgs.openedWin = openWin.id;
        });
    }

    //建立通道
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        var actionType = message.actionType;
        var requestId = (message.dataId ? message.dataId : null);

        switch (actionType) {
            case 'start':
                startServer();
                break;

            case 'stop':
                stopServer();
                break;

            case 'clean' :
                cleanAllData();
                break;

            case 'delete':
                deleteDataById(requestId);
                break;

            default:
                alert('actionType is error');
                break;
        }

    });

    //绑定监听
    function httpAddListeners() {
        //获取 Request Info
        chrome.webRequest.onBeforeRequest.addListener(handleEvent('onBeforeRequest'), pubArgs.filters, ['requestBody']);

        //获取 Request Header
        chrome.webRequest.onBeforeSendHeaders.addListener(handleEvent('onBeforeSendHeaders'), pubArgs.filters, ['requestHeaders']);

        //获取 Response Header
        chrome.webRequest.onCompleted.addListener(handleEvent('onCompleted'), pubArgs.filters, ['responseHeaders']);

        //获取错误信息
        chrome.webRequest.onErrorOccurred.addListener(handleEvent('onErrorOccurred'), pubArgs.filters);
    }

    //解除绑定
    function httpRemoveListeners() {
        chrome.webRequest.onBeforeRequest.removeListener(handleEvent('onBeforeRequest'));
        chrome.webRequest.onBeforeSendHeaders.removeListener(handleEvent('onBeforeSendHeaders'));
        chrome.webRequest.onBeforeSendHeaders.removeListener(handleEvent('onCompleted'));
        chrome.webRequest.onBeforeSendHeaders.removeListener(handleEvent('onErrorOccurred'));
    }

    //根据请求类型组装数据
    function handleEvent(webRequestType) {
        var _fun = function (requestInfo) {
            var httpData = {
                url: requestInfo.url,
                method: requestInfo.method.toUpperCase(),
                requestId: requestInfo.requestId
            };

            switch (webRequestType) {
                case 'onBeforeRequest':
                    if (httpData.method === 'POST' && !$.isEmptyObject(requestInfo.requestBody.formData)) {
                        httpData.requestBody = requestInfo.requestBody;
                    }

                    setTimeout(function () {
                        buildData(httpData, 'requestBody');
                    }, pubArgs.sendMessageIntevel);
                    break;

                case 'onBeforeSendHeaders':
                    httpData.requestHeaders = requestInfo.requestHeaders;
                    setTimeout(function () {
                        buildData(httpData, 'requestHeaders');
                    }, pubArgs.sendMessageIntevel);
                    break;

                case 'onCompleted':
                    httpData.responseHeaders = requestInfo.responseHeaders;
                    setTimeout(function () {
                        buildData(httpData, 'responseHeaders');
                    }, pubArgs.sendMessageIntevel);
                    break;

                case 'onErrorOccurred':
                    httpData.responseHeaders = requestInfo.responseHeaders;
                    setTimeout(function () {
                        buildData(httpData, 'responseHeaders');
                    }, pubArgs.sendMessageIntevel);
                    break;
            }
        };

        return _fun;
    }


    //组建视图数据
    function buildData(httpData, sign) {
        if (pubArgs.sendMessageBgToWinStatus === true) {
            if (viewData[httpData.requestId]) {

                //避免重复填充 requestHeaders, 并填充至viewData[httpData.requestId][1]固定位置
                if ($.isEmptyObject(JSON.stringify(viewData[httpData.requestId][1]))) {

                    if (httpData.requestHeaders) {
                        viewData[httpData.requestId][1] = {requestHeaders: httpData.requestHeaders};
                    }
                }

                //避免重读填充 responseHeaders, 并填充至viewData[httpData.requestId][2]固定位置
                if ($.isEmptyObject(JSON.stringify(viewData[httpData.requestId][2]))) {

                    if (httpData.responseHeaders) {
                        viewData[httpData.requestId][2] = {responseHeaders: httpData.responseHeaders};
                    }
                }

            } else {
                viewData[httpData.requestId] = [httpData];
            }

            //当请求体 请求头 响应头 都组装完成后再把数据发送至 popup 页面
            if (sign === 'responseHeaders') {
                setTimeout(function () {
                    sendMessageBgToWin(viewData);
                }, pubArgs.sendMessageIntevel);
            }
        }

    }

    //将数据发送到 popup 页面
    function sendMessageBgToWin(data) {
        data = JSON.stringify(data) || {};

        if (pubArgs.sendMessageBgToWinStatus === true) {
            //录制条数限制，如果没超过限制条数则返回全量数据，否则把超出的数据清空并停止向发送数据
            if(Object.keys(viewData).length <= pubArgs.limitedRecordNum) {
                chrome.runtime.sendMessage({actionType: 'bgToWin', data: data, sign: 'underLimitedRecordNum'});
            } else {
                var i = 0;
                var tmpData = {};
                for (var key in viewData) {
                    i++;
                    if (i <= pubArgs.limitedRecordNum) {
                        tmpData[key] = viewData[key]
                    } else {
                        delete viewData[key];
                    }
                }
                data = JSON.stringify(tmpData);
                chrome.runtime.sendMessage({actionType: 'bgToWin', data: data, sign: 'overLimitedRecordNum'});
                pubArgs.sendMessageBgToWinStatus = false;
            }
        }
    }

    //启动服务
    function startServer() {
        //如果已录制的数据没有超过限制长度则开始录制，否则不开始录制并返回提示
        if(Object.keys(viewData).length <= pubArgs.limitedRecordNum) {
            pubArgs.sendMessageBgToWinStatus = true;
            pubArgs.startServer = true;
            httpAddListeners();
            setBadgeAndTitle('ON', '录制中');
        } else {
            pubArgs.sendMessageBgToWinStatus = false;
            pubArgs.isOverLimitedStatus = true;
            chrome.runtime.sendMessage({actionType: 'bgToWin', data: [], sign: 'overLimitedRecordNum'});
        }
    }

    //关闭服务
    function stopServer() {
        pubArgs.isStopServer = true;
        pubArgs.sendMessageBgToWinStatus = false;
        httpRemoveListeners();
        setBadgeAndTitle('OFF', '录制已停止');
    }

    //重置服务
    function resetServer() {
        pubArgs.sendMessageBgToWinStatus = false;
        viewData = {};
        httpRemoveListeners();
        setBadgeAndTitle();
    }

    //设置 badge 和 title
    function setBadgeAndTitle(badgeText, title) {
        badgeText = badgeText || '';
        title = title || 'Cloudwise Init';
        chrome.browserAction.setBadgeText({'text': badgeText});
        chrome.browserAction.setTitle({'title': title});
    }

    //根据请求 requestId 删除单条数据，如果抓取的数据小于限制条数则开启服务
    function deleteDataById(requestId) {
        if (requestId) {
            delete viewData[requestId];
            if (Object.keys(viewData).length <= pubArgs.limitedRecordNum) startServer();
        } else {
            return null;
        }
    }

    //清空所用数据
    function cleanAllData() {
        viewData = {};

        //如果已经停止则不再开始录制，否则如果超过限制条数则清空数据并开始录制
        if (pubArgs.isStopServer !== true) {
            pubArgs.sendMessageBgToWinStatus = true;
        } else if (pubArgs.isOverLimitedStatus === true) {
            pubArgs.sendMessageBgToWinStatus = true;
        }
        alert(pubArgs.sendMessageBgToWinStatus);
    }

    //关闭页面操作
    chrome.windows.onRemoved.addListener(function (closeWin) {
        //如果关闭的是 popup 页面则重置服务
        if (closeWin === pubArgs.openedWinPopup) {
            resetServer();
        }
    });

}());