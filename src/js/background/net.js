
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
}