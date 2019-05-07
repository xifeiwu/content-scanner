class Tabs {
  constructor() {}

  async getInfoById(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.get(tabId, tab => {
        // output = {
        //   active: true
        //   audible: false
        //   autoDiscardable: true
        //   discarded: false
        //   favIconUrl: "https://www.google.com/favicon.ico"
        //   height: 920
        //   highlighted: true
        //   id: 2275
        //   incognito: false
        //   index: 39
        //   mutedInfo: {muted: false}
        //   pinned: false
        //   selected: true
        //   status: "complete"
        //   title: "requires dev channel or newer, but this is the stable channel. - Google 搜索"
        //   url: "https://www.google.com/search?ei=qpyuXNeSAZP7-QbYr6G4Ag&q=+requires+dev+channel+or+newer%2C+but+this+is+the+stable+channel.&oq=+requires+dev+channel+or+newer%2C+but+this+is+the+stable+channel.&gs_l=psy-ab.3..0i7i30j0i30.12425.12425..12661...0.0..0.137.137.0j1......0....1..gws-wiz.-mSWYiz-3OA"
        //   width: 1428
        //   windowId: 1
        // };
        resolve(tab);
      });
      setTimeout(() => {
        reject(new Error('consume too many time'));
      }, 3000);
    });
  }

  watchTab() {
    chrome.tabs.onCreated.addListener(async(tab) => {
      console.log('onCreated');
      console.log(tab);
    });
    chrome.tabs.onUpdated.addListener(async(tabId, changeInfo, tab) => {
      console.log('onUpdated');
      if (tab.status == 'complete') {
        console.log(tab);
      }
    });
    /**
     * @param {activeInfo}, {tabId, windowId}
     */
    chrome.tabs.onActivated.addListener(async(activeInfo) => {
      console.log('onActivated');
      console.log(await this.getInfoById(activeInfo.tabId));
    });
    /**
     * @parma {removeInfo}, {windowId, isWindowClosing}
     */
    chrome.tabs.onRemoved.addListener(async(tabId, removeInfo) => {
      console.log('onRemoved');
      console.log(tabId, removeInfo);
      // getInfoById(tabId) will cause error
      // console.log(await getInfoById(tabId));
    });
    // Fired when a tab is moved within a window. Only one move event is fired, representing the tab the user directly moved.
    chrome.tabs.onMoved.addListener(async() => {
    });
    // Fired when a tab is attached to a window; for example, because it was moved between windows.
    chrome.tabs.onAttached.addListener(async(tabId, attachInfo) => {
    });
    // Fired when a tab is detached from a window; for example, because it was moved between windows.
    chrome.tabs.onDetached.addListener(async(tabId, detachInfo) => {
    });
  }

  async tabWatcher(cb) {
    chrome.tabs.onCreated.addListener(async(tab) => {
      cb({
        action: 'onCreated',
        tab
      })
    });
    chrome.tabs.onUpdated.addListener(async(tabId, changeInfo, tab) => {
      if (tab.status == 'complete') {
        cb({
          action: 'onUpdated',
          tab
        })
      }
    });
    /**
     * @param {activeInfo}, {tabId, windowId}
     */
    chrome.tabs.onActivated.addListener(async(activeInfo) => {
      cb({
        action: 'onActivated',
        tab: await this.getInfoById(activeInfo.tabId)
      })
    });
    /**
     * @parma {removeInfo}, {windowId, isWindowClosing}
     */
    chrome.tabs.onRemoved.addListener(async(tabId, removeInfo) => {
      cb({
        action: 'onRemoved',
        tabId
      })
    });
  }

  async getActiveTabs() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({active: true, currentWindow: true},(tabs) => {
        chrome.runtime.lastError
          ? reject(Error(chrome.runtime.lastError.message))
          : resolve(tabs)
      });
      setTimeout(() => {
        reject(new Error('consume too many time'));
      }, 3000);
    });
  }

  async getAllTabsInCurrentWindow() {
    return new Promise((resolve, reject) => {
      chrome.windows.getCurrent({populate: true}, window => {
        chrome.runtime.lastError
          ? reject(Error(chrome.runtime.lastError.message))
          : resolve(window.tabs)
      });
      setTimeout(() => {
        reject(new Error('consume too many time'));
      }, 3000);
    });
  }
}