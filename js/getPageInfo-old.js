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


$(function () {
  // Open or Refresh a new page
  getPage(extractPageText(document.body), window.location.href, document.title, "页面首次加载");

  function getPage(extractedText="", url="", title="", from="") {
    var info = {
      "title": title,
      "url": url,
      "text": extractedText,
      "from": from,
    }
    console.log(info);
//    console.log(info);
//    info.text += frameText;
//    console.log(info.text);
    chrome.runtime.connect({name: "sendPageInfo"}).postMessage(info);

    var urlMd5 = md5(info.url);
    var textMd5 = md5(info.text);

    chrome.storage.local.get(urlMd5, function(result){
        chrome.storage.local.set({[urlMd5]: textMd5}, function(){
          message = "时间戳：" + Date.now() + "；";
          message += "标题：" + info.title + "；";
          message += "URL：" + info.url + "。";
          console.log(message);

          getSecret().then(function(result){
//            console.log(result.key);
//            console.log(result.iv);
            info["message"] = encrypt(message, result.key, result.iv);
            chrome.runtime.connect({name: "sendPageInfo"}).postMessage(info);
          });

        });
    });
  };


  function extractPageText(parentNode) {
    function showContent(node) {
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
      if (node.tagName === 'A') {
        return node.innerText;
      }
      if (node.tagName === 'SPAN') {
        return node.innerText;
      }
      if (node.tagName === 'B') {
        return node.innerText;
      }
      if (node.tagName === 'LI') {
        return node.innerText;
      }
      if (node.tagName === 'TEXT') {
        return node.innerText;
      }
      if (node.tagName === 'I') {
        return node.innerText;
      }
      if (node.tagName === 'TH') {
        return node.innerText;
      }
      if (node.tagName === 'TD') {
        return node.innerText;
      }
      return node.textContent;
    }

   function traverse(node) {
     const nodeType = node.nodeType;
     const tagName = node.tagName;

     if (nodeType == 8) {
       // 注释comments
       return '';
     } else if (['SCRIPT', 'STYLE', 'NOSCRIPT'].indexOf(tagName) > -1) {
       return '';
     } else if (node.childNodes.length > 0) {
//     if (node.childNodes.length > 0) {
       return Array.prototype.slice.call(node.childNodes).map(traverse).join('');
     } else {
       var content = showContent(node);
       if (content) {
         return content.trim() + " ";
       } else {
         return '';
       }
     }
   }

   function showFullContent() {
     console.log(traverse(parentNode));
//     return traverse(parentNode);
   }

   const debouncedTraverse = debounce(showFullContent, 2000, false);
   debouncedTraverse();
//     console.log(traverse(parentNode));
//     return traverse(parentNode);
  }


  const observerList = [];


  function observerListener(mutations, observer) {
    mutations.forEach( (mutation) => {
//      console.log(`mutation.type = ${mutation.type}`);
      for (let i = 0; i < mutation.addedNodes.length; i++) {
//        console.log(mutation);
        getPage(extractPageText(mutation.addedNodes[i]), observer.target.contentDocument.URL, observer.target.contentDocument.title, "子框架DOM变动");
//        console.log(`${mutation.addedNodes[i].textContent} added`);
      }

      for (let i = 0;i < mutation.removedNodes.length; i++) {
        //console.log(`${mutation.removedNodes[i].textContent} removed`);
      }
    });

//    const iframeBody = observer.target.contentWindow.document.body;
//    getPage(extractPageText(iframeBody));
  }


  function getObserver(target) {
    var observer = new MutationObserver(observerListener);
    observer.target = target;
    return observer;
  }


  var observer = new MutationObserver(function(mutations, observer) {
    mutations.forEach( (mutation) => {
//      console.log(`mutation.type = ${mutation.type}`);
      for (let i = 0; i < mutation.addedNodes.length; i++) {
//        console.log(mutation);
        getPage(extractPageText(mutation.addedNodes[i]), window.location.href, document.title, "页面DOM变动");
//        console.log(`${mutation.addedNodes[i].textContent} added`);
      }

      for (let i = 0;i < mutation.removedNodes.length; i++) {
        //console.log(`${mutation.removedNodes[i].textContent} removed`);
      }
    });

    var iframeList = Array.prototype.slice.call(document.querySelectorAll('iframe'));
    console.log(iframeList);
    Promise.all(iframeList.map(it => {
      return new Promise((resolve, reject) => {
        it.contentWindow.addEventListener('load', () => {
          getPage(extractPageText(it.contentWindow.document.body), it.contentDocument.URL, it.contentDocument.title, "子框架首次加载");
          resolve();
        });

        it.onload = function () {
          it.contentDocument.onclick = function () {
            getPage(extractPageText(it.contentDocument.body), it.contentDocument.URL, it.contentDocument.title, "子框架点击事件");
          };
        }
      })
    })).then(() => {
//      console.log(document.body.textContent);
      getPage(extractPageText(document.body), window.location.href, document.title, "子框架全部加载");

      if (observerList.length > 0) {
        observerList.forEach(it => {
          it.disconnect();
        });
        observerList.length = 0;
      }

      iframeList.forEach(it => {
//        console.log(it.contentWindow.document.body.textContent);
        getPage(extractPageText(it.contentWindow.document.body), it.contentDocument.URL, it.contentDocument.title, "子框架？？？");

        const observer = getObserver(it);
        const options = {
          'subtree': true,
          'childList': true,
        }
        observer.observe(it.contentWindow.document.body, options);
          observerList.push(observer);
        })
      }).catch(err => {
        console.log(err);
      })
  });

  var options = {
    'subtree': true,
    'childList': true,
  };
  observer.observe(document.body, options);

});

