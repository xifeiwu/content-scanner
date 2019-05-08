/** global utils, axios */
// const utils = require('./utils');
// const axios = require('./axios');
const utils = new Utils();
const net = new Net();
const tabs = new Tabs();
const storage = new Storage();

class Helper {
  constructor() {
    this.communication();
    this.serviceConfig = {};
    this.init();
  }
  async init() {
    this.getOrUpdateIndentity = await this.getOrUpdateIndentityGen();
  }

  // generate function getOrUpdateIndentity(use closure to avoid global pollution)
  async getOrUpdateIndentityGen() {
    var indentity = await storage.getData('indentity');
    // make sure all prop of indentity is exist
    if (!indentity || ![
        'uuid',
        'ip',
        'userName'
      ].every(prop => {
        return utils.propExists(indentity, prop);
      })
    ) {
      indentity = {
        uuid: utils.getUid(),
        ip: await utils.getLocalIPList(),
        userName: ''
      }
      await storage.setData({
        indentity
      });
    }
    var count = 0;

    return async function(userName = null) {
      var isChanged = false;
      const start = Date.now();
      // check ip per * call
      if (count++ % 8 === 0) {
        var ip = await utils.getLocalIPList();
        if (!utils.theSame(ip, indentity.ip)) {
          indentity.ip = ip;
          isChanged = true;
        }
      }
      if (userName && indentity.userName !== userName) {
        indentity.userName = userName;
        isChanged = true;
      }
      if (isChanged) {
        await storage.setData({
          indentity
        });
      }
      console.log(Date.now() - start);
      return indentity;
    }
  }

  async getServiceConfig(needUpdate = false) {
    function isValidConfig(config) {
      return [
        'count_config',
        'version',
        'username_config',
        'system_config.secret_key',
        'system_config.secret_iv',
        'system_config.whitelist',
        'system_config.blacklist',
      ].every(prop => {
        return utils.propExists(config, prop);
      })
    }
    try {
      if (!isValidConfig(this.serviceConfig) || needUpdate) {
        this.serviceConfig = await net.request(net.URL_LIST.get_config);
      }
      for (let key in this.serviceConfig.count_config) {
        this.serviceConfig.count_config[key] = new RegExp(this.serviceConfig.count_config[key]['match_rule'], 'g');
      }
      return this.serviceConfig;
    } catch(err) {
      console.log(err);
      return null;
    }
  }

  // 根据url（白名单、黑名单）判断是否需要继续处理
  async globalHostFilter(tab) {
    const config = await this.getServiceConfig();
    if (!config) {
      throw new Error('serverConfig not found!');
    }
    const parsedUrl = tab.parsedUrl;
    const host = parsedUrl.host;
    const system_config = config.system_config;
    const whitelist = system_config.whitelist;
    const blacklist = system_config.blacklist;
    var goOn = true;
    // 处理逻辑：
    // 如果存在白名单且host没有在白名单中，则不处理
    // 否则
    // 存在黑名单且host在黑名单中，则不处理
    // console.log(whitelist);
    // console.log(blacklist);
    // console.log(tab);
    if (Array.isArray(whitelist)) {
      if (!whitelist.find(it => host.indexOf(it) > -1)) {
        goOn = false;
      }
    } else if (Array.isArray(blacklist)) {
      if (blacklist.find(it => host.indexOf(it) > -1)) {
        goOn = false;
      }
    }
    // return goOn;
    return true;
  }

  /**
   * 处理并发送浏览记录数据
   */
  async handleVisitHistory(tab) {
    const config = await this.getServiceConfig();
    if (!config) {
      throw new Error('serverConfig not found!');
    }
    const indentity = await this.getOrUpdateIndentity();
    const payload = {
      uuid: indentity.uuid,
      ip: indentity.ip,
      userName: indentity.userName,
      title: tab.title,
      url: tab.url
    }
    const encryptedPayload = utils.encrypt(JSON.stringify(payload), config.system_config.secret_key, config.system_config.secret_iv);
    // console.log(payload);
    // console.log(encryptedPayload);
    net.request(net.URL_LIST.visit_history, {
      payload: encryptedPayload
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  async handlePageContent() {

  }

  async communication() {
    // async await will cause error: (Unchecked runtime.lastError: The message port closed before a response was received.)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // console.log(sender);
      // console.log(request);
      if (!request || !request.action) {
        sendResponse(null);
        return;
      }
      const tab = sender ? sender.tab : null;
      if (!tab || !tab.active) {
        sendResponse(null);
        return;
      }
      const action = request.action;
      switch (action) {
        case 'send-page-content':
          console.log('send-page-content');
          console.log(request);
          var start = Date.now();
          console.log(md5(request.data));
          var key  = "us5N0PxHAWuIgb0/Qc2sh5OdWBbXGady";
          var iv   = "zAvR2NI87bBx746n";
          var encrypted = utils.encrypt(request.data, key, iv);
          console.log(encrypted);
          console.log(Date.now() - start);
          break;
      }
      sendResponse(tab);
    });

    async function requestPageContent(tabId) {
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          action: 'request-page-content',
          data: {
            tabId
          }
        }, (response) => {
          chrome.runtime.lastError
            ? reject(Error(chrome.runtime.lastError.message))
            : resolve(response)
        });
      });
      // console.log('request-page-content');
      // console.log(response);
    }

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
      if (!obj || obj.action === 'onRemoved') {
        return;
      }
      var tabId = obj.tabId;
      if (obj.hasOwnProperty('tab')) {
        tabId = obj['tab']['id'];
      }
      var tab = obj.tab;
      // only handle protocol http and https
      if (!tab || !tab.url ||  !/^[http|https]/.test(tab.url)) {
        return;
      }
      tab.parsedUrl = utils.parseUrl(tab.url);
      if (!(await this.globalHostFilter(tab))) {
        console.log('ignore');
        return;
      }

      try {
        // 发送浏览记录
        this.handleVisitHistory(tab);
        if (await isConnected(tabId, tab)) {
          requestPageContent(tabId);
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

