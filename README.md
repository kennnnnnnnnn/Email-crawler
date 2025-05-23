# 邮箱抓取工具

这是一个简单的邮箱抓取工具，可以从网页中抓取邮箱地址并保存到本地。

## 系统要求

- Node.js (v14.0.0 或更高版本)
- 现代浏览器 (Chrome, Firefox, Edge 等)

## 安装步骤

1. 下载并安装 [Node.js](https://nodejs.org/)
2. 解压缩本应用程序到任意文件夹
3. 打开命令行终端，进入应用程序文件夹
4. 运行以下命令安装依赖：

```
npm install
```

## 使用方法

### 开发模式

1. 在终端中运行：

```
npm run dev
```

2. 这将同时启动前端开发服务器和后端API服务器
3. 浏览器将自动打开 http://localhost:5173

### 生产模式

1. 在终端中运行：

```
npm run start
```

2. 这将构建前端应用并启动服务器
3. 在浏览器中访问 http://localhost:3001

## 应用功能

1. 在输入框中输入要抓取的网址（例如：example.com）
2. 点击"抓取邮箱"按钮
3. 抓取到的邮箱将显示在页面上
4. 点击"显示所有已抓取的邮箱"按钮可以查看所有历史抓取的邮箱

## 注意事项

- 所有抓取到的邮箱将保存在应用程序目录中的 `email.json` 文件中
- 应用程序运行时请勿关闭终端窗口
- 如果遇到问题，请尝试重新启动应用程序
