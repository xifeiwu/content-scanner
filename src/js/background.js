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
    // 合法的内容
    this.legalContentMap = {};
    // 非法的内容
    this.illegalContentMap = {};
    this.init();
  }
  async init() {
    this.getOrUpdateIdentity = await this.getOrUpdateIdentityGen();
  }

  // generate function getOrUpdateIdentity(use closure to avoid global pollution)
  async getOrUpdateIdentityGen() {
    var Identity = await storage.getData('Identity');
    // make sure all prop of Identity is exist
    if (!Identity || ![
        'uuid',
        'ip',
        'userName'
      ].every(prop => {
        return utils.propExists(Identity, prop);
      })
    ) {
      Identity = {
        uuid: utils.getUid(),
        ip: await utils.getLocalIPList(),
        userName: ''
      }
      await storage.setData({
        Identity
      });
    }
    var count = 0;

    return async function(userName = null) {
      var isChanged = false;
      const start = Date.now();
      // check ip per * call
      if (count++ % 8 === 0) {
        var ip = await utils.getLocalIPList();
        if (!utils.theSame(ip, Identity.ip)) {
          Identity.ip = ip;
          isChanged = true;
        }
      }
      if (userName && Identity.userName !== userName) {
        Identity.userName = userName;
        isChanged = true;
      }
      if (isChanged) {
        await storage.setData({
          Identity
        });
      }
      console.log(Date.now() - start);
      return Identity;
    }
  }

  // 每个payload里面都有的属性
  async getCommonPayload() {
    const config = await this.getServiceConfig();
    const Identity = await this.getOrUpdateIdentity();
    return {
      uuid: Identity.uuid,
      ip: Identity.ip,
      userName: Identity.userName,
      configVersion: config.version
    }
  }

  async getServiceConfig(needUpdate = false) {
    function isValidConfig(config) {
      return [
        'basic_config',
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
        this.serviceConfig = (await net.request(net.URL_LIST.get_config))['content'];
        // 合法的内容
        this.legalContentMap = {};
        // 非法的内容
        this.illegalContentMap = {};
      }
      this.serviceConfig.count_reg = {}
      for (let key in this.serviceConfig.basic_config) {
        var rule = this.serviceConfig.basic_config[key];
        this.serviceConfig.count_reg[key] = new RegExp(rule['match_rule'], 'g');
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
    if (whitelist.length > 0) {
      if (!whitelist.find(it => host.indexOf(it) > -1)) {
        goOn = false;
      }
    } else if (blacklist.length > 0) {
      if (blacklist.find(it => host.indexOf(it) > -1)) {
        goOn = false;
      }
    }
    // TODO: should return goOn
    return goOn;
    // return true;
  }

  async getSelectorForUserName(tab) {
    const config = await this.getServiceConfig();
    if (!config) {
      throw new Error('serverConfig not found!');
    }
    const parsedUrl = tab.parsedUrl;
    const host = parsedUrl.host;
    const username_config = config.username_config;
    var selector = null;
    for (let key in username_config) {
      var rule = username_config[key];
      var match = false;
      if (Array.isArray(rule.url) && rule.url.find(it => host.indexOf(it) > -1)) {
        match = true;
      }
      if (match) {
        selector = rule.match_rule;
        break;
      }
    }
    return selector;
  }

  /**
   * 处理并发送浏览记录数据
   */
  async handleVisitHistory(tab) {
    const config = await this.getServiceConfig();
    if (!config) {
      throw new Error('serverConfig not found!');
    }
    const payload = Object.assign({
      title: tab.title,
      url: tab.url
    }, await this.getCommonPayload());
    const encryptedPayload = utils.encrypt(JSON.stringify(payload), config.system_config.secret_key, config.system_config.secret_iv);
    // console.log(payload);
    // console.log(encryptedPayload);
    const resData = await net.request(net.URL_LIST.visit_history, {
      payload: encryptedPayload
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (resData && resData.code && resData.code === 'NEED_UPDATE_CONFIG') {
      this.getServiceConfig(true);
    }
  }
  
  // generator of function handlePageContent
  async handlePageContent(tab, content) {
    const config = await this.getServiceConfig();
    if (!config) {
      throw new Error('serverConfig not found!');
    }
    const sendToServer = async (payload) => {
      payload = Object.assign(payload, await this.getCommonPayload());
      const encryptedPayload = utils.encrypt(JSON.stringify(payload), config.system_config.secret_key, config.system_config.secret_iv);
      // console.log(payload);
      // console.log(encryptedPayload);
      const resData = await net.request(net.URL_LIST.illegal_record, {
        payload: encryptedPayload
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (resData && resData.code && resData.code === 'NEED_UPDATE_CONFIG') {
        this.getServiceConfig(true);
      }
    }

    const md5Key = md5(content)
    if (this.legalContentMap.hasOwnProperty(md5Key)) {
      return;
    }
    if (this.illegalContentMap.hasOwnProperty(md5Key)) {
      sendToServer(this.illegalContentMap[md5Key]);
      return;
    }

    const count_reg = config.count_reg;
    // console.log(count_reg);

    var payload = {
      title: tab.title,
      url: tab.url
    };
    var totalCount = 0;
    for (let key in count_reg) {
      const reg = count_reg[key];
      var count = 0;
      var matchedContent;
      while ((matchedContent = reg.exec(content)) != null) {
        let isValid = true;
        if (key === 'bankcard_count') {
          isValid = utils.isValidBankcard(matchedContent[1]);
        } else if (key === 'idcard_count') {
          isValid = utils.isValidIdcard(matchedContent[1]);
        }
        // console.log(matchedContent[1]);
        // console.log(isValid);
        // console.log(key);

        if (isValid) {
          count++;
          totalCount++;
        }
      }
      payload[key] = count;
    }
    if (totalCount > 0) {
      // 非法的内容
      this.illegalContentMap[md5Key] = payload;
      sendToServer(payload)
    } else {
      // 合法的内容
      this.legalContentMap[md5Key] = Date.now();
    }
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
          this.handlePageContent(tab, request.data);
          break;
        case 'send-user-name':
          if (request.data) {
            this.getOrUpdateIdentity(request.data);
          }
          break;
      }
      sendResponse(tab);
    });

    async function sendMessage2ContentScript(tabId, action, data) {
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          action,
          data
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
          await sendMessage2ContentScript(tabId, 'request-page-content');
          const selectorForUserName = await this.getSelectorForUserName(tab);
          // console.log(`selectorForUserName: ${selectorForUserName}`);
          if (selectorForUserName) {
            await sendMessage2ContentScript(tabId, 'request-user-name', {
              selector: selectorForUserName
            });
          }
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

