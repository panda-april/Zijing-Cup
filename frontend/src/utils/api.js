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
let isHandling401 = false;

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // 用 flag 防止并发请求重复触发
      if (!isHandling401) {
        isHandling401 = true;
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        // 通知 App.jsx 处理登出和提示，而不是跳路由或弹 alert
        window.dispatchEvent(new CustomEvent('auth:expired'));
        // 短暂延迟后重置 flag，允许真正的下一次过期再次触发
        setTimeout(() => { isHandling401 = false; }, 3000);
      }
    }
    return Promise.reject(error);
  }
);

export default api; // 导出这个配置好的超级工具！