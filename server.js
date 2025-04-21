const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// 启用CORS
app.use(cors());
app.use(express.json());

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// 测试API
app.get('/api/test', (req, res) => {
  console.log('测试API被调用');
  res.json({ message: 'API服务器正常运行' });
});

// 读取邮件数据
const getEmailData = () => {
  const emailJsonPath = path.join(__dirname, 'email.json');
  try {
    if (fs.existsSync(emailJsonPath)) {
      const emailData = fs.readFileSync(emailJsonPath, 'utf8');
      return JSON.parse(emailData);
    }
    return [];
  } catch (error) {
    console.error('读取email.json文件时出错:', error);
    return [];
  }
};

// 保存邮件数据
const saveEmailData = (data) => {
  const emailJsonPath = path.join(__dirname, 'email.json');
  try {
    fs.writeFileSync(emailJsonPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('保存email.json文件时出错:', error);
    return false;
  }
};

// 生成唯一ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// 邮箱抓取API
app.post('/api/crawl-emails', async (req, res) => {
  console.log('收到抓取邮箱请求:', req.body);
  try {
    let { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: '缺少URL参数' });
    }

    // 验证URL格式
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    console.log('抓取邮箱的URL:', url);

    // 发送HTTP请求获取页面内容
    const response = await axios.get(url);
    const html = response.data;

    // 使用cheerio加载HTML
    const $ = cheerio.load(html);

    // 使用正则表达式匹配邮箱
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = [];

    // 从所有的<a href="mailto:...">标签中提取邮箱
    $('a[href^="mailto:"]').each(function() {
      const href = $(this).attr('href');
      const email = href.replace('mailto:', '').split('?')[0];
      if (email && email.match(emailRegex)) {
        emails.push(email);
      }
    });

    // 从文本中提取邮箱
    const bodyText = $('body').text();
    const textEmails = bodyText.match(emailRegex) || [];
    emails.push(...textEmails);

    // 去重
    const uniqueEmails = [...new Set(emails)];
    console.log('抓取到的邮箱:', uniqueEmails);

    // 读取现有的email.json文件
    let allEmails = getEmailData();
    
    // 检查是否需要迁移旧数据格式（简单数组）到新格式（对象数组）
    if (allEmails.length > 0 && typeof allEmails[0] === 'string') {
      // 将旧数据转换为新格式
      allEmails = allEmails.map(email => ({
        id: generateId(),
        email: email,
        timestamp: new Date().toISOString(),
        source: url
      }));
    }

    // 将新抓取的邮箱转换为带ID和时间戳的对象
    const now = new Date().toISOString();
    const newEmailObjects = uniqueEmails.map(email => ({
      id: generateId(),
      email: email,
      timestamp: now,
      source: url
    }));

    // 合并新抓取的邮箱和现有的邮箱，并去重
    const emailSet = new Set();
    const mergedEmails = [...allEmails];
    
    for (const newEmail of newEmailObjects) {
      if (!emailSet.has(newEmail.email)) {
        emailSet.add(newEmail.email);
        
        // 检查是否已存在
        const existingIndex = mergedEmails.findIndex(item => item.email === newEmail.email);
        if (existingIndex === -1) {
          mergedEmails.push(newEmail);
        }
      }
    }

    // 将合并后的邮箱列表保存到email.json文件中
    saveEmailData(mergedEmails);

    res.json({ 
      emails: uniqueEmails, 
      allEmails: mergedEmails 
    });
  } catch (error) {
    console.error('抓取邮箱时出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取所有已保存的邮箱
app.get('/api/all-emails', (req, res) => {
  try {
    // 获取查询参数
    const { startDate, endDate } = req.query;
    
    // 获取所有邮箱
    let allEmails = getEmailData();
    
    // 检查是否需要迁移旧数据格式
    if (allEmails.length > 0 && typeof allEmails[0] === 'string') {
      allEmails = allEmails.map(email => ({
        id: generateId(),
        email: email,
        timestamp: new Date().toISOString(),
        source: '未知来源'
      }));
      saveEmailData(allEmails);
    }
    
    // 根据时间过滤
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Date.now();
      
      allEmails = allEmails.filter(item => {
        const itemTime = new Date(item.timestamp).getTime();
        return itemTime >= start && itemTime <= end;
      });
    }
    
    res.json({ emails: allEmails });
  } catch (error) {
    console.error('读取email.json文件时出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除单个邮箱记录
app.delete('/api/email/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: '缺少ID参数' });
    }
    
    // 读取现有邮箱
    let allEmails = getEmailData();
    
    // 查找并删除指定ID的邮箱
    const filteredEmails = allEmails.filter(item => item.id !== id);
    
    // 如果没有变化，说明ID不存在
    if (filteredEmails.length === allEmails.length) {
      return res.status(404).json({ error: '未找到指定ID的邮箱记录' });
    }
    
    // 保存更新后的数据
    saveEmailData(filteredEmails);
    
    res.json({ success: true, emails: filteredEmails });
  } catch (error) {
    console.error('删除邮箱记录时出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 清空所有邮箱记录
app.delete('/api/emails', (req, res) => {
  try {
    // 保存空数组
    saveEmailData([]);
    res.json({ success: true });
  } catch (error) {
    console.error('清空邮箱记录时出错:', error);
    res.status(500).json({ error: error.message });
  }
});

// 处理所有其他请求，返回React应用
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
