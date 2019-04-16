/*
 * 频率控制 返回函数连续调用时，fn 执行频率限定为每多少时间执行一次
 * @param fn {function}  需要调用的函数
 * @param delay  {number}    延迟时间，单位毫秒
 * @param immediate  {bool} 给 immediate参数传递false 绑定的函数先执行，而不是delay后后执行。
 * @return {function}实际调用函数
 */
function throttle(fn, delay, immediate, debounce) {
  var curr = +new Date(), //当前事件
    last_call = 0,
    last_exec = 0,
    timer = null,
    diff, //时间差
    context, //上下文
    args,
    exec = function() {
      last_exec = curr;
      fn.apply(context, args);
    };
  return function() {
    curr = +new Date();
    context = this,
      args = arguments,
      diff = curr - (debounce ? last_call : last_exec) - delay;
    clearTimeout(timer);
    if (debounce) {
      if (!immediate) {
        timer = setTimeout(exec, delay);
      } else if (diff >= 0) {
        exec();
      }
    } else {
      if (diff >= 0) {
        exec();
      } else if (!immediate) {
        timer = setTimeout(exec, -diff);
      }
    }
    last_call = curr;
  }
}


/*
 * 空闲控制 返回函数连续调用时，空闲时间必须大于或等于 delay，fn 才会执行
 * @param fn {function}  要调用的函数
 * @param delay   {number}    空闲时间
 * @param immediate  {bool} 给 immediate参数传递false 绑定的函数先执行，而不是delay后后执行。
 * @return {function}实际调用函数
 */
function debounce(fn, delay, immediate) {
  return throttle(fn, delay, immediate, true);
}


class ContentExtractor {
  constructor(pageHref, pageTitle, targetNode) {
    this.href = pageHref;
    this.title = pageTitle;
    this.targetNode = targetNode;
    this.debouncedGetAllText = debounce(this.getAllText, 3000, false);
  }

  // 获取一个节点的文本内容
  getNodeText(node) {
    const tagName = node.tagName;
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
      return node.value;
    }
    if (node.tagName === 'DIV') {
      return node.innerText;
    }
    if (node.tagName === 'SCRIPT') {
      return '';
    }
    if (node.tagName === 'STYLE') {
      return '';
    }
    if (node.tagName === 'NOSCRIPT') {
      return '';
    }
    if (['A', 'SPAN', 'B', 'LI', 'TEXT', 'I', 'TH', 'TD'].indexOf(tagName) > -1) {
      return node.innerText;
    }
    return node.textContent;
  }

  // 获取node及子节点文本内容
  traverseChild(node) {
    if (!node) {
      return '';
    }
    // console.log(node);
    const nodeType = node.nodeType;
    const tagName = node.tagName;

    if (nodeType == 8) {
      // 注释comments
      return '';
    } else if (['SCRIPT', 'STYLE', 'NOSCRIPT'].indexOf(tagName) > -1) {
      // 忽略script, style, noscript中的内容
      return '';
    } else if('IFRAME' === tagName) {
      // console.log(node);
      // console.log(node.contentWindow.document.body.textContent);
      // console.log(node.contentWindow.location.origin);
      // 获取iframe中的内容
      try {
        // 处理跨域的问题
        if (window.location.origin === node.contentWindow.location.origin) {
          return [node.contentWindow.href, '\n'].concat(
            Array.prototype.slice.call(node.contentWindow.document.body.childNodes).map(this.traverseChild.bind(this))
          ).join('');
        }
      } catch (err) {
        return '';
      }
    } else if (node.childNodes.length > 0) {
      return Array.prototype.slice.call(node.childNodes).map(this.traverseChild.bind(this)).join('');
    } else {
     var content = this.getNodeText(node);
     if (content) {
       return content.trim() + ' ';
     } else {
       return '';
     }
    }
  }

  /**
   * 获取当前页面及当前页面iframe的内容
   */
  getAllText() {
    const currentContent = this.traverseChild(this.targetNode);
    const result = currentContent;
    /** 在这个地方向后台发送数据 **/
    console.log(`page url: ${this.href}`);
    console.log(`page title: ${this.title}`);
    console.log(result);

    var info = {
      "url": this.href,
      "title": this.title.replace(/\"/g, "\\\""),
      "text": result,
    }

    var urlMd5 = md5(info.url);
    var textMd5 = md5(info.text);

    chrome.storage.local.get(urlMd5, function(result){
        chrome.storage.local.set({[urlMd5]: textMd5}, function(){
//          if (textMd5 == result[urlMd5]) {
            let message = "{\"timestamp\": " + Date.now() + ", ";
            message += "\"mobile\": {\"name\": \"手机号\", \"no\": " + get_match_num(info.text, "mobile") + "}, ";
            message += "\"idcard\": {\"name\": \"身份证号\", \"no\": " + get_match_num(info.text, "idcard") + "}, ";
            message += "\"bankcard\": {\"name\": \"银行卡号\", \"no\": " + get_match_num(info.text, "bankcard") + "}, ";
            message += "\"desensitive\": {\"name\": \"脱敏值\", \"no\": " + get_match_num(info.text, "desensitive") + "}}";
//            console.log(message);

            getSecret().then(function(result){
              info["message"] = encrypt(message, result.key, result.iv);
              chrome.runtime.connect({name: "sendPageInfo"}).postMessage(info);
            });
//          }
        });
    });
  }
}


const extractorMap = {};
function getContentExtractor(href, title, targetNode) {
  if (!targetNode) {
    return {
      debouncedGetAllText: () => {}
    }
  }
  if (!extractorMap.hasOwnProperty(href)) {
    extractorMap[href] = new ContentExtractor(href, title, targetNode);
  }
  return extractorMap[href];
}


class MutationHelper {
  /** 
   * @param win, window对象 
   */
  constructor(win) {
    this.window = win;
    // this.iframeList = [];
    this.iframeMutationHelperList = [];
    this.mutationObserver = null;
    // TODO: not used
    // 是否和当前页面同源（如果不同源，则没有任何访问权限）
    this.sameOrigin = this.isSameOrigin();
  }

  // TODO: not used
  // 只有页面加载完成后，才能获得location的值
  isSameOrigin() {
    var result = true;
    try {
      const location = this.window.location;
      if (location.hasOwnProperty('origin') && location.origin && window.location.origin !== this.window.location.origin) {
        result = false;
      }
    } catch(err) {
      result = false;
    }
    return result;
  }

  // 开始监听页面变化
  startListenMutation() {
    const listener = () => {
      // 添加监听前，清除所有监听
      this.stopListenMutation();
      const currentDocument = this.window.document;
      const documentBody = currentDocument.body;
//       console.log(`${this.window.location.href}: ${currentDocument.readyState}`);
//       console.log(documentBody);
      // 页面load完毕后，展示页面内容
      getContentExtractor(this.window.location.href, this.window.document.title, documentBody).debouncedGetAllText();
      this.addListenerForIFrame();

      const mutationObserver = new MutationObserver((mutations, observer) => {
        /**
         * 当页面有变化时
         * 1. 输出页面内容
         * 2. 为页面的所有iframe添加变动监听
         */
        getContentExtractor(this.window.location.href, this.window.document.title, documentBody).debouncedGetAllText();
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


new MutationHelper(window).startListenMutation();
