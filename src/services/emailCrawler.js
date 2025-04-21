import axios from 'axios';

/**
 * 从URL中抓取邮箱地址
 * @param {string} url - 要抓取的网页URL
 * @returns {Promise<{emails: string[], allEmails: string[]}>} - 返回找到的邮箱地址数组
 */
export const crawlEmailsFromUrl = async (url) => {
  console.log('准备抓取邮箱，URL:', url);
  
  try {
    // 先测试API服务器是否正常工作
    try {
      const testResponse = await axios.get('/api/test');
      console.log('API服务器测试结果:', testResponse.data);
    } catch (testError) {
      console.error('API服务器测试失败:', testError);
      // 如果测试失败，尝试使用完整URL
      throw new Error(`API服务器连接失败: ${testError.message}`);
    }
    
    // 使用后端API抓取邮箱
    console.log('发送抓取请求到API...');
    const response = await axios.post('/api/crawl-emails', { url });
    console.log('收到API响应:', response.data);
    
    return {
      emails: response.data.emails,
      allEmails: response.data.allEmails
    };
  } catch (error) {
    console.error('抓取邮箱时出错:', error);
    if (error.response) {
      // 服务器响应了，但状态码不在2xx范围内
      console.error('服务器错误:', error.response.status, error.response.data);
      throw new Error(`服务器错误 ${error.response.status}: ${error.response.data.error || '未知错误'}`);
    } else if (error.request) {
      // 请求已发送，但没有收到响应
      console.error('没有收到服务器响应:', error.request);
      throw new Error('服务器没有响应，请检查API服务器是否运行');
    } else {
      // 请求配置有问题
      throw new Error(`请求出错: ${error.message}`);
    }
  }
};

/**
 * 获取所有历史邮箱记录
 * @param {Object} options - 查询选项
 * @param {string} [options.startDate] - 开始日期，ISO格式 (YYYY-MM-DD)
 * @param {string} [options.endDate] - 结束日期，ISO格式 (YYYY-MM-DD)
 * @returns {Promise<Array>} - 返回邮箱记录数组
 */
export const getAllEmails = async (options = {}) => {
  try {
    const { startDate, endDate } = options;
    let url = '/api/all-emails';
    
    // 添加查询参数
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await axios.get(url);
    return response.data.emails;
  } catch (error) {
    console.error('获取所有邮箱时出错:', error);
    throw new Error(`获取邮箱记录失败: ${error.message}`);
  }
};

/**
 * 删除单个邮箱记录
 * @param {string} id - 要删除的邮箱记录ID
 * @returns {Promise<Array>} - 返回更新后的邮箱记录数组
 */
export const deleteEmail = async (id) => {
  try {
    const response = await axios.delete(`/api/email/${id}`);
    return response.data.emails;
  } catch (error) {
    console.error('删除邮箱记录时出错:', error);
    throw new Error(`删除邮箱记录失败: ${error.message}`);
  }
};

/**
 * 清空所有邮箱记录
 * @returns {Promise<boolean>} - 操作是否成功
 */
export const clearAllEmails = async () => {
  try {
    const response = await axios.delete('/api/emails');
    return response.data.success;
  } catch (error) {
    console.error('清空邮箱记录时出错:', error);
    throw new Error(`清空邮箱记录失败: ${error.message}`);
  }
};
