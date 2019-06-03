### 安装

将src文件夹拖放到chrome://extensions/

### 概念

**页面**: 

页面和页面内的iframe具有同等地位，处理逻辑相同：监听同样的事件；处理同样的数据；iframe的内容不算作包含它的页面内容的一部分。

不考虑两层及以上的iframe嵌套。

**浏览历史**

对于主页面，打开一次浏览器tab，算作一次浏览。

对于iframe，监听visibilityState事件，document.visibilityState === 'visible'时，算作一次浏览。

对于主页面，监听chrome.tabs.onActivated事件，因为search, hash的修改不会触发visibilityState事件，但chrome.tabs.onActivated会被触发。

**页面内容检测**

页面内容会在两个事件中监听：'load', 'mutationObsever'。load在页面加载完成后调用一次；mutationObsever会在页面有任何变化时调用。

前端会缓存发送到后端的数据，相同的数据不会发送两遍。

页面的内容不包含页面内iframe中的内容。

但页面切换到后台（如tab切换）时，前端会清空缓存。
