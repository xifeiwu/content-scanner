const utils = new Utils();

/**
 * 获取页面内容，在页面发生任何变化时获取页面内容
 */
class MutationWatcher {
  /** 
   * @param win, window对象 
   */
  constructor(win, cb) {
    this.window = win;
    this.cb = cb ? cb : () => {};
    // this.iframeList = [];
    this.iframeMutationWatcherList = [];
    this.mutationObserver = null;
  }

  // 开始监听页面变化
  startListenMutation() {
    const listener = () => {
      // 添加监听前，清除所有监听
      this.stopListenMutation();
      const currentDocument = this.window.document;
      const documentBody = currentDocument.body;
      this.cb(documentBody);
      this.addListenerForIFrame();

      const mutationObserver = new MutationObserver((mutations, observer) => {
        /**
         * 当页面有变化时
         * 1. 输出页面内容
         * 2. 为页面的所有iframe添加变动监听
         */
        this.cb(documentBody);
        this.addListenerForIFrame();
      });
      var options = {
        // 'attributes': true,
        'subtree': true,
        'childList': true,
      };
      mutationObserver.observe(documentBody, options);

      this.mutationObserver = mutationObserver;
    }
    const waitOneSecond = () => {
      setTimeout(() => {
        listener()
      }, 500);
    }

    try {
      if (this.window.document.readyState === 'complete') {
        waitOneSecond();
      } else {
        this.window.addEventListener('load', waitOneSecond);
        // hashchange will trigget chrome.tabs.onChanged
        // this.window.addEventListener('hashchange', waitOneSecond);
      }
    } catch(err) {
      console.log(err);
    }
  };

  stopListenMutation() {
    this.iframeMutationWatcherList.forEach(it => {
      it.stopListenMutation();
    });
    // 关闭对mutation的监听
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }
  
  // 为页面的所有iframe添加mutation-observer
  addListenerForIFrame() {
    const container = this.window.document;
    const iframeList = Array.prototype.slice.call(container.querySelectorAll('iframe'));
    // console.log('iframeList');
    // console.log(iframeList);
    // console.log(this.window.frames.length);
    this.iframeMutationWatcherList = iframeList.map(iframe => {
      const listener = new MutationWatcher(iframe.contentWindow, this.cb)
      listener.startListenMutation();
      return listener;
    });
  }
}

class Helper {
  constructor() {
    this.tabId = null;
    this.tab = null;
    this.onListen();
    // firstGlance: send message from content to background; ignore message request from background
    this.firstGlance = true;
    this.watchPageMutation();
  }
  
  onListen() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const action = request.action;
      switch (action) {
        // headshake
        case 'ping':
          if (!request.data) {
            sendResponse(null);
            return;
          }
          this.tab = request.data.hasOwnProperty('tab') ? request.data['tab'] : null;
          this.tabId = request.data.hasOwnProperty('tabId') ? request.data['tabId'] : null;
          sendResponse({
            action: "pong",
          });
          setTimeout(() => {
            // this.sendCount();
            // this.pushCount();
          });
          break;
        case 'request-page-content':
          if (this.firstGlance) {
            sendResponse(null);
            // 通过mutationObserver主动向background推送
          } else {
            sendResponse(true);
            this.sendBodyText(document.body);
            // sendResponse after utils.getTextAll will cause error: The message port closed before a response was received.
            // const bodyText = utils.getTextAll(document.body)
            // sendResponse({
            //   action,
            //   data: bodyText
            // })
          }
          break;
        case 'request-user-name':
          if (!request.data || !request.data.selector) {
            sendResponse(null);
            return;
          }
          sendResponse(true);
          var node = document.querySelector(request.data.selector);
          this.sendMessage({
            action: 'send-user-name',
            data: node.textContent
          });
          break;
      }
    });
  }

  /**
   * sendMessage to chrome.runtime
   * @param {obj}, object with format: {action, data}
   * @return {response}, response from chrome.runtime
   */
  async sendMessage(obj) {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(obj, response => {
        chrome.runtime.lastError
          ? reject(Error(chrome.runtime.lastError.message))
          : resolve(response)
      });
    });
    return response;
  }

  sendBodyText(node) {
    const bodyText = utils.getTextAll(node);
    const iframes = node.querySelectorAll ? [].slice.call(node.querySelectorAll('iframe')).filter(it => {
      try {
        return  (window.location.origin === it.contentWindow.location.origin) && utils.isVisible2(it);
      } catch(err) {
        return false
      }
    }).map(it => {
      return {
        url: it.contentWindow.location.href
      }
    }) : [];
    // console.log(bodyText);
    this.sendMessage({
      action: 'send-page-content',
      data: {
        content: bodyText,
        iframes
      }
    });
  }

  watchPageMutation() {
    const mutationWatcher = new MutationWatcher(window, () => {
      this.sendBodyText(document.body);
    });
    mutationWatcher.startListenMutation();
    // stop watching mutation after 20s, as mutationObserver is resource-comsuming
    // setTimeout(() => {
    //   this.firstGlance = false;
    //   mutationWatcher.stopListenMutation();
    // }, 20 * 1000);
    function onWindowVisibilityChange(cb) {
      // 各种浏览器兼容
      var hidden, state, visibilityChange;
      if (typeof document.hidden !== "undefined") {
        hidden = "hidden";
        visibilityChange = "visibilitychange";
        state = "visibilityState";
      } else if (typeof document.mozHidden !== "undefined") {
        hidden = "mozHidden";
        visibilityChange = "mozvisibilitychange";
        state = "mozVisibilityState";
      } else if (typeof document.msHidden !== "undefined") {
        hidden = "msHidden";
        visibilityChange = "msvisibilitychange";
        state = "msVisibilityState";
      } else if (typeof document.webkitHidden !== "undefined") {
        hidden = "webkitHidden";
        visibilityChange = "webkitvisibilitychange";
        state = "webkitVisibilityState";
      }
      document.addEventListener(visibilityChange, function(event) {
        cb(event);
      }, false);
    }
    onWindowVisibilityChange(evt => {
      // visible or hidden
      if ('hidden' === document.visibilityState) {
        this.firstGlance = false;
        mutationWatcher.stopListenMutation();
      } else if ('visible' === document.visibilityState) {
        mutationWatcher.startListenMutation();
      }
    })
  }
}

const helper = new Helper();

