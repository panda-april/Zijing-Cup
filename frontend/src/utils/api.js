import axios from 'axios';

// 1. 创建一个专属的 Axios 实例
const api = axios.create({
  // 把你的后端主地址写在这里，以后发请求就不需要写那一长串 http://... 了
  baseURL: 'http://localhost:3000/api', 
  timeout: 10000, // 10秒超时机制，防卡死
});

// 2. 请求拦截器 (Request Interceptor) - 自动带上门禁卡
api.interceptors.request.use(
  (config) => {
    // 每次发请求前，先去浏览器的钱包里找 token
    const token = localStorage.getItem('token');
    if (token) {
      // 如果找到了，就按照行业标准加上 Bearer 前缀，塞进请求头
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. 响应拦截器 (Response Interceptor) - 统一处理过期和报错
api.interceptors.response.use(
  (response) => {
    // 如果后端正常返回数据，直接放行
    return response;
  },
  (error) => {
    // 集中处理所有的错误状态码
    if (error.response && error.response.status === 401) {
      // 401 代表未登录或 Token 失效
      alert('登录身份已过期或未授权，请重新登录！');
      
      // 清空失效的本地数据
      localStorage.removeItem('token');
      localStorage.removeItem('userName');
      
      // 强制打回登录页
      window.location.href = '/login';
    }
    
    // 把错误继续抛出，让具体页面的 catch 也能抓到做个性化提示
    return Promise.reject(error);
  }
);

export default api; // 导出这个配置好的超级工具！