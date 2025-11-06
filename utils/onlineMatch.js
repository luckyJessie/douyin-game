const noop = () => {};

export default class OnlineMatch {
  constructor({ serverUrl, onOpen, onClose, onError, onMessage } = {}) {
    this.serverUrl = serverUrl;
    this.handlers = {
      onOpen: onOpen || noop,
      onClose: onClose || noop,
      onError: onError || noop,
      onMessage: onMessage || noop
    };
    this.socketTask = null;
    this.roomId = '';
    this.connectPromise = null;
  }

  connect(roomId) {
    if (!roomId) {
      return Promise.reject(new Error('房间号不能为空'));
    }

    if (typeof wx === 'undefined' || !wx.connectSocket) {
      return Promise.reject(new Error('当前环境不支持微信网络能力'));
    }

    this.roomId = roomId;
    if (this.socketTask) {
      this.socketTask.close({ reason: 'reconnect' });
      this.socketTask = null;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      this._resolveConnect = resolve;
      this._rejectConnect = reject;
    });

    const url = this.composeUrl(roomId);
    try {
      this.socketTask = wx.connectSocket({ url });
    } catch (error) {
      this._rejectConnect?.(error);
      this._resolveConnect = null;
      this._rejectConnect = null;
      this.connectPromise = null;
      return Promise.reject(error);
    }

    this.bindEvents();

    return this.connectPromise;
  }

  composeUrl(roomId) {
    if (!this.serverUrl) {
      throw new Error('未配置服务器地址');
    }
    const separator = this.serverUrl.includes('?') ? '&' : '?';
    return `${this.serverUrl}${separator}roomId=${encodeURIComponent(roomId)}`;
  }

  bindEvents() {
    if (!this.socketTask) return;

    this.socketTask.onOpen(() => {
      if (this._resolveConnect) {
        this._resolveConnect();
        this._resolveConnect = null;
      }
      this._rejectConnect = null;
      this.handlers.onOpen();
    });

    this.socketTask.onClose(res => {
      if (this._rejectConnect) {
        this._rejectConnect(new Error('连接已关闭'));
        this._rejectConnect = null;
      }
      this.socketTask = null;
      this.handlers.onClose(res);
    });

    this.socketTask.onError(err => {
      if (this._rejectConnect) {
        this._rejectConnect(err);
        this._rejectConnect = null;
      }
      this.handlers.onError(err);
    });

    this.socketTask.onMessage(event => {
      this.handleMessage(event?.data);
    });
  }

  handleMessage(raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      this.handlers.onMessage(parsed);
    } catch (error) {
      this.handlers.onError(error);
    }
  }

  send(payload) {
    if (!this.socketTask) return;
    try {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      this.socketTask.send({ data });
    } catch (error) {
      this.handlers.onError(error);
    }
  }

  sendMove(move) {
    this.send({ type: 'move', payload: move });
  }

  leave() {
    this.send({ type: 'leave', payload: { roomId: this.roomId } });
    this.close();
  }

  close() {
    if (this.socketTask) {
      this.socketTask.close({ reason: 'manual-close' });
      this.socketTask = null;
    }
  }
}
