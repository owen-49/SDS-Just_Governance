// frontend/src/utils/apiInterceptor.js
/**
 * 统一 API 错误处理拦截器
 * 根据 API 文档第三部分的决策树实现
 */

import { authApi } from '../services/auth';

/**
 * HTTP 状态码错误消息映射
 */
const ERROR_MESSAGES = {
  // 401 相关
  unauthenticated: '请先登录',
  token_expired: '登录已过期,正在刷新...',
  token_invalid: '登录凭证无效,请重新登录',
  token_revoked: '登录凭证已失效,请重新登录',
  
  // 409 相关
  email_exists: '该邮箱已注册,请前往登录',
  already_submitted: '您已经提交过此问卷',
  unfinished_assessment_exists: '您有未完成的评测,请先完成或放弃',
  no_pending_quiz: '未找到待提交的测验,请重新开始',
  assessment_already_submitted: '该评测已提交,无法再次修改',
  
  // 422 相关
  validation_error: '输入信息格式不正确,请检查后重试',
  missing_answers: '还有题目未作答',
  
  // 403/404 相关
  forbidden: '您没有权限执行此操作',
  not_found: '请求的资源不存在',
  item_not_found: '题目不存在',
  assessment_not_found: '评测记录不存在',
  
  // 429 相关
  rate_limited: '请求太频繁,请稍后再试',
  
  // 400 相关
  insufficient_questions: '题库题目不足,无法生成测验',
  integrity_error: '数据冲突,请重试或联系管理员',
  
  // 500 相关
  internal_error: '服务器出错了,请稍后重试'
};

/**
 * 表单接口白名单（需要逐字段渲染422错误）
 */
const FORM_ENDPOINTS = [
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/onboarding/survey/submit'
];

/**
 * 判断是否为表单接口
 */
const isFormEndpoint = (url) => {
  return FORM_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

/**
 * 刷新令牌
 */
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (newToken) => {
  refreshSubscribers.forEach(callback => callback(newToken));
  refreshSubscribers = [];
};

/**
 * 处理401错误
 */
const handle401Error = async (error, originalRequest) => {
  const message = error.body?.message || 'unauthenticated';
  
  // 情况1: token_expired - 尝试刷新
  if (message === 'token_expired') {
    if (isRefreshing) {
      // 正在刷新中,等待刷新完成后重试
      return new Promise((resolve) => {
        subscribeTokenRefresh((newToken) => {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          resolve(originalRequest.retry());
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshResult = await authApi.refreshToken();
      const newToken = refreshResult.access_token;
      
      // 更新token
      localStorage.setItem('access_token', newToken);
      isRefreshing = false;
      
      // 通知等待的请求
      onTokenRefreshed(newToken);
      
      // 重试原请求
      originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
      return originalRequest.retry();
      
    } catch (refreshError) {
      // 刷新失败,跳转登录
      isRefreshing = false;
      refreshSubscribers = [];
      await authApi.logout();
      window.location.href = '/login';
      throw new Error('登录已过期,请重新登录');
    }
  }
  
  // 情况2: token_invalid / unauthenticated - 直接登出
  await authApi.logout();
  window.location.href = '/login';
  throw new Error(ERROR_MESSAGES[message] || ERROR_MESSAGES.unauthenticated);
};

/**
 * 处理422错误
 */
const handle422Error = (error, requestUrl) => {
  const message = error.body?.message || 'validation_error';
  const errors = error.body?.data?.errors;
  
  // 如果是表单接口,返回详细错误供逐字段渲染
  if (isFormEndpoint(requestUrl)) {
    return {
      type: 'validation',
      message: ERROR_MESSAGES.validation_error,
      fields: errors || []
    };
  }
  
  // 非表单接口,返回通用错误
  if (message === 'missing_answers' && errors?.missing_orders) {
    return {
      type: 'missing_answers',
      message: `还有 ${errors.missing_orders.length} 道题未作答`,
      missingOrders: errors.missing_orders
    };
  }
  
  return {
    type: 'validation',
    message: ERROR_MESSAGES[message] || ERROR_MESSAGES.validation_error
  };
};

/**
 * 处理409错误
 */
const handle409Error = (error) => {
  const message = error.body?.message || 'conflict';
  const data = error.body?.data;
  
  return {
    type: 'conflict',
    message: ERROR_MESSAGES[message] || '操作冲突,请刷新后重试',
    data
  };
};

/**
 * 处理429错误
 */
const handle429Error = (error) => {
  const retryAfter = error.headers?.['retry-after'] || 60;
  
  return {
    type: 'rate_limit',
    message: ERROR_MESSAGES.rate_limited,
    retryAfter: parseInt(retryAfter)
  };
};

/**
 * 处理其他HTTP错误
 */
const handleOtherError = (error) => {
  const status = error.status;
  const message = error.body?.message;
  
  switch (status) {
    case 400:
      return {
        type: 'bad_request',
        message: ERROR_MESSAGES[message] || '请求参数错误'
      };
      
    case 403:
      return {
        type: 'forbidden',
        message: ERROR_MESSAGES.forbidden
      };
      
    case 404:
      return {
        type: 'not_found',
        message: ERROR_MESSAGES[message] || ERROR_MESSAGES.not_found
      };
      
    case 500:
    case 502:
    case 503:
      return {
        type: 'server_error',
        message: ERROR_MESSAGES.internal_error,
        requestId: error.body?.request_id
      };
      
    default:
      return {
        type: 'unknown',
        message: '操作失败,请稍后再试'
      };
  }
};

/**
 * 统一错误处理入口
 */
export const handleApiError = async (error, originalRequest) => {
  const status = error.status;
  const requestUrl = originalRequest?.url || '';
  
  try {
    switch (status) {
      case 401:
        return await handle401Error(error, originalRequest);
        
      case 422:
        throw handle422Error(error, requestUrl);
        
      case 409:
        throw handle409Error(error);
        
      case 429:
        throw handle429Error(error);
        
      default:
        throw handleOtherError(error);
    }
  } catch (handledError) {
    // 将处理后的错误抛出
    throw handledError;
  }
};

/**
 * 创建统一的API错误类
 */
export class ApiError extends Error {
  constructor(type, message, data = null) {
    super(message);
    this.type = type;
    this.data = data;
    this.name = 'ApiError';
  }
}

/**
 * 显示错误提示（可以根据你的UI库调整）
 */
export const showErrorNotification = (error) => {
  // 这里可以集成你的通知组件
  console.error('[API Error]:', error);
  
  // 示例: 使用 alert (实际项目中应该使用 toast/notification 组件)
  if (error.type === 'validation' && error.fields) {
    // 表单验证错误
    alert(error.message + '\n\n' + JSON.stringify(error.fields, null, 2));
  } else if (error.type === 'missing_answers') {
    // 缺失答案错误
    alert(`${error.message}\n缺失题号: ${error.missingOrders.join(', ')}`);
  } else {
    // 其他错误
    alert(error.message);
  }
};

export default {
  handleApiError,
  ApiError,
  showErrorNotification
};
