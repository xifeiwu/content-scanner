const utils = new Utils();

class Helper {
  constructor() {
    this.tabId = null;
    this.tab = null;
    this.onListen();
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

  async sendBodyText(node) {
    const bodyText = utils.getTextAll(node);
    console.log(bodyText);
  }

  /**
   * TODO: not used
   * 获取当前页面及当前页面iframe的内容
   */
  getAllText() {
    const currentContent = this.getTextAll(this.targetNode);
    const content = currentContent;
    /** 在这个地方向后台发送数据 **/
    const pageInfo = {
      "content": content,
    }
    // ContentExtractor.connector.postMessage(pageInfo);
    // var urlMd5 = md5(info.url);
    // var textMd5 = md5(info.text);
  }
}

const helper = new Helper();


/**
 * 获取页面内容，在页面发生任何变化时获取页面内容
 */
class MutationHelper {
  /** 
   * @param win, window对象 
   */
  constructor(win) {
    this.window = win;
    // this.iframeList = [];
    this.iframeMutationHelperList = [];
    this.mutationObserver = null;
  }

  // 开始监听页面变化
  startListenMutation() {
    const listener = () => {
      // 添加监听前，清除所有监听
      this.stopListenMutation();
      const currentDocument = this.window.document;
      const documentBody = currentDocument.body;
      helper.sendBodyText(document.body);
      this.addListenerForIFrame();

      const mutationObserver = new MutationObserver((mutations, observer) => {
        /**
         * 当页面有变化时
         * 1. 输出页面内容
         * 2. 为页面的所有iframe添加变动监听
         */
        helper.sendBodyText(document.body);
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
        this.window.addEventListener('hashchange', waitOneSecond);
      }
    } catch(err) {
      console.log(err);
    }
  };

  stopListenMutation() {
    this.iframeMutationHelperList.forEach(it => {
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
    this.iframeMutationHelperList = iframeList.map(iframe => {
      const listener = new MutationHelper(iframe.contentWindow)
      listener.startListenMutation();
      return listener;
    });
  }
}


(function() {
  new MutationHelper(window).startListenMutation();
  // utils.getLocalIPList().then(v => console.log(v));
})();

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
 console.log('onWindowVisibilityChange');
 console.log(evt);
 // visible or hidden
 console.log(document.visibilityState);
})

