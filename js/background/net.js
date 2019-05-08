
class Net {
  constructor() {
    // this.host = 'http://172.16.124.117:3000';
    this.host = 'http://172.16.125.79:7777';
    const URL_LIST = {
      // 服务端配置
      get_config: {
        path: '/getconfig',
        method: 'post'
      },
      // 浏览记录
      visit_history: {
        path: '/access',
        method: 'post'
      },
      // 非法页面信息
      illegal_record: {
        path: '/monitor',
        method: 'post'
      }
    }
    Object.keys(URL_LIST).forEach(key => {
      URL_LIST[key]['path'] = this.host + URL_LIST[key]['path']
    });
    this.URL_LIST = URL_LIST;
  }

  /**
   * 格式化请求
   * @param path
   * @param method
   * @param options,
   * @param config, config for axios
   * @returns request in the form of Promise
   */
  getResponse({path, method}, options = {}, config) {
    try {
      let instance = axios;
      if (config) {
        instance = axios.create(config);
      }
      if (!path || !method) {
        return Promise.reject({
          title: '参数错误',
          message: '未设置请求方式'
        });
      }
      let payload = {};
      if (options.params) {
        Object.keys(options.params).forEach((key) => {
          // path = path.replace('{' + key + '}', encodeURIComponent(options.params[key]));
          path = path.replace('{' + key + '}', options.params[key]);
        });
      }
      if (options.query) {
        path = path + '?' + utils.objectToQueryString(options.query);
      }
      if (options.payload) {
        payload = options.payload;
      }
      return instance[method](path, payload);
    } catch(err) {
      // 捕获参数处理的错误
      console.log(`error of getResponse:`);
      console.log(err);
      return Promise.reject(err);
    } finally {
    }
  }

  isRequestSuccess(resData) {
    return resData.success;
  }

  async request({path, method}, options = {}, config = {}) {
    try {
      const response = await this.getResponse({path, method}, options, Object.assign({
        timeout: 15000,
      }, config));
      const resData = response.data;
      if (this.isRequestSuccess(resData)) {
        return resData;
      } else {
        throw new Error(`response fail: ${path}`);
      }
    } catch (error) {
      // 捕获网络请求的错误
      console.log(`error of request:`);
      console.log(error);
      if (error.isAxiosError) {
      }
      return null;
    }
  }

  requestConfig() {
    this.post('/getconfig').then(res => {
      const resContent = res.content;
      // console.log(resContent);
      // console.log(JSON.stringify(resContent));
      this.saveConfig(resContent);
    }).catch(err => {
      console.log(err);
    })
  }

  getConfig() {
    const defaultConfig = {
      "version": "1.0.0", 
      "system_config": {
        "secret_key": "x0qeukm69zxcr1v2", 
        "secret_iv": "yc0u8pqafjebg9td", 
        "blacklist": [
          "www.baidu.com", 
          "pythoner.com"
        ], 
        "whitelist": [
          "finupgroup.com", 
          "puhuitech.cn", 
          "finupcloud.com"
        ], 
        "enabled_monitor_operation": [
          "count", 
          "search", 
          "modify", 
          "delete"
        ], 
        "config_update_frequency": 300, 
        "cache_expire_time": 14400, 
        "heartbeat_frequency": 60
      }, 
      "monitor_config": {
        "mobile_count": {
          "operation": 1, 
          "url": "*", 
          "match_type": 1, 
          "match_rule": "(\\\\D)((13[0-9])|(14[5,7])|(15[0-3,5-9])|(17[0,3,5-8])|(18[0-9])|166|198|199|147)\\\\d{8}(?![\\dXx])"
        }, 
        "idcard_count": {
          "operation": 1, 
          "url": "*", 
          "match_type": 1, 
          "match_rule": "[1-9]\\\\d{5}(19|20)\\\\d{2}((0[1-9])|(10|11|12))(([0-2][1-9])|10|20|30|31)\\\\d{3}[0-9Xx](?=\\\\D)"
        }, 
        "bankcard_count": {
          "operation": 1, 
          "url": "*", 
          "match_type": 1, 
          "match_rule": "(1[08]|3[057]|4[0-9]|5[0-6]|58|6[02589]|8[478]|9[4589])\\\\d{13,17}(?=\\\\D)"
        }, 
        "desensitive_count": {
          "operation": 1, 
          "url": "*", 
          "match_type": 1, 
          "match_rule": "\\\\d+\\*{2,}\\\\d+"
        }, 
        "username_finupcloud": {
          "operation": 2, 
          "url": "www.finupcloud.com", 
          "match_type": 2, 
          "match_rule": "#profile > main > div.profile.header > div.paas-header-profile.header-right > ul > li.el-submenu > div > span"
        }
      }
    };
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['config'], items => {
        if (items.hasOwnProperty('config')) {
          resolve(items['config']);
        } else {
          resolve(defaultConfig);
        }
      });
    });
  }

  isObject(value) {
    var type = typeof value;
    return value != null && (type == 'object' || type == 'function');
  }

  async getFormattedConfig() {
    const syncObject = (target, origin) => {
      for (let key in target) {
        if (null !== origin[key]) {
          if (Array.isArray(origin[key])) {
            target[key] = JSON.parse(JSON.stringify(origin[key]));
          } else if (this.isObject(origin[key])) {
            syncObject(target[key], origin[key]);
          } else {
            target[key] = origin[key];
          }
        } else {
        }
      }
    };
    const config = await this.getConfig();
    // console.log('config');
    // console.log(config);
    var formattedConfig = {
      version: null,
      'system_config': {
        'secret_key': null,
        'secret_iv': null
      }
    }
    syncObject(formattedConfig, config);
    formattedConfig['monitor_config'] = {};
    for (let key in config['monitor_config']) {
      var value = config['monitor_config'][key];
      if (value.operation === 1) {
        formattedConfig['monitor_config'][key] = value;
        formattedConfig['monitor_config'][key]['re'] = new RegExp(value['match_rule'], 'g');
      }
    }
    return formattedConfig;
  }
  
  saveConfig(config) {
    try {
      chrome.storage.local.set({config}, () => {});
    } catch (err) {
      console.log(err);
    }
  }

  showStorage() {
    chrome.storage.local.get(null, items => {
      console.log(items);
    });
  }

  get(path) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `${this.host}${path}`);
      xhr.send(null);
      xhr.onreadystatechange = function() {
        if(xhr.readyState === 4 && xhr.status === 200) {
          var res = xhr.responseText;
          try {
            res = JSON.parse(xhr.responseText);
          } catch (err) {}
          // resp = JSON.parse(xhr.responseText);
          // code = resp.code;
          // if (code == "2001") {
          //   console.log(resp);
          //   key = resp.key;
          //   iv = resp.iv;
          //   port.postMessage({"key": key, "iv": iv});
          //   chrome.storage.local.set({"secretkey": key, "secretiv": iv});
          // }
          console.log(res);
          resolve(res);
        }
      };
      xhr.onerror = err => {
        reject(err);
      };
    });

  }

  post(path, data) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      var formData = new FormData();
      if (data) {
        for (let key in data) {
          formData.append(key, data[key]);
        }
      }
      xhr.open('POST', `${this.host}${path}`);
      xhr.send(formData);
      xhr.onreadystatechange = function() {
        if(xhr.readyState === 4 && xhr.status === 200) {
          var res = xhr.responseText;
          try {
            res = JSON.parse(xhr.responseText);
          } catch (err) {}
          // resp = JSON.parse(xhr.responseText);
          // code = resp.code;
          // if (code == "2001") {
          //   console.log(resp);
          //   key = resp.key;
          //   iv = resp.iv;
          //   port.postMessage({"key": key, "iv": iv});
          //   chrome.storage.local.set({"secretkey": key, "secretiv": iv});
          // }
          resolve(res);
        }
      };
      xhr.onerror = err => {
        reject(err);
      };
    });
  }

  async postPageInfo(pageInfo) {
    const config = await this.getFormattedConfig();
    // console.log(config);
    const message = {};
    for (let key in config['monitor_config']) {
      const value = config['monitor_config'][key];
      var count = 0;
      while (value.re.exec(pageInfo.content)) {
        count++;
      }
      message[key] = count;
    }
    const payload = {
      version: config.version,
      username: '',
      url: pageInfo.url,
      title: pageInfo.title,
      message: utils.encrypt(JSON.stringify(message), config['system_config']['secret_key'], config['system_config']['secret_iv'])
    }
    // console.log(payload);
    // TODO: new url
    try {
      const res = await this.post('/api/post', pageInfo);
      console.log(res);
    } catch (err) {
      console.log(err);
    }
  }
}