const utils = new Utils();

/**
 * 获取页面内容，在页面发生任何变化时获取页面内容
 */
class EventWatcher extends Utils {
  /** 
   * @param win, window对象或iframe结点 
   * @param cb, function. type: hidden, visible, loaded, mutation, iframe-added, content-change
   * function used in Utils: getUid, parseUrl, md5, getTextAll
   */
  constructor(winOrIframe, cb) {
    super();
    if (winOrIframe.tagName && winOrIframe.tagName === 'IFRAME') {
      this.iframe = winOrIframe;
      this.window = winOrIframe.contentWindow;
    } else {
      this.iframe = null;
      this.window = winOrIframe;
    }
    this.cb = cb ? cb : () => {};
    this.iframeMap = {};
    this.mutationObserver = null;
    this.visibilityChangeCb = null;
    this.TAG_NAME = 'uuid';
    this.startListenVisibilityChange();
    // store content which has send
    this.listOfContentMd5 = [];
  }

  get title() {
    return this.document.title;
  }
  get url() {
    var url = null;
    try {
      url = this.window.location.href;
    } catch (err) {
      url = this.iframe && this.iframe.src;
    }
    if (['about:blank', ''].indexOf(url) > -1) {
       url = this.iframe && this.iframe.src;
    }
    return url;
  }
  get document() {
    return this.window.document;
  }

  // sendBodyContent on event loaded, mutation
  sendBodyContent() {
    const textContent = this.getTextAll(this.document.body);
    const md5 = this.md5(textContent);
    if (this.listOfContentMd5.indexOf(md5) === -1) {
      this.listOfContentMd5.push(md5);
      this.cb('content-change', this, {textContent, md5});
    }
  }
  /**
   * 页面可视状态监听
   * 隐藏状态下，关闭所有监听。可视时，打开。
   */
  startListenVisibilityChange() {
    if (this.visibilityChangeCb) {
      this.stopListenVisibilityChange();
    }
    const listener = (evt) => {
      // visible or hidden
      if (this.visibilityKey.hidden === document.visibilityState) {
        this.cb('hidden', this);
        this.listOfContentMd5 = [];
        this.stopListenEvents();
      } else if ('visible' === document.visibilityState) {
        this.cb('visible', this);
        this.startListenEvents();
      }
    }
    document.addEventListener(this.visibilityKey.visibilityChange, listener, false);
    this.visibilityChangeCb = listener;
  }
  stopListenVisibilityChange() {
    if (!this.visibilityChangeCb) {
      // console.log('visibilityChangeCb does not exist');
      return;
    }
    document.removeEventListener(this.visibilityKey.visibilityChange, this.visibilityChangeCb);
    this.visibilityChangeCb = null;
  }

  /** 开始事件监听 */
  startListenEvents() {
    const listener = () => {
      // 添加监听前，清除所有监听
      this.stopListenEvents();

      const currentDocument = this.document;
      const documentBody = currentDocument.body;
      this.cb('loaded', this);
      this.sendBodyContent();

      // 为现有的iframe结点添加事件监听
      if (!this.iframe) {
        this.addListenerForIFrame();
      }
      const mutationObserver = new MutationObserver(async(mutations, observer) => {
        /**
         * 当页面有变化时
         * 1. 触发回调
         * 2. 更新iframeMap
         */
        this.cb('mutaion', this);
        this.sendBodyContent();

        if (!this.iframe) {
          // 为新加的iframe添加事件监听
          [].slice.call(mutations).forEach(mutaion => {
            var all = [].slice.call(mutaion.addedNodes).map(it => {
              if (it.tagName === 'IFRAME') {
                return it;
              }
              if (it && it.querySelectorAll) {
                return [].slice.call(it.querySelectorAll('iframe'));
              } else {
                return [];
              }
            }).reduce((arr, it) => {
              arr = arr.concat(it);
              return arr;
            }, []).filter(this.isSameOrigin.bind(this)).forEach(node => {
              if (node.tagName === 'IFRAME') {
                if (!node.dataset.hasOwnProperty(this.TAG_NAME)) {
                  node.dataset[this.TAG_NAME] = this.getUid();
                }
                const tag = node.dataset[this.TAG_NAME];
                if (!this.iframeMap.hasOwnProperty(tag)) {
                  this.iframeMap[tag] = new EventWatcher(node, this.cb);
                  this.iframeMap[tag].startListenEvents();
                  this.cb('iframe-added', this, node)
                }
              }
            });

            // iframe被删除时，清空相应配置
            var all = [].slice.call(mutaion.removedNodes).map(it => {
              if (it.tagName === 'IFRAME') {
                return it;
              }
              if (it && it.querySelectorAll) {
                return [].slice.call(it.querySelectorAll('iframe'));
              } else {
                return [];
              }
            }).reduce((arr, it) => {
              arr = arr.concat(it);
              return arr;
            }, []).filter(this.isSameOrigin.bind(this)).forEach(node => {
              if (node.tagName === 'IFRAME') {
                const tag = node.dataset[this.TAG_NAME];
                if (this.iframeMap.hasOwnProperty(tag)) {
                  // iframe被删除后监听自动失效，不需手动关闭
                  // this.iframeMap[tag].stopListenEvents();
                  delete this.iframeMap[tag]
                }
              }
            });
          });
        }
      });
      var options = {
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
        // hashchange will trigger chrome.tabs.onChanged
        // this.window.addEventListener('hashchange', waitOneSecond);
      }
    } catch(err) {
      console.log(err);
    }
    return this;
  };

  /**
   * 停止事件监听
   */
  stopListenEvents() {
    // for (let key in this.iframeMap) {
      // this.iframeMap[key].stopListenEvents();
    // }
    // clear iframeMap
    // this.iframeMap = {};
    
    // 关闭对mutation的监听
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }
  
  /**
   * 为页面的所有iframe添加mutation-observer 
   * （仅对主页面有效，对iframe页面无效）
   */
  addListenerForIFrame() {
    if (this.iframe) {
      console.log(`addListenerForIFrame can not be called by iframe`);
      // do not listen iframe in iframe
      return;
    }
    const container = this.window.document;
    const iframeList = [].slice.call(container.querySelectorAll('iframe'));
    iframeList.filter(this.isSameOrigin.bind(this)).forEach(node => {
      if (!node.dataset.hasOwnProperty(this.TAG_NAME)) {
        node.dataset[this.TAG_NAME] = this.getUid();
      }
      const tag = node.dataset[this.TAG_NAME];
      if (!this.iframeMap.hasOwnProperty(tag)) {
        this.iframeMap[tag] = new EventWatcher(node, this.cb);
        this.iframeMap[tag].startListenEvents();
      }
    });
  }

  get visibilityKey() {
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
    return {
      hidden, state, visibilityChange
    }
  }

  /**
   * TODO: not used
   * 判断iframe是否与当前页面同源（根据浏览器同源策略，非同源的iframe，当前页面没有访问权限）
   * iframe需要加载完成后才能判断是否同源。避免刚添加iframe结点后，就立即判断是否同源。
   */
  isSameOrigin2(node) {
    var sameOrigin = false;
    try {
      sameOrigin = window.location.origin === node.contentWindow.location.origin;
    } catch(err) {
      sameOrigin = false;
    }
    return sameOrigin;
  }

  /**
   * 判断iframe是否与当前页面同源（根据浏览器同源策略，非同源的iframe，当前页面没有访问权限）
   */
  isSameOrigin(node) {
    const urlPasred = this.parseUrl(node.src);
    var sameOrigin = false;
    try {
      sameOrigin = window.location.origin === urlPasred.origin;
    } catch(err) {
      sameOrigin = false;
    }
    return sameOrigin;
  }
}

const DEBUG = false;

class Helper {
  constructor() {
    this.tabId = null;
    this.tab = null;
    this.onListen();
    // firstGlance: send message from content to background; ignore message request from background
    this.firstGlance = true;
    this.watchPageEvent();
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
            // pageInfo will be send by content
            // this.sendBodyText(document.body);
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
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(obj, response => {
          chrome.runtime.lastError
            ? reject(Error(chrome.runtime.lastError.message))
            : resolve(response)
        });
      });
      return response;
    } catch (err) {}
  }

  watchPageEvent() {
    const eventWatcher = new EventWatcher(window, (action, node, data) => {
      // type list: hidden, visible, loaded, mutation, iframe-added, content-change
      function showData() {
        console.log(`${action}: `);
        console.log(node.url);
        console.log(node.title);
        console.log(node.document);
        if (data) {
          console.log(data);
        }
      }
      switch (action) {
        case 'iframe-added':
          node = data;
        case 'loaded':
          this.sendMessage({
            action: 'send-visit-history',
            data: {
              title: node.title,
              url: node.url,
              container: node.iframe ? window.location.href : ''
            }
          });
          if (DEBUG) {
            showData();
          }
          break;
        case 'content-change':
          this.sendMessage({
            action: 'send-page-content',
            data: {
              content: data.textContent,
              md5: data.md5,
              title: node.title,
              url: node.url,
              container: node.iframe ? window.location.href : ''
            }
          });
          if (DEBUG) {
            showData();
          }
          break
      }


    }).startListenEvents();
  }
}

const helper = new Helper();

