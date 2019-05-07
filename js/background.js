/** global utils, axios */
// const utils = require('./utils');
// const axios = require('./axios');
const utils = new Utils();
const net = new Net();
const tabs = new Tabs();

class Helper {
  constructor() {
    this.communication();
  }

  async communication() {
    // async await will cause error: (Unchecked runtime.lastError: The message port closed before a response was received.)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log(sender);
      console.log(request);
      if (!request || !request.action) {
        sendResponse(null);
        return;
      }
      const tab = sender ? sender.tab : null;
      if (!tab || !tab.active) {
        sendResponse(null);
        return;
      }
      sendResponse(tab);
    });

    async function isConnected(tabId, tab) {
      // check if content-script is injected
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          action: 'ping',
          data: {
            tabId,
            tab
          }
        }, (response) => {
          chrome.runtime.lastError
            ? reject(Error(chrome.runtime.lastError.message))
            : resolve(response)
        });
      });
      return response && response.action === 'pong';
    }

    tabs.tabWatcher(async obj => {
      // console.log(obj);
      if (!obj) {
        return;
      }
      var tabId = obj.tabId;
      if (obj.hasOwnProperty('tab')) {
        tabId = obj['tab']['id'];
      }
      var tab = obj.tab;
      if (!tab || !tab.url ||  !/^[http|https]/.test(tab.url)) {
        return;
      }
      try {
        if (await isConnected(tabId, tab)) {
          // if (tab && tab.url) {
          //   const parser = utils.parseUrl(tab.url);
          //   if (parser.host) {
          //     this.updateVisitCountToStorage(parser.host);
          //   }
          // }
        } else {
          throw new Error('connection to content-script fail!');
        }
      } catch (err) {
        console.log(err);
        // chrome.tabs.executeScript(tabId, {
        //   file: "js/content.js"
        // }, results => {
        //   console.log(results);
        // });
      }
    });
  }
}

const helper = new Helper();
utils.getLocalIPList().then(v => console.log(v));

