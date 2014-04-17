//
//  Connect SDK JavaScript Bridge
//  Version 1.2.0 Date: 16 Apr 2014 10:29 PM
//
//  Created by Jeremy White on 4/16/14.
//  Copyright (c) 2014 LG Electronics.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//
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
            // event = event.charAt(0).toUpperCase() + event.slice(1);

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
            loadstart: "buffering",
            playing: "playing",
            waiting: "buffering",
            ended: "finished",
            play: "playing",
            pause: "paused"
        },

        constructor: function () {
            extend(this, platforms[this._detectPlatform()]);
        },

        setMediaElement: function (element) {
            // Unregister existing media element
            this.mediaElement && this.unregisterMediaEvents(this.mediaElement);

            // Register new media element
            if (element) {
                this.registerMediaEvents(element);
                this.mediaElement = element;
                this.mediaElement.autoPlay = true;
                this.emit("MediaElementUpdate", element);
                this.setMediaStatus("idle");
            }
        },

        setImageElement: function (element) {
            // Register new image element
            if (element) {
                this.imageElement = element;
                this.emit("imageElementUpdate", element);
            }
        },

        registerMediaEvents: function (element) {
            if (element) {
                for (var key in this.mediaEvents) {
                    this.mediaEvents.hasOwnProperty(key) && element.addEventListener(key, this.handleMediaEvent.bind(this));
                }
            }
        },

        unregisterMediaEvents: function (element) {
            if (element) {
                for (var key in this.mediaEvents) {
                    this.mediaEvents.hasOwnProperty(key) && element.removeEventListener(key, this.handleMediaEvent, this);
                }
            }
        },

        handleMediaEvent: function (evt) {
            this.mediaEvents.hasOwnProperty(evt.type) && this.setMediaStatus(this.mediaEvents[evt.type]);
        },

        setMediaStatus: function (status) {
            this.mediaStatus = status;
            this.emit("mediaStatusUpdate", status);
        },

        _detectPlatform: function() {
            var userAgent = navigator.userAgent.toLowerCase();
            this.platformType = ConnectManager.PlatformType.DEFAULT;

            if (userAgent.indexOf('crkey') > 0 && cast != null)
                this.platformType = ConnectManager.PlatformType.GOOGLE_CAST;
            else if (userAgent.indexOf('tv') >= 0 && userAgent.indexOf('webos') >= 0)
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

    // webOS
    var WebOSCommon = {
        interactive: true,
        init: function () {
            window.addEventListener("keydown", this.onKeyDown.bind(this));

            this.webOSAppChannels = new WebOSAppChannels();
            this.webOSAppChannels.connectManager = this;

            this.webOSAppChannels.on('message', this.onMessage.bind(this));

            this.webOSAppChannels.on('ready', this.onReady.bind(this));

            this.webOSAppChannels.start();

            // Attempt to retrieve the media element from the URI
            // TODO: change this to use launch params over app2app
            this.loadMediaFromURI();
        },

        loadMediaFromURI: function () {
            var media = {
                url: getParameterByName('target'),
                mimeType: getParameterByName('mimeType'),
                title: getParameterByName('title'),
                description: getParameterByName('description'),
                iconSrc: getParameterByName('iconSrc'),
                loop: getParameterByName('shouldLoop') === 'true'
            };

            if (media.url && media.mimeType) {
                var mediaType = media.mimeType.split('/')[0];

                if (mediaType)
                {
                    console.log("Attempting to load", mediaType);

                    if (this.mediaElement && this.mediaElement.tagName.toLowerCase() === mediaType) {
                        this.loadMedia({
                            src: media.url
                        });
                    } else {
                        console.log("Failed to load: Media type mismatch.")
                    }
                }
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

        onLoadImage: function (image) {
            var imageElement = this.imageElement;
            if (imageElement && image && image.mediaURL) {
                console.log("Loading image", image.mediaURL);
                imageElement.src = image.mediaURL;
            } else {
                console.log("Failed to load image");
            }
        },

        onKeyDown: function (evt) {
            if (!this.mediaElement) {
                return;
            }

            switch (evt.keyCode)
            {
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
        },

        onReady: function (evt) {
            this.emit("ready");
        },

        onMessage: function (message) {
            this.emit("message", message);
        },

        sendMessage: function (to, message) {
            this.webOSAppChannels.sendMessage(to, message);
        },

        broadcastMessage: function (message) {
            this.webOSAppChannels.broadcastMessage(message);
        }
    };

    platforms.WebOSNative = extend({
        name: "webOS Native Web App"
    }, WebOSCommon);

    platforms.WebOSWebApp = extend({
        name: "webOS Web App"
    }, WebOSCommon);

    // Google Cast
    platforms.GoogleCast = {
        name: "Google Cast",
        interactive: false,
        init: function () {
            this.mediaElement && (window.castMediaManager = new cast.receiver.MediaManager(this.mediaElement));
            this.on("MediaElementUpdate", this.onMediaElementUpdate, this);

            window.castReceiverManager = cast.receiver.CastReceiverManager.getInstance();

            window.castMessageBus = window.castReceiverManager.getCastMessageBus("urn:x-cast:com.connectsdk");
            window.castMessageBus.addEventListener("message", this.onMessage.bind(this));

            window.castReceiverManager.addEventListener("ready", this.onReady.bind(this));

            window.castReceiverManager.start();
        },

        onMediaElementUpdate: function (element) {
            console.log('onMediaElementUpdate ' + element);

            if (!element) {
                return;
            }
            if (!window.castMediaManager) {
                window.castMediaManager = new cast.receiver.MediaManager(element);
            } else {
                window.castMediaManager.setMediaElement(element);
            }
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

            this.emit("message", { from: evt.senderId, message: message });
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
        }
    }

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
                    function parse(str) {
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
                            callback(new WebSocket(parsed.webOSAppChannelSocketUrl));
                        };
                    }
                }
            }
        },

        getAppChannelWebSocket: function (callback) {
            console.error("app channel socket not supported");
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
                    self.connectManager.on('mediaStatusUpdate', self._handleMediaStatusUpdate, self);
                    self.emit('ready', event);
                };

                self.ws.onerror = function (error) {
                    console.log("websocket error:", error);
                };

                self.ws.onmessage = function (event) {
                    try {
                        var message = JSON.parse(event.data);
                    } catch (e) {
                        // TODO: Handle the parse error. Pass a p2p.error back to the client?
                    }
                    console.log("got message: " + JSON.stringify(message));

                    if (message.type === "p2p") {
                        self._handleP2PMessage(message);
                    } else if (message.type === "p2p.join-request") {
                        self._handleP2PJoinRequest(message);
                    } else if (message.type === "p2p.join") {
                        self._handleP2PJoin(message);
                    } else if (message.type === "p2p.depart") {
                        self._handleP2PDepart(message);
                    }
                };

                self.ws.onclose = function () {
                    self.connectManager.off('mediaStatusUpdate', self._handleMediaStatusUpdate, self);
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

        _handleMediaStatusUpdate: function (requestId) {
            var playState = this.connectManager.mediaStatus;
            var currentTime = 0;
            var duration = 0;
            var mediaElement = this.connectManager.mediaElement;

            if (mediaElement) {
                currentTime = mediaElement.currentTime;

                if (mediaElement.duration != NaN)
                    duration = mediaElement.duration;

                if (playState == null)
                    return;

                // TODO: add to id here
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

        _handleP2PMessage: function (message) {
            var payload = message.payload;
            if (!payload) {
                return;
            }

            console.log('processing message payload ' + JSON.stringify(payload));
            var contentType = message.payload.contentType;

            if (contentType === 'connectsdk.mediaCommand') {
                this._handleMediaCommand(message);
            } else {
                this.connectManager.emit('message', { from: message.from, message: message.payload });
            }
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
            var payload = message.payload;
            if (!payload) {
                return;
            }

            this.emit("join", {client: payload.client});
        },

        _handleP2PDepart: function (message) {
            var payload = message.payload;
            if (!payload) {
                return;
            }

            this.emit("depart", {client: payload.client});
        },

        // TODO: Move media handling to ConnectManager webOS platform (it is a connectsdk-specific use case of the app2app functionality)
        _handleMediaCommand: function (message) {
            var mediaCommand = message.payload.mediaCommand;
            if (!mediaCommand) {
                return;
            }

            var commandType = mediaCommand.type;
            console.log('processing mediaCommand ' + JSON.stringify(mediaCommand) + ' of type ' + commandType);

            if (commandType === 'seek') {
                this._handleSeekCommand(message);
            } else if (commandType === 'getPosition') {
                this._handleGetPosition(message);
            } else if (commandType === 'getDuration') {
                this._handleGetDuration(message);
            } else if (commandType === 'playMedia') {
                this._handlePlayMedia(message);
            } else if (commandType === 'displayImage') {
                this._handleDisplayImage(message);
            }
        },

        _handleSeekCommand: function (message) {
            var position = message.payload.mediaCommand.position;
            if (position) {
                var requestId = message.payload.mediaCommand.requestId;
                var mediaElement = this.connectManager.mediaElement;
                mediaElement.currentTime = position;
                this._handleMediaStatusUpdate(requestId);
            }
        },

        _handleGetDuration: function (message) {
            var from = message.from;
            var commandType = message.payload.mediaCommand.type;
            var requestId = message.payload.mediaCommand.requestId;
            var mediaElement = this.connectManager.mediaElement;
            var duration = (mediaElement && mediaElement.duration) || 0;

            this._send({
                type: 'p2p',
                to: from,
                payload: {
                    contentType: 'connectsdk.mediaCommandResponse',
                    mediaCommandResponse: {
                        type: commandType,
                        duration: duration,
                        requestId: requestId
                    }
                }
            });
        },

        _handleGetPosition: function (message) {
            var from = message.from;
            var commandType = message.payload.mediaCommand.type;
            var requestId = message.payload.mediaCommand.requestId;
            var mediaElement = this.connectManager.mediaElement;
            var currentTime = (mediaElement && mediaElement.currentTime) || 0;

            this._send({
                type: 'p2p',
                to: from,
                payload: {
                    contentType: 'connectsdk.mediaCommandResponse',
                    mediaCommandResponse: {
                        type: commandType,
                        position: currentTime,
                        requestId: requestId
                    }
                }
            });
        },

        _handlePlayMedia: function (message) {
            var from = message.from;
            var mediaCommand = message.payload.mediaCommand;
            var commandType = mediaCommand.type;
            var requestId = mediaCommand.requestId;

            this.connectManager.emit('LoadMedia', mediaCommand);

            this._send({
                type: 'p2p',
                to: from,
                payload: {
                    contentType: 'connectsdk.mediaCommandResponse',
                    mediaCommandResponse: {
                        type: commandType,
                        requestId: requestId
                    }
                }
            });
        },

        _handleDisplayImage: function (message) {
            var from = message.from;
            var mediaCommand = message.payload.mediaCommand;
            var commandType = mediaCommand.type;
            var requestId = mediaCommand.requestId;

            this.connectManager.emit('LoadImage', mediaCommand);

            this._send({
                type: 'p2p',
                to: from,
                payload: {
                    contentType: 'connectsdk.mediaCommandResponse',
                    mediaCommandResponse: {
                        type: commandType,
                        requestId: requestId
                    }
                }
            });
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

    return {
        ConnectManager: ConnectManager,
        WebOSAppChannels: WebOSAppChannels
    }
})();
