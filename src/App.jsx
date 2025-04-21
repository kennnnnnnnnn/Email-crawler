import { useState, useEffect, useRef } from 'react'
import './App.css'
import { crawlEmailsFromUrl, getAllEmails, deleteEmail, clearAllEmails } from './services/emailCrawler'
import axios from 'axios'

function App() {
  const [urls, setUrls] = useState('');
  const [crawlResults, setCrawlResults] = useState([]);
  const [allEmails, setAllEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAllEmails, setShowAllEmails] = useState(false);
  const [currentlyProcessing, setCurrentlyProcessing] = useState(null);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const copyTimeoutRef = useRef(null);
  const isEffectRunningRef = useRef(false);

  const fetchAllEmails = async (options = {}) => {
    try {
      setLoading(true);
      const emails = await getAllEmails(options);
      setAllEmails(emails);
      setShowAllEmails(true);
      setError(null);
      // 重置选择状态
      setSelectedEmails(new Set());
      setSelectAll(false);
    } catch (err) {
      setError('获取所有邮箱时出错: ' + err.message);
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  };

  useEffect(() => {
    fetchAllEmails();
  }, []);

  // 处理全选/取消全选
  useEffect(() => {
    // 避免与另一个useEffect产生循环依赖
    if (isEffectRunningRef.current) return;
    
    isEffectRunningRef.current = true;
    
    if (selectAll) {
      const allIds = allEmails.map(item => item.id);
      setSelectedEmails(new Set(allIds));
    } else if (selectedEmails.size === allEmails.length) {
      // 仅当手动点击取消全选时才清空所有选择
      setSelectedEmails(new Set());
    }
    
    isEffectRunningRef.current = false;
  }, [selectAll, allEmails]);

  // 处理选中状态变化时更新全选状态
  useEffect(() => {
    // 避免与另一个useEffect产生循环依赖
    if (isEffectRunningRef.current) return;
    
    isEffectRunningRef.current = true;
    
    const allSelected = allEmails.length > 0 && selectedEmails.size === allEmails.length;
    // 只有当当前状态与期望状态不同时才更新
    if (allSelected !== selectAll) {
      setSelectAll(allSelected);
    }
    
    isEffectRunningRef.current = false;
  }, [selectedEmails, allEmails]);

  const handleFilter = async (e) => {
    e.preventDefault();
    setIsFiltering(true);
    await fetchAllEmails({
      startDate: filterStartDate,
      endDate: filterEndDate
    });
  };

  const resetFilter = async () => {
    setFilterStartDate('');
    setFilterEndDate('');
    await fetchAllEmails();
  };

  const handleDeleteEmail = async (id) => {
    try {
      setIsDeleting(true);
      const updatedEmails = await deleteEmail(id);
      setAllEmails(updatedEmails);
      // 从已选择集合中移除
      const newSelected = new Set(selectedEmails);
      newSelected.delete(id);
      setSelectedEmails(newSelected);
    } catch (err) {
      setError('删除邮箱记录时出错: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllEmails = async () => {
    try {
      setIsDeleting(true);
      await clearAllEmails();
      setAllEmails([]);
      setSelectedEmails(new Set());
      setSelectAll(false);
      setShowDeleteConfirm(false);
    } catch (err) {
      setError('清空邮箱记录时出错: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '未知时间';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleEmailSelection = (id) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEmails(newSelected);
  };

  const toggleSelectAll = () => {
    setSelectAll(!selectAll);
  };

  const getSelectedEmailAddresses = () => {
    if (selectedEmails.size === 0) return [];
    return allEmails
      .filter(item => selectedEmails.has(item.id))
      .map(item => item.email);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess('复制成功!');
      
      // 清除之前的超时
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      
      // 设置新的超时，3秒后清除成功消息
      copyTimeoutRef.current = setTimeout(() => {
        setCopySuccess('');
      }, 3000);
    } catch (err) {
      setCopySuccess('复制失败！');
      console.error('复制失败:', err);
    }
  };

  const copySelectedEmails = () => {
    const emails = getSelectedEmailAddresses();
    if (emails.length > 0) {
      copyToClipboard(emails.join('\n'));
    }
  };

  const copyAllCrawledEmails = (result) => {
    if (result.emails && result.emails.length > 0) {
      copyToClipboard(result.emails.join('\n'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!urls.trim()) return;

    setLoading(true);
    setError(null);
    setShowAllEmails(false);
    setCrawlResults([]);
    
    try {
      // 将输入的URLs分割成数组，去除空行
      const urlList = urls.split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);
      
      // 逐个处理URL
      for (const url of urlList) {
        try {
          setCurrentlyProcessing(url);
          const response = await crawlEmailsFromUrl(url);
          setCrawlResults(prev => [...prev, { 
            url, 
            emails: response.emails,
            error: null,
            status: 'success'
          }]);
          setAllEmails(response.allEmails);
        } catch (err) {
          setCrawlResults(prev => [...prev, { 
            url, 
            emails: [],
            error: err.message,
            status: 'error'
          }]);
        }
      }
      
      setCurrentlyProcessing(null);
    } catch (err) {
      setError('处理URL时出错: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {copySuccess && (
        <div className="copy-notification">
          <span>{copySuccess}</span>
        </div>
      )}
      
      <div className="app-header">
        <div className="header-content">
          <h1>邮箱抓取工具</h1>
          <p className="description">批量输入网址（一行一个），自动抓取页面上的所有邮箱地址</p>
        </div>
      </div>

      <div className="main-container">
        <div className="sidebar">
          <div className="card">
            <div className="card-header">
              <h2>输入网址</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit} className="url-form">
                <div className="form-group">
                  <textarea
                    value={urls}
                    onChange={(e) => setUrls(e.target.value)}
                    placeholder="输入网址（一行一个，例如: example.com）"
                    className="url-textarea"
                    rows="15"
                  />
                </div>
                <div className="buttons-group">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? (
                      <span>
                        <span className="spinner"></span>
                        <span>抓取中...</span>
                      </span>
                    ) : (
                      <span>开始抓取</span>
                    )}
                  </button>
                  
                  <button
                    onClick={fetchAllEmails}
                    className="btn btn-secondary"
                    disabled={loading}
                    type="button"
                  >
                    查看历史记录
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        
        <div className="content">
          {error && (
            <div className="alert alert-error">
              <span className="alert-icon">⚠️</span>
              {error}
            </div>
          )}
          
          {showAllEmails ? (
            <div className="card">
              <div className="card-header">
                <h2>历史抓取记录 ({allEmails.length})</h2>
                <div className="header-actions">
                  <button
                    onClick={() => setShowAllEmails(false)}
                    className="btn btn-icon"
                    aria-label="返回"
                  >
                    <span>←</span>
                  </button>
                </div>
              </div>
              
              <div className="card-toolbar">
                <form onSubmit={handleFilter} className="filter-form">
                  <div className="filter-group">
                    <div className="filter-field">
                      <label htmlFor="startDate">开始日期:</label>
                      <input
                        type="date"
                        id="startDate"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="date-input"
                      />
                    </div>
                    <div className="filter-field">
                      <label htmlFor="endDate">结束日期:</label>
                      <input
                        type="date"
                        id="endDate"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="date-input"
                      />
                    </div>
                    <div className="filter-actions">
                      <button 
                        type="submit" 
                        className="btn btn-small" 
                        disabled={isFiltering || loading}
                      >
                        {isFiltering ? (
                          <span>
                            <span className="spinner spinner-small"></span>
                            <span>筛选中...</span>
                          </span>
                        ) : (
                          <span>应用筛选</span>
                        )}
                      </button>
                      {(filterStartDate || filterEndDate) && (
                        <button 
                          type="button" 
                          className="btn btn-small btn-text" 
                          onClick={resetFilter}
                          disabled={isFiltering || loading}
                        >
                          重置
                        </button>
                      )}
                    </div>
                  </div>
                </form>
                
                <div className="toolbar-actions">
                  {selectedEmails.size > 0 && (
                    <button 
                      type="button" 
                      className="btn btn-small btn-primary"
                      onClick={copySelectedEmails}
                    >
                      复制已选 ({selectedEmails.size})
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="btn btn-small btn-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={allEmails.length === 0 || isDeleting}
                  >
                    清空记录
                  </button>
                </div>
              </div>
              
              {showDeleteConfirm && (
                <div className="delete-confirm">
                  <div className="delete-confirm-content">
                    <p>确定要清空所有邮箱记录吗？此操作无法撤销。</p>
                    <div className="delete-confirm-actions">
                      <button 
                        type="button" 
                        className="btn btn-small btn-danger"
                        onClick={handleClearAllEmails}
                        disabled={isDeleting}
                      >
                        {isDeleting ? '处理中...' : '确认清空'}
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-small"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeleting}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="card-body">
                {loading && (
                  <div className="loading-overlay">
                    <div className="spinner spinner-large"></div>
                    <span>加载中...</span>
                  </div>
                )}
                
                {allEmails.length > 0 ? (
                  <>
                    <div className="select-all-container">
                      <label className="checkbox-container">
                        <input 
                          type="checkbox" 
                          checked={selectAll} 
                          onChange={toggleSelectAll}
                          className="checkbox-input"
                        />
                        <span className="checkbox-custom"></span>
                        <span className="checkbox-label">全选</span>
                      </label>
                    </div>
                    
                    <ul className="email-list">
                      {allEmails.map((item) => (
                        <li key={item.id} className={`email-item ${selectedEmails.has(item.id) ? 'selected' : ''}`}>
                          <div className="email-item-content">
                            <label className="checkbox-container email-checkbox">
                              <input 
                                type="checkbox" 
                                checked={selectedEmails.has(item.id)} 
                                onChange={() => toggleEmailSelection(item.id)}
                                className="checkbox-input"
                              />
                              <span className="checkbox-custom"></span>
                            </label>
                            <div className="email-info">
                              <span className="email-text">{item.email}</span>
                              <div className="email-meta">
                                <span className="email-time">{formatDateTime(item.timestamp)}</span>
                                <span className="email-source">{item.source}</span>
                              </div>
                            </div>
                            <div className="email-actions">
                              <button
                                onClick={() => copyToClipboard(item.email)}
                                className="btn btn-icon btn-copy"
                                aria-label="复制"
                                title="复制邮箱"
                              >
                                <span>📋</span>
                              </button>
                              <button
                                onClick={() => handleDeleteEmail(item.id)}
                                className="btn btn-icon btn-delete"
                                disabled={isDeleting}
                                aria-label="删除"
                                title="删除记录"
                              >
                                <span>×</span>
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">📭</span>
                    <span>没有找到任何邮箱</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <h2>抓取结果</h2>
              </div>
              <div className="card-body">
                {loading && currentlyProcessing && (
                  <div className="processing-status">
                    <span className="spinner"></span>
                    <span>正在处理: {currentlyProcessing}</span>
                  </div>
                )}
                
                {crawlResults.length > 0 ? (
                  <div className="result-list">
                    {crawlResults.map((result, index) => (
                      <div key={index} className={`result-card ${result.status}`}>
                        <div className="result-header">
                          <span className="result-status-icon">
                            {result.status === 'success' ? '✓' : '✗'}
                          </span>
                          <h3 className="result-url">{result.url}</h3>
                          {result.status === 'success' && result.emails.length > 0 && (
                            <button 
                              className="btn btn-small btn-copy" 
                              onClick={() => copyAllCrawledEmails(result)}
                              title="复制所有邮箱"
                            >
                              一键复制
                            </button>
                          )}
                        </div>
                        <div className="result-body">
                          {result.error ? (
                            <div className="result-error">
                              <span className="error-message">{result.error}</span>
                            </div>
                          ) : (
                            <>
                              <div className="result-stat">
                                <span className="stat-label">找到邮箱:</span>
                                <span className="stat-value">{result.emails.length}</span>
                              </div>
                              {result.emails.length > 0 && (
                                <div className="result-emails">
                                  <ul className="email-pills">
                                    {result.emails.map((email, emailIndex) => (
                                      <li 
                                        key={emailIndex} 
                                        className="email-pill" 
                                        onClick={() => copyToClipboard(email)}
                                        title="点击复制"
                                      >
                                        {email}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !loading && (
                  <div className="empty-state">
                    <span className="empty-icon">🔍</span>
                    <span>尚未抓取任何邮箱</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App
