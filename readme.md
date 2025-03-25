## 当前持续施工中...

### 简介

这是一个 [mcp](https://modelcontextprotocol.io/introduction) 服务器，提供大模型访问 boss 直聘部分接口的能力，让大模型替代用户人工筛选工作岗位并向 boss 打招呼

### 快速预览

### 如何使用

```
{
  "mcpServers": {
    "mcp-boss-zp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-boss-zp"
      ],
      "env": {
        "Cookie": "输入boss发送请求时所需要携带的cookie"
      },
      "disabled": false
    }
  }
}
```

### 待办事项

- [x] 提供访问 boss 直聘推荐工作列表的资源
- [ ] 提供打招呼的资源
- [ ] 提供获取消息信息的资源
- [ ] docker 构建方式
