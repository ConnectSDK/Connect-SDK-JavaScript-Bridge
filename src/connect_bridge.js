var connectsdk = (function () {
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

            // upper-case first char
            event = event.charAt(0).toUpperCase() + event.slice(1);

            if (this["on" + event]) {
                this["on" + event].apply(this, args);
            }

            if (listeners) {
                listeners.forEach(function (l) {
                    l.callback.apply(l.context || null, args);
                });
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
// ConnectManager

    var ConnectManager = createClass({
        mixins: [SimpleEventEmitter],

        statics: {
            PlatformType: {
                DEFAULT: "Default",
                AIRPLAY: "AirPlay",
                GOOGLE_CAST: "GoogleCast",
                WEBOS_NATIVE: "WebOSNative",
                WEBOS_WEB_APP: "WebOSWebApp"
            },

            EventType: {
                MESSAGE: "message",
                PAUSE: "pause",
                PLAY: "play",
                READY: "ready",
                STOP: "stop",
                STATUS: "mediaStatusUpdate",
                JOIN: "join",
                DEPART: "depart"
            }
        },

        mediaEvents: {
            loadstart: "buffering",
            playing: "playing",
            waiting: "buffering",
            abort: "finished",
            ended: "finished",
            play: "playing",
            pause: "paused"
        },

        constructor: function () {
            this.handleMediaEvent = this.handleMediaEvent.bind(this);

            extend(this, platforms[this._detectPlatform()]);
        },

        setImageElement: function (element) {
            // Register new image element
            if (element) {
                this.imageElement = element;
            }
        },

        setMediaElement: function (element) {
            // Unregister existing media element
            this.mediaElement && this.unregisterMediaEvents(this.mediaElement);

            // Register new media element
            if (element) {
                this.registerMediaEvents(element);
                this.mediaElement = element;
                this.mediaElement.autoPlay = true;
                this.setMediaStatus("idle");
            }
        },

        setMediaStatus: function (status) {
            this.mediaStatus = status;
            this.emit(ConnectManager.EventType.STATUS, status);
        },

        registerMediaEvents: function (element) {
            if (element) {
                for (var key in this.mediaEvents) {
                    this.mediaEvents.hasOwnProperty(key) && element.addEventListener(key, this.handleMediaEvent, false);
                }
            }
        },

        unregisterMediaEvents: function (element) {
            if (element) {
                for (var key in this.mediaEvents) {
                    this.mediaEvents.hasOwnProperty(key) && element.removeEventListener(key, this.handleMediaEvent, false);
                }
            }
        },

        handleMediaEvent: function (evt) {
            this.mediaEvents.hasOwnProperty(evt.type) && this.setMediaStatus(this.mediaEvents[evt.type]);
        },

        handleReady: function (evt) {
            this.emit(ConnectManager.EventType.READY);
        },

        handleJoin: function (client) {
            this.emit(ConnectManager.EventType.JOIN, client);
        },

        handleDepart: function (client) {
            this.emit(ConnectManager.EventType.DEPART, client);
        },

        _detectPlatform: function() {
            var userAgent = navigator.userAgent.toLowerCase();
            this.platformType = ConnectManager.PlatformType.DEFAULT;

            if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent))
                this.platformType = ConnectManager.PlatformType.AIRPLAY;
            else if (userAgent.indexOf('crkey') > 0 && cast != null)
                this.platformType = ConnectManager.PlatformType.GOOGLE_CAST;
            else if (userAgent.indexOf('tv') >= 0 && (userAgent.indexOf('webos') >= 0) || (userAgent.indexOf('web0s') >= 0))
            {
                if (window.PalmServiceBridge)
                    this.platformType = ConnectManager.PlatformType.WEBOS_NATIVE;
                else
                    this.platformType = ConnectManager.PlatformType.WEBOS_WEB_APP;
            }
            return this.platformType;
        },

        init: nop,

        sendMessage: nop,

        broadcastMessage: nop
    });

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Platforms

    var platforms = {};

    // Default
    platforms.Default = {
        interactive: false,
        init: nop,
        sendMessage: nop,
        broadcastMessage: nop
    };

    // Base media player (JSON media playback & control commands)

    var BaseMediaPlayer = {

        onLoadImage: function (image) {
            var imageElement = this.imageElement;
            if (imageElement && image && image.mediaURL) {
                console.log("Loading image", image.mediaURL);
                imageElement.src = image.mediaURL;
            } else {
                console.log("Failed to load image");
            }
        },

        onLoadMedia: function (media) {
            var mediaElement = this.mediaElement;
            if (mediaElement && media && media.mediaURL) {
                console.log("Loading", media.mediaURL);
                // TODO: pull metadata
                mediaElement.src = media.mediaURL;
                mediaElement.load();
            } else {
                console.log("Failed to load media");
            }
        },

        handleDisplayImage: function (msgData) {
            var from = msgData.from;
            var mediaCommand = msgData.message.mediaCommand;
            var commandType = mediaCommand.type;
            var requestId = mediaCommand.requestId;

            this.emit('loadImage', mediaCommand);

            this.sendMessage(from, {
                contentType: 'connectsdk.mediaCommandResponse',
                mediaCommandResponse: {
                    type: commandType,
                    requestId: requestId
                }
            });
        },

        handleGetDuration: function (msgData) {
            var from = msgData.from;
            var commandType = msgData.message.mediaCommand.type;
            var requestId = msgData.message.mediaCommand.requestId;
            var mediaElement = this.mediaElement;
            var duration = (mediaElement && mediaElement.duration) || 0;

            this.sendMessage(from, {
                contentType: 'connectsdk.mediaCommandResponse',
                mediaCommandResponse: {
                    type: commandType,
                    duration: duration,
                    requestId: requestId
                }
            });
        },

        handleGetPosition: function (msgData) {
            var from = msgData.from;
            var commandType = msgData.message.mediaCommand.type;
            var requestId = msgData.message.mediaCommand.requestId;
            var mediaElement = this.mediaElement;
            var currentTime = (mediaElement && mediaElement.currentTime) || 0;

            this.sendMessage(from, {
                contentType: 'connectsdk.mediaCommandResponse',
                mediaCommandResponse: {
                    type: commandType,
                    position: currentTime,
                    requestId: requestId
                }
            });
        },

        handleMediaStatusUpdate: function (requestId) {
            var playState = this.mediaStatus;
            var currentTime = 0;
            var duration = 0;
            var mediaElement = this.mediaElement;

            if (mediaElement) {
                currentTime = mediaElement.currentTime;

                if (mediaElement.duration != NaN)
                    duration = mediaElement.duration;

                if (playState == null)
                    return;

                this.broadcastMessage({
                    contentType: 'connectsdk.mediaEvent',
                    mediaEvent: {
                        type: 'playState',
                        playState: playState,
                        position: currentTime,
                        duration: duration,
                        requestId: requestId ? requestId : -1
                    }
                });
            }
        },

        handlePlayMedia: function (msgData) {
            var from = msgData.from;
            var mediaCommand = msgData.message.mediaCommand;
            var commandType = mediaCommand.type;
            var requestId = mediaCommand.requestId;

            this.emit('loadMedia', mediaCommand);

            this.sendMessage(from, {
                contentType: 'connectsdk.mediaCommandResponse',
                mediaCommandResponse: {
                    type: commandType,
                    requestId: requestId
                }
            });
        },

        handleSeek: function (msgData) {
            var from = msgData.from;
            var mediaCommand = msgData.message.mediaCommand;
            var commandType = mediaCommand.type;
            var requestId = mediaCommand.requestId;
            var position = mediaCommand.position;

            if (position) {
                var mediaElement = this.mediaElement;
                mediaElement && (mediaElement.currentTime = position);
                this.handleMediaStatusUpdate(-1);
            }

            this.sendMessage(from, {
                contentType: 'connectsdk.mediaCommandResponse',
                mediaCommandResponse: {
                    type: commandType,
                    requestId: requestId
                }
            });
        },

        handlePlay: function (msgData) {
            var from = msgData.from;
            var mediaCommand = msgData.message.mediaCommand;
            var commandType = mediaCommand.type;
            var requestId = mediaCommand.requestId;

            var mediaElement = this.mediaElement;
            mediaElement && mediaElement.play();

            this.sendMessage(from, {
                contentType: 'connectsdk.mediaCommandResponse',
                mediaCommandResponse: {
                    type: commandType,
                    requestId: requestId
                }
            });
        },

        handlePause: function (msgData) {
            var from = msgData.from;
            var mediaCommand = msgData.message.mediaCommand;
            var commandType = mediaCommand.type;
            var requestId = mediaCommand.requestId;

            var mediaElement = this.mediaElement;
            mediaElement && mediaElement.pause();

            this.sendMessage(from, {
                contentType: 'connectsdk.mediaCommandResponse',
                mediaCommandResponse: {
                    type: commandType,
                    requestId: requestId
                }
            });
        },

        handleMessage: function (msgData) {
            var contentType = null;

            if (msgData != null && msgData.message != null) {
                contentType = msgData.message.contentType;

                if (contentType == null) {
                    try {
                        contentType = JSON.parse(msgData.message).contentType;
                    } catch (ex) {
                        // don't need to do anything here
                    }
                }
            }

            switch (contentType) {
            case "connectsdk.mediaCommand":
                this.handleMediaCommand(msgData);
                break;

            case "connectsdk.serviceCommand":
                this.handleServiceCommand(msgData);
                break;

            default:
                this.emit(ConnectManager.EventType.MESSAGE, msgData);
            }
        },

        handleMediaCommand: function (msgData) {
            var mediaCommand = msgData.message.mediaCommand;
            if (!mediaCommand) {
                return;
            }

            var commandType = mediaCommand.type;
            console.log('processing mediaCommand ' + JSON.stringify(mediaCommand) + ' of type ' + commandType);

            switch (commandType) {
            case "displayImage":
                this.handleDisplayImage(msgData);
                break;
            case "getDuration":
                this.handleGetDuration(msgData);
                break;
            case "getPosition":
                this.handleGetPosition(msgData);
                break;
            case "playMedia":
                this.handlePlayMedia(msgData);
                break;
            case "seek":
                this.handleSeek(msgData);
                break;
            case "play":
                this.handlePlay(msgData);
                break;
            case "pause":
                this.handlePause(msgData);
                break;
            }
        },

        handleServiceCommand: function (msgData) {
            var serviceCommand = msgData.message.serviceCommand;
            if (!serviceCommand) {
                return;
            }

            var commandType = serviceCommand.type;
            console.log('processing serviceCommand ' + JSON.stringify(serviceCommand) + ' of type ' + commandType);

            switch (commandType) {
            case "close":
                // this is a hack to circumvent the fact that window.close() doesn't work with the webOS app type
                var newWindow = window.open(window.location, '_self');

                if (newWindow != null)
                    newWindow.close();
                else
                    window.close();
                break;
            }
        }
    };

    // webOS
    var WebOSCommon = extend({
        interactive: true,
        init: function () {
            window.addEventListener("keydown", this.handleKeyDown.bind(this));
            this.on(ConnectManager.EventType.STATUS, this.handleMediaStatusUpdate.bind(this));

            this.webOSAppChannels = new WebOSAppChannels();
            this.webOSAppChannels.on('message', this.handleMessage.bind(this));
            this.webOSAppChannels.on('ready', this.handleReady.bind(this));
            this.webOSAppChannels.on('join', this.handleJoin.bind(this));
            this.webOSAppChannels.on('depart', this.handleDepart.bind(this));
            this.webOSAppChannels.start();
        },

        sendMessage: function (to, message) {
            this.webOSAppChannels.sendMessage(to, message);
        },

        broadcastMessage: function (message) {
            this.webOSAppChannels.broadcastMessage(message);
        },

        handleKeyDown: function (evt) {
            if (!this.mediaElement) {
                return;
            }

            switch (evt.keyCode) {
            case 415: // PLAY
                console.log(this.name + " :: play command received");
                this.mediaElement.play();
                this.emit(ConnectManager.EventType.PLAY);
                break;

            case 19: // PAUSE
                console.log(this.name + " :: pause command received");
                this.mediaElement.pause();
                this.emit(ConnectManager.EventType.PAUSE);
                break;

            case 413: // STOP
                console.log(this.name + " :: stop command received");
                this.emit(ConnectManager.EventType.STOP);
                break;
            }
        }
    }, BaseMediaPlayer);

    platforms.WebOSNative = extend({
        name: "webOS Native Web App"
    }, WebOSCommon);

    platforms.WebOSWebApp = extend({
        name: "webOS Web App"
    }, WebOSCommon);

    // AirPlay
    platforms.AirPlay = extend({
        name: "AirPlay",
        interactive: true,

        init: function() {
            this.on(ConnectManager.EventType.STATUS, this.handleMediaStatusUpdate.bind(this));
        },

        sendMessage: function (to, message) {
            // AirPlay does not have p2p support, so we'll just 'broadcast' this message
            this.broadcastMessage(message);
        },

        broadcastMessage: function (message) {
            var messageString;

            if (typeof message == 'string')
                messageString = message;
            else
                messageString = JSON.stringify(message);

            var iframe = document.createElement('IFRAME');
            iframe.setAttribute('src', 'connectsdk://' + messageString);
            document.documentElement.appendChild(iframe);
            iframe.parentNode.removeChild(iframe);
            iframe = null;
        }
    }, BaseMediaPlayer),

    // Google Cast
    platforms.GoogleCast = {
        name: "Google Cast",
        interactive: false,
        init: function () {
            var origSetMediaElement = this.setMediaElement;
            this.setMediaElement = function (element) {
                origSetMediaElement.apply(this, arguments);
                this._setCastElement(element);
            };

            this._setCastElement(this.mediaElement);
            window.castReceiverManager = cast.receiver.CastReceiverManager.getInstance();
            window.castReceiverManager.addEventListener("ready", this._handleReady.bind(this));

            window.castMessageBus = window.castReceiverManager.getCastMessageBus("urn:x-cast:com.connectsdk");
            window.castMessageBus.addEventListener("message", this.handleMessage.bind(this));

            window.castReceiverManager.start();
        },

        _handleReady: function(evt) {
            window.castReceiverManager.addEventListener(cast.receiver.CastReceiverManager.EventType.SENDER_CONNECTED, this.handleSenderConnected.bind(this));
            window.castReceiverManager.addEventListener(cast.receiver.CastReceiverManager.EventType.SENDER_DISCONNECTED, this.handleSenderDisconnected.bind(this));

            this.handleReady(evt);
        },

        _setCastElement: function (element) {
            if (!element) {
                return;
            }
            if (!window.castMediaManager) {
                window.castMediaManager = new cast.receiver.MediaManager(element);
            } else {
                window.castMediaManager.setMediaElement(element);
            }
        },

        handleMessage: function (evt) {
            var message;
            try {
                message = JSON.parse(evt.data);
            } catch (ex) {
                message = evt.data;
            }

            this.emit(ConnectManager.EventType.MESSAGE, { from: evt.senderId, message: message });
        },

        sendMessage: function (to, message) {
            var messageString;

            if (typeof message == 'string')
                window.castMessageBus.send(to, message);
            else
            {
                var messageString = JSON.stringify(message);

                if (messageString)
                    window.castMessageBus.send(to, messageString);
            }
        },

        broadcastMessage: function (message) {
            var messageString;

            if (typeof message == 'string')
                window.castMessageBus.broadcast(message);
            else
            {
                var messageString = JSON.stringify(message);

                if (messageString)
                    window.castMessageBus.broadcast(messageString);
            }
        },

        handleSenderConnected: function(sender) {
            if (sender == null || sender.senderId == null)
                return;

            sender.id = sender.senderId;

            this.emit(ConnectManager.EventType.JOIN, sender);
        },

        handleSenderDisconnected: function(sender) {
            if (sender == null || sender.senderId == null)
                return;

            sender.id = sender.senderId;

            this.emit(ConnectManager.EventType.DEPART, sender);
        }
    };

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// WebOSAppChannels

    var WebOSAppChannelsInstance;
    var WebOSAppChannels = createClass({
        mixins: [SimpleEventEmitter],

        constructor: function() {
            // Singleton logic
            if (WebOSAppChannelsInstance) {
                return WebOSAppChannelsInstance;
            }
            WebOSAppChannelsInstance = this;

            this.stopRequested = false;
            this.ws = null;
            this.channels = [];

            if (window.PalmServiceBridge) {
                var statusSubscription;
                var getChannelRequest;

                var GATEWAY_SERVICE = "com.webos.service.secondscreen.gateway";
                var CREATE_APPCHANNEL_URI = "luna://com.webos.service.secondscreen.gateway/app2app/createAppChannel";
                var REGISTER_SERVER_STATUS_URI = "luna://com.palm.bus/signal/registerServerStatus";

                function callService(uri, params, callback) {
                    var request = new window.PalmServiceBridge();

                    request.onservicecallback = function (responseString) {
                        callback(JSON.parse(responseString));
                    };

                    request.call(uri, JSON.stringify(params || {}));

                    return request;
                }

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
                var foundSocketUrl = false;
                if (window.location.search) {
                    console.log("found params: ", window.location.search);
                    /**
                     * @author <a href="mailto:doctor.hogart@gmail.com">Konstantin Kitmanov</a>
                     * May be freely distributed under the MIT license.
                     */
                    function parse(str) {
                        var chunks = str.split('&'),
                            dict = {},
                            chunk;
                        for (var i = 0, len = chunks.length; i < len; i++) {
                            chunk = chunks[i].split('=');
                            dict[chunk[0]] = decodeURIComponent(chunk[1]);
                        }

                        return dict;
                    }

                    var parsed = parse(window.location.search.substr(1));

                    if (parsed.webOSAppChannelSocketUrl) {
                        console.log("found websocket URL: ", parsed.webOSAppChannelSocketUrl);
                        foundSocketUrl = true;

                        this.getAppChannelWebSocket = function (callback) {
                            callback(new WebSocket(parsed.webOSAppChannelSocketUrl));
                        };
                    }
                }

                if (!foundSocketUrl && window.NetCastCreateAppChannel) {
                    var callbackName = "_webOSCreateAppChannelCallback";

                    this.getAppChannelWebSocket = function (callback) {

                        window[callbackName] = function (response) {
                            delete window[callbackName];
                            //console.log("got NetCastCreateAppChannel response: " + JSON.stringify(response));

                            if (response.socketUrl) {
                                callback(new WebSocket(response.socketUrl));
                            }
                        };

                        window.NetCastCreateAppChannel('{}', callbackName, false);
                    };
                }
            }
        },

        getAppChannelWebSocket: function (callback) {
            console.error("app channel socket not supported");
        },

        start: function () {
            this.stopRequested = false;
            var self = this;

            !this.ws && this.getAppChannelWebSocket(function (socket) {
                if (self.stopRequested) {
                    self.stop();
                    return;
                }

                self.ws = socket;

                self.ws.onopen = function (event) {
                    console.log("websocket opened");
                    self.emit('ready', event);
                };

                self.ws.onerror = function (error) {
                    console.log("websocket error:", error);
                };

                self.ws.onmessage = function (event) {
                    try {
                        var message = JSON.parse(event.data);
                    } catch (e) {
                        return; // Ignore the message if it doesn't parse.
                    }
                    console.log("got message: " + JSON.stringify(message));

                    switch (message.type) {
                    case "p2p":
                        self._handleP2PMessage(message);
                        break;
                    case "p2p.depart":
                        self._handleP2PDepart(message);
                        break;
                    case "p2p.join":
                        self._handleP2PJoin(message);
                        break;
                    case "p2p.join-request":
                        self._handleP2PJoinRequest(message);
                        break;
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
        },

        sendMessage: function(to, message) {
            var messageData = {
                type: "p2p",
                to: to, // TODO: do we need to sanitize/check this value?
                payload: message
            };

            this._send(messageData);
        },

        broadcastMessage: function(message) {
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

        _handleP2PMessage: function (message) {
            var payload = message.payload;
            if (!payload) {
                return;
            }

            console.log('processing message payload ' + JSON.stringify(payload));
            this.emit('message', {from: message.from, message: message.payload});
        },

        _handleP2PJoinRequest: function (message) {
            var payload = message.payload;
            if (!payload) {
                return;
            }

            this._send({
                type: "p2p.join-response",
                payload: {
                    allowJoin: true,
                    requestId: payload.requestId
                }
            });
        },

        _handleP2PJoin: function (message) {
            var client = message.client;
            if (!client) {
                return;
            }

            console.log('processing client join ' + JSON.stringify(client));
            this.emit(ConnectManager.EventType.JOIN, client);
        },

        _handleP2PDepart: function (message) {
            var clientId = message.from;
            if (!clientId) {
                return;
            }

            console.log('processing client departure ' + clientId);
            this.emit(ConnectManager.EventType.DEPART, { id: clientId });
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
            if (b.hasOwnProperty(key) && !a.hasOwnProperty(key)) {
                a[key] = b[key]
            }
        }
        return a;
    }

    function nop() {}

    return {
        ConnectManager: ConnectManager,
        WebOSAppChannels: WebOSAppChannels
    }
})();