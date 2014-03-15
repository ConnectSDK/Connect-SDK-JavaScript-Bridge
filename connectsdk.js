var connectsdk = {};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Mixins

// Event emitter
var SimpleEventEmitter = {
    addListener: function (event, callback, context) {
        if (!event) { throw new Error("missing parameter: event"); }
        if (!callback) { throw new Error("missing parameter: callback"); }

        this._listeners = this._listeners || {};
        if (!this._listeners) this._listeners = {};
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push({callback: callback, context: context});
        
        this.emit("_addListener", event);
               
        return this;
    },

    removeListener: function (event, callback, context) {
        if (this._listeners && this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(function (l) {
                return (callback && callback !== l.callback) && (context && context !== l.context);
            });
        }
        
        this.emit("_removeListener", event);
               
        return this;
    },
    
    hasListeners: function (event) {
        if (event) {
            return (this._listeners && this._listeners[event] && this._listeners[event].length > 0);
        } else {
            for (event in this._listeners) {
                if (event[0] !== "_" && this._listeners.hasOwnProperty(event) && this._listeners[event].length > 0) {
                    return true;
                }
            }
            return false;
        }
    },
    
    emit: function (event) {
        var listeners = this._listeners && this._listeners[event];
        var args = Array.prototype.slice.call(arguments, 1);

        if (listeners) {
            listeners.forEach(function (l) {
                l.callback.apply(l.context || null, args);
            });
        }

        if (this["on" + event]) {
            this["on" + event].apply(null, args);
        }
    },

    on: function (event, callback, context) {
        return this.addListener(event, callback, context);
    },

    off: function (event, callback, context) {
        return this.removeListener(event, callback, context);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// connectsdk.ConnectManager

connectsdk.ConnectManager = createClass({
    mixins: [SimpleEventEmitter],

    statics: {
        PlatformType: {
            DEFAULT: "Default",
            GOOGLE_CAST: "GoogleCast",
            WEBOS_NATIVE: "WebOSNative",
            WEBOS_WEB_APP: "WebOSWebApp"
        },

        EventType: {
            PLAY: "play",
            PAUSE: "pause",
            STOP: "stop",
            MESSAGE: "message"
        }
    },

    mediaEvents: {
        loadStart: "buffering",
        playing: "playing",
        waiting: "buffering",
        ended: "finished",
        play: "playing",
        pause: "paused"
    },

    constructor: function () {
        extend(this, connectsdk.platforms[this._detectPlatform()]);
    },

    registerMediaElement: function (element) {
        // Unregister existing media element
        this.mediaElement && this.unregisterMediaEvents(this.mediaElement);

        // Register new media element
        if (element) {
            this.registerMediaEvents(element);
            this.mediaElement = element;
            this.setMediaStatus("idle");
        }
    },

    registerMediaEvents: function () {
        if (element) {
            for (var key in this.mediaEvents) {
                this.mediaEvents.hasOwnProperty(key) && element.addEventListener(key, )
            }
        }
    },

    unregisterMediaEvents: function () {
        if (element) {
            for (var key in this.mediaEvents) {
                this.mediaEvents.hasOwnProperty(key) && element.addEventListener(key,)
            }
        }
    },

    handleMediaEvent: function (evt) {
        this.mediaEvents.hasOwnProperty(evt.type) && this.setMediaStatus(this.mediaEvents[evt.type]);
    },

    registerImageElement: function (element) {
        this.imageElement = element;
    },

    setMediaStatus: function (status) {
        this.mediaStatus = status;
        this.emit("mediaStatusUpdate");
    },

    init: function () {
        if (this.platformType == connectsdk.ConnectManager.PlatformType.GOOGLE_CAST)
            this._initCastService();
        else if (this.platformType == connectsdk.ConnectManager.PlatformType.WEBOS_NATIVE || this.platformType == connectsdk.ConnectManager.PlatformType.WEBOS_WEB_APP)
            this._initWebOSService();
    },

    _detectPlatform: function () {
        // Default platform
        this.platformType = this.PlatformType.DEFAULT;

        if (navigator.userAgent.indexOf("CrKey") > 0 && cast != null) {
            this.platformType = connectsdk.ConnectManager.PlatformType.GOOGLE_CAST;
        } else if (window.PalmSystem) {
            if (window.PalmServiceBridge) {
                this.platformType = connectsdk.ConnectManager.PlatformType.WEBOS_NATIVE;
            } else {
                this.platformType = connectsdk.ConnectManager.PlatformType.WEBOS_WEB_APP;
            }
        }
        return this.platformType;
    }
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Platforms

(typeof connectsdk.platforms != "object") && (connectsdk.platforms = {});

// Default
connectsdk.platforms.Default = {
    init: nop,
    sendMessage: nop
};

// webOS
// In a closure to not pollute the global namespace.
(function () {
    var WebOSCommon = {
        init: function () {
            window.addEventListener("keydown", this.onKeyDown(this));

            this.webOSAppChannels = new connectsdk.WebOSAppChannels();
            this.webOSAppChannels.connectManager = this;

            this.webOSAppChannels.on('message', this.onMessage.bind(this));

            this.webOSAppChannels.on('ready', this.onReady.bind(this));

            this.webOSAppChannels.start();

            var mediaType = getParameterByName('mediaType');
            var mediaURL = getParameterByName('target');
            var mimeType = getParameterByName('mimeType');
            var title = getParameterByName('title');
            var description = getParameterByName('description');
            var iconSrc = getParameterByName('iconSrc');
            var shouldLoop = getParameterByName('shouldLoop') == 'true';

            if (mediaType == 'video')
            {
                console.log('test');
                this.videoElement.src = mediaURL;
                console.log(this.videoElement);
                console.log(this.videoElement.src);
            }
        },

        onKeyDown: function (evt) {
            switch (evt.keyCode)
            {
            case 415: // PLAY
                console.log(this.name + " :: play command received");
                this.videoElement.play();
                this.emit(connectsdk.ConnectManager.EventType.PLAY);
                break;

            case 19: // PAUSE
                console.log(this.name + " :: pause command received");
                this.videoElement.pause();
                this.emit(connectsdk.ConnectManager.EventType.PAUSE);
                break;

            case 413: // STOP
                console.log(this.name + " :: stop command received");
                this.emit(connectsdk.ConnectManager.EventType.STOP);
                break;
            }
        },

        onReady: function (evt) {
            this.emit("ready");
        },

        onMessage: function (message) {
            this.emit("message", message);
        },

        sendMessage: function (message) {
            var messageJSON;

            try {
                JSON.parse(message);
                messageJSON = message;
            } catch (ex) {
                messageJSON = { message: message };
            }

            this.webOSAppChannels.sendMessage(messageJSON);
        }
    };

    connectsdk.platforms.WebOSNative = extend({
        name: "webOS Native Web App"
    }, WebOSCommon);

    connectsdk.platforms.WebOSWebApp = extend({
        name: "webOS Web App"
    }, WebOSCommon);
})();

// Google Cast
connectsdk.platforms.GoogleCast = {
    name: "Google Cast",
    init: function () {
        if (this.videoElement)
        {
            console.log('registering video element ' + this.videoElement);
            window.castMediaManager = new cast.receiver.MediaManager(this.videoElement);
        }

        window.castReceiverManager = cast.receiver.CastReceiverManager.getInstance();

        window.castMessageBus = window.castReceiverManager.getCastMessageBus("urn:x-cast:com.connectsdk");
        window.castMessageBus.addEventListener("message", this.onMessage.bind(this));

        window.castReceiverManager.addEventListener("ready", this.onReady.bind(this));

        window.castReceiverManager.start();
    },

    onReady: function (evt) {
        this.emit('ready');
    },

    onMessage: function (evt) {
        var message;
        try {
            message = JSON.parse(evt.data);
        } catch (ex) {
            message = evt.data;
        }

        this.emit("message", message);
    },

    sendMessage: function (message) {
        var messageString;

        try {
            messageString = JSON.stringify(message);
        } catch (ex) {
            messageString = message;
        }

        window.castMessageBus.broadcast(messageString);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// connectsdk.WebOSAppChannels

connectsdk.WebOSAppChannels = createClass({
    mixins: [SimpleEventEmitter],

    stopRequested: false,
    ws: null,
    channels: [],

    constructor: function() {
        if (window.PalmServiceBridge) {
            var statusSubscription;
            var getChannelRequest;

            var GATEWAY_SERVICE = "com.webos.service.secondscreen.gateway";
            var CREATE_APPCHANNEL_URI = "luna://com.webos.service.secondscreen.gateway/app2app/createAppChannel";
            var REGISTER_SERVER_STATUS_URI = "luna://com.palm.bus/signal/registerServerStatus";

            var callService = function (uri, params, callback) {
                var request = new window.PalmServiceBridge();

                request.onservicecallback = function (responseString) {
                    callback(JSON.parse(responseString));
                };

                request.call(uri, JSON.stringify(params || {}));

                return request;
            };

            this.getAppChannelWebSocket = function (callback) {
                statusSubcription = callService(REGISTER_SERVER_STATUS_URI, {
                    "subscribe": true, serviceName: GATEWAY_SERVICE
                }, function (response) {
                    if (response && response.connected) {
                        getChannelRequest = callService(CREATE_APPCHANNEL_URI, {}, function (response) {
                            if (response.socketUrl) {
                                callback(new WebSocket(response.socketUrl));
                            }
                        });
                    }
                });
            };
        } else {
            // Look for "webOSAppChannelSocketUrl" parameter
            if (window.location.search) {
                console.log("found params: ", window.location.search);
                /**
                 * @author <a href="mailto:doctor.hogart@gmail.com">Konstantin Kitmanov</a>
                 * May be freely distributed under the MIT license.
                 */
                var parse = function (str) {
                    var chunks = str.split('&'),
                        dict = {},
                        chunk;
                    for (var i = 0, len = chunks.length; i < len; i++) {
                        chunk = chunks[i].split('=');
                        dict[chunk[0]] = decodeURIComponent(chunk[1]);
                    }

                    return dict;
                };

                var parsed = parse(window.location.search.substr(1));

                if (parsed.webOSAppChannelSocketUrl) {
                    console.log("found websocket URL: ", parsed.webOSAppChannelSocketUrl);

                    this.getAppChannelWebSocket = function (callback) {
                        console.log("opened websocket connection")
                        callback(new WebSocket(parsed.webOSAppChannelSocketUrl));
                    };
                }
            }
        }
    },

    getAppChannelWebSocket: function (callback) {
        console.error("app channel socket not supported");
    },

    sendMessage: function(message) {
        var messageData = {
            type: "p2p",
            payload: message
        };

        this._send(messageData);
    },

    _send: function (message) {
        if (this.ws && message) {
            console.log("sending message: ", message);
            this.ws.send(JSON.stringify(message));
        }
    },

    _destroy: function () {
        if (this.ws) {
            this.ws = null;
        }
    },

    start: function () {
        stopRequested = false;
        var self = this;

        this.getAppChannelWebSocket(function (socket) {
            if (stopRequested) {
                self.stop();
                return;
            }

            self.ws = socket;

            self.ws.onopen = function (event) {
                self.connectManager.on('videoStatusUpdate', self._handleVideoStatusUpdate, self);
                self.emit('ready', event);
            };

            self.ws.onmessage = function (event) {
                var message = JSON.parse(event.data);
                var payload = message.payload;

                console.log("got message: " + JSON.stringify(message));

                if (message.type === "p2p") {
                    if (typeof payload !== 'undefined') {
                        self._processP2PMessage(message);
                    }
                } else if (message.type === "p2p.join-request") {
                    self._send({
                        type: "p2p.join-response",
                        payload: {
                            allowJoin: true,
                            requestId: payload.requestId
                        }
                    });
                } else if (message.type === "p2p.join") {
                    self.emit("join", {client: payload && payload.client});
                } else if (message.type === "p2p.depart") {
                    self.emit("depart", {client: payload && payload.client});
                }
            };

            self.ws.onclose = function () {
                self.ws = null;
            };
        });
    },

    stop: function () {
        this.stopRequested = true;

        if (this.ws) {
            this.connectManager.off('videoStatusUpdate');
            this.ws.close();
        }

        this._destroy();
    },

    _handleVideoStatusUpdate: function() {
        var playState = this.connectManager.videoElementStatus;
        var currentTime = 0;
        var duration = 0;

        if (this.connectManager.videoElement)
        {
            currentTime = this.connectManager.videoElement.currentTime;

            if (this.connectManager.videoElement.duration != NaN)
                duration = this.connectManager.videoElement.duration
        }

        if (playState == null)
            return;

        this.sendMessage({
                    contentType: 'mediaEvent',
                    mediaEvent: {
                        type: 'playState',
                        playState: playState,
                        position: currentTime,
                        duration: duration
                    }
                });
    },

    _processP2PMessage: function(message) {
        console.log('processing message payload ' + JSON.stringify(message.payload));
        var contentType = message.payload.contentType;
        var from = message.from;

        if (contentType === 'mediaCommand')
        {
            console.log('processing mediaCommand ' + JSON.stringify(message.payload.mediaCommand) + ' of type ' + message.payload.mediaCommand.type);

            var commandType = message.payload.mediaCommand.type;
            var requestId = message.payload.mediaCommand.requestId;
            var videoElement = this.connectManager.videoElement;

            if (commandType === 'seek')
            {
                var position = message.payload.mediaCommand.position;

                if (position)
                {
                    videoElement.currentTime = position;
                    this._handleVideoStatusUpdate();
                }
            }
            else if (commandType === 'getPosition')
            {
                this._send({
                            type: 'p2p',
                            to: from,
                            payload: {
                                contentType: 'mediaCommandResponse',
                                mediaCommandResponse: {
                                    type: commandType,
                                    position: videoElement.currentTime,
                                    requestId:requestId
                                }
                            }
                        });
            } else if (commandType === 'getDuration')
            {
                this._send({
                            type: 'p2p',
                            to: from,
                            payload: {
                                contentType: 'mediaCommandResponse',
                                mediaCommandResponse: {
                                    type: commandType,
                                    duration: videoElement.duration,
                                    requestId:requestId
                                }
                            }
                        });
            } else if (commandType === 'getPlayState')
            {

            }
        } else
        {
            this.emit('message', message.payload);
        }
    }
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Helpers

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// very simple class maker
function createClass(desc) {
    var constructor;

    if (desc.constructor) {
        constructor = desc.constructor;
        delete desc.constructor;
    } else {
        constructor = function () {};
        throw new Error("no constructor");
    }

    var prototype = constructor.prototype;

    if (desc.mixins) {
        desc.mixins.forEach(function (mixin) {
            extend(prototype, mixin);
        });
        delete desc.mixins;
    }

    if (desc.statics) {
        extend(constructor, desc.statics);
        delete desc.statics;
    }

    extend(prototype, desc);
    return constructor;
}

function extend(a, b) {
    for (var key in b) {
        if (b.hasOwnProperty(key)) {
            a[key] = b[key]
        }
    }
    return a;
}

function nop() {}