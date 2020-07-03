/* Created by zfh on 2018/11/2 */
import { Stomp } from "./stomp";

class WebSocket {
    /**
     * 微信 WebSocket 任务
     */
    socketTask = null;

    /**
     * Stomp代理
     */
    stompClient = null;

    /**
     * 默认监听的消息频道
     */
    channel = null;

    /**
     * 消息监听器
     */
    messageMonitor = null;

    /**
     * 消息处理器
     */
    messageHandler = null;

    /**
     * 重连成功的回调
     */
    reconnectCallback = null;

    /**
     * 主动断开连接的标识
     */
    disconnectFlag = false;

    /**
     * 默认最大重连次数
     */
    RECONNECT_MAX_COUNT = 30;

    /**
     * 默认重连时间间隔（单位：ms）
     */
    RECONNECT_TIME_INTERVAL = 1000;

    /**
     * 断线重连计数
     */
    RECONNECT_COUNT = 0;

    constructor () {
        /*setInterval是用来发心跳包的，而小程序没有window对象*/
        Stomp.setInterval = function (interval, f) {
            return setInterval(f, interval);
        };
        Stomp.clearInterval = function (id) {
            return clearInterval(id);
        };
    }

    /**
     * 建立websocket连接和频道监听，绑定消息处理器
     * @param header            消息头
     * @param webSocketUrl      连接地址
     * @param channel           监听的频道
     * @param messageHandler    消息处理器
     * @param reconnectCallback 成功回调
     */
    bulidConnectAndMonitor (header, webSocketUrl, channel, messageHandler, reconnectCallback) {
        var that = this;
        if (!this.getSocketStatus()) {
            var socketTask = wx.connectSocket({
                url: webSocketUrl
            });
            var ws = {
                send: function (frame) {
                    socketTask.send({data: frame});
                },
                close: function (frame) {
                    socketTask.close(frame);
                }
            };
            socketTask.onOpen(function (frame) {
                ws.onopen(frame);
                if (that.RECONNECT_COUNT > 0) {
                    that.reconnectCallback()
                }
                that.RECONNECT_COUNT = 0;
                console.log("websocket连接成功");
            });
            socketTask.onMessage(function (frame) {
                ws.onmessage(frame);
            });
            socketTask.onClose(function (frame) {
                that.stompClient._cleanUp();
                /*客户端主动断开连接，不启动重连。*/
                if (that.disconnectFlag) {
                    that.disconnectFlag = false;
                    console.log("websocket断开连接");
                    return;
                }
                /*因为是递归，所以使用setTimeout()来做定时器*/
                setTimeout(function () {
                    that.RECONNECT_COUNT += 1;
                    console.log("重连次数：", that.RECONNECT_COUNT);
                    if (that.RECONNECT_COUNT >= that.RECONNECT_MAX_COUNT) {
                        console.log("websocket连接失败");
                        return;
                    }
                    that.bulidConnectAndMonitor({}, webSocketUrl, that.channel, that.messageHandler, that.reconnectCallback);
                }, that.RECONNECT_TIME_INTERVAL);
            });
            var stompClient = Stomp.over(ws);
            that.stompClient = stompClient;
            stompClient.connect(
                header,
                function () {
                    that.messageMonitor = stompClient.subscribe(channel, messageHandler);
                    that.socketTask = socketTask;
                    that.channel = channel;
                    that.messageHandler = messageHandler;
                    that.reconnectCallback = reconnectCallback;
                    console.log("默认监听的频道：", channel);
                }
            );
        }
    }

    /**
     * 设置默认消息监听器
     * @param messageHandler    消息处理器
     * @param reconnectCallback 重连成功的回调
     */
    setDefaultMessageMonitor (messageHandler, reconnectCallback) {
        if (this.getSocketStatus()) {
            this.removeDefaultMessageMonitor();
            this.messageMonitor  = this.stompClient.subscribe(this.channel, messageHandler);
            /*更新消息处理器*/
            this.messageHandler = messageHandler;
            /*更新重连的回调*/
            this.reconnectCallback = reconnectCallback;
            console.log("默认监听频道：", this.channel);
        }
    }

    /**
     * 移除默认消息监听器
     */
    removeDefaultMessageMonitor () {
        if (this.getSocketStatus()) {
            this.messageMonitor.unsubscribe();
            console.log("The default listener was removed successfully");
        }
    }

    /**
     * 自定义消息监听器
     * @param channel         监听的频道
     * @param messageHandler  消息处理器
     * @return messageMonitor 消息监听器
     */
    addMessageMonitor (channel, messageHandler) {
        if (this.getSocketStatus()) {
            console.log("新监听频道：", channel);
            return this.stompClient.subscribe(channel, messageHandler);
        }
    }

    /**
     * 移除消息监听器
     * @param messageMonitor 消息监听器
     */
    removeMessageMonitor (messageMonitor) {
        if (messageMonitor == null || JSON.stringify(messageMonitor) === '{}') {
            console.log("监听器不能为空");
            return;
        }
        if (this.getSocketStatus()) {
            messageMonitor.unsubscribe();
            console.log("The listener was removed successfully");
        }
    }

    /**
     * 发送消息
     * @param channel 频道
     * @param header  消息头
     * @param body    消息体
     */
    sendMessage (channel, header, body) {
        if (this.getSocketStatus()) {
            this.stompClient.send(channel, header, JSON.stringify(body));
        }
    }

    /**
     * 关闭连接
     */
    close () {
        if (this.getSocketStatus()) {
            this.stompClient.disconnect();
            this.disconnectFlag = true;
        }
    }

    /**
     * 获取连接状态
     * @return boolean
     */
    getSocketStatus () {
        var boolean = false;
        if (this.socketTask && this.socketTask.readyState) {
            boolean = this.socketTask.readyState === 1;
        }
        console.log("websocket连接状态：" + boolean);
        return boolean;
    }
}

export {
    WebSocket
}
