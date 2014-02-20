var connectsdk = {};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Event emitter functions

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
// very simple class maker

var createClass = function (desc) {
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
            for (var mixinProp in mixin) {
                if (mixin.hasOwnProperty(mixinProp)) {
                    prototype[mixinProp] = mixin[mixinProp];
                }
            }
        });
        delete desc.mixins;
    }
    
    if (desc.statics) {
        for (var staticProp in desc.statics) {
            if (desc.statics.hasOwnProperty(staticProp)) {
                constructor[staticProp] = desc.statics[staticProp];
            }
        }
        delete desc.statics;
    }

    for (var p in desc) {
        if (desc.hasOwnProperty(p)) {
            prototype[p] = desc[p];
        }
    }

    return constructor;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// connectsdk.ConnectManager

connectsdk.ConnectManager = createClass({
    mixins: [SimpleEventEmitter],

    statics: {
        PlatformType: {
            DEFAULT: "default",
            GOOGLE_CAST: "Google Cast",
            WEBOS_NATIVE: "webOS Native",
            WEBOS_WEB_APP: "webOS Web App"
        },

        EventType: {
            PLAY: "play",
            PAUSE: "pause",
            STOP: "stop",
            MESSAGE: "message"
        }
    },

    constructor: function() {
        this._detectPlatform();
    },

    registerVideoElement: function(element) {
        this.videoElement = element;
    },

    registerAudioElement: function(element) {
        this.audioElement = element;
    },

    registerImageElement: function(element) {
        this.imageElement = element;
    },

    init: function() {
        if (this.platformType == connectsdk.ConnectManager.PlatformType.GOOGLE_CAST)
            this._initCastService();
        else if (this.platformType == connectsdk.ConnectManager.PlatformType.WEBOS_NATIVE || this.platformType == connectsdk.ConnectManager.PlatformType.WEBOS_WEB_APP)
            this._initWebOSService();
    },

    _detectPlatform: function() {
        if (navigator.userAgent.indexOf("CrKey") > 0 && cast != null)
            this.platformType = connectsdk.ConnectManager.PlatformType.GOOGLE_CAST;
        else if (window.PalmSystem)
        {
            if (window.PalmServiceBridge)
                this.platformType = connectsdk.ConnectManager.PlatformType.WEBOS_NATIVE;
            else
                this.platformType = connectsdk.ConnectManager.PlatformType.WEBOS_WEB_APP;
        } else
            this.platformType = connectsdk.ConnectManager.PlatformType.DEFAULT;
    },

    _initCastService: function() {
        var self = this;

        if (this.videoElement)
        {
            this.castMediaManager = new cast.receiver.MediaManager(this.videoElement);
            this.castMediaManager.onPlay = function(evt) { console.log("onPlay"); };
            this.castMediaManager.onPause = function(evt) { console.log("onPause"); };
            this.castMediaManager.onStop = function(evt) { console.log("onStop"); };
            this.castMediaManager.onSeek = function(evt) { console.log("onSeek"); };
            this.castMediaManager.onSetVolume = function(evt) { console.log("onSetVolume"); };
            this.castMediaManager.onLoad = function(evt) { console.log("onLoad"); self.videoElement.style.display = ''; }
        }

        this.castReceiverManager = cast.receiver.CastReceiverManager.getInstance();
        
        this.castMessageBus = this.castReceiverManager.getCastMessageBus("urn:x-cast:com.connectsdk.main");
        this.castMessageBus.onMessage = function(evt) {
            var message;

            try
            {
                message = JSON.parse(evt.data);
            } catch (ex)
            {
                message = evt.data;
            }

            self.emit("message", message);
        };

        this.castReceiverManager.start();

        this.sendMessage = this._sendMessageCast;
    },

    _initWebOSService: function() {
        var self = this;

        window.addEventListener("keydown", function(evt) {
            switch (evt.keyCode)
            {
                case 1537: // PLAY
                    console.log(self.platformType + " :: play command received");
                    self.emit(connectsdk.ConnectManager.EventType.PLAY);
                    break;

                case 19: // PAUSE
                    console.log(self.platformType + " :: pause command received");
                    self.emit(connectsdk.ConnectManager.EventType.PAUSE);
                    break;

                case 413: // STOP
                    console.log(self.platformType + " :: stop command received");
                    self.emit(connectsdk.ConnectManager.EventType.STOP);
                    break;
            }
        });

        this.webOSAppChannels = new connectsdk.WebOSAppChannels();
        this.webOSAppChannels.start();

        this.sendMessage = this._sendMessageWebOS;
    },

    _sendMessageCast: function(message) {
        var messageString;

        try {
            messageString = JSON.stringify(message);
        } catch (ex) {
            messageString = message;
        }

        this.castMessageBus.broadcast(messageString);
    },

    _sendMessageWebOS: function(message) {
        var messageJSON;

        try {
            JSON.parse(message);
            messageJSON = message;
        } catch (ex) {
            messageJSON = { message: message };
        }

        this.webOSAppChannels.sendMessage(messageJSON);
    }
});

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
        if (this.ws) {
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

            self.ws.onmessage = function (event) {
                var message = JSON.parse(event.data);
                var payload = message.payload;

                console.log("got message: " + JSON.stringify(message));

                if (message.type === "p2p") {
                    if (typeof message.payload !== 'undefined') {
                        self.emit("message", {data: payload, namespace: message.ns});
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
            this.ws.close();
        }

        this._destroy();
    }
});
