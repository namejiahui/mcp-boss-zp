## 当前持续施工中...

### 简介

这是一个 [mcp](https://modelcontextprotocol.io/introduction) 服务器，提供大模型访问 boss 直聘部分接口的能力，让大模型替代用户人工筛选工作岗位并向 boss 打招呼

### 快速预览

1. 配置
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
        "COOKIE": "输入boss发送请求时所需要携带的cookie"
        "BST": "打招呼接口所需参数"
      },
      "disabled": false
    }
  }
}
```
2. 一次获取工作列表的对话示例
   
![image](https://github.com/user-attachments/assets/d0c2f09d-b63e-42f0-81b4-5b2aaa7fef90)

![image](https://github.com/user-attachments/assets/6c19813c-156c-4542-a2d4-065662949284)

![image](https://github.com/user-attachments/assets/2dab91dc-a516-489b-a060-68362c30e93e)

中间因为更新后没有重启，所以有一些无效的对话，被我略去了，但是不影响结果

### 待办事项

- [x] 提供访问 boss 直聘推荐工作列表的资源
- [x] 提供打招呼的资源
- [ ] 提供获取消息信息的资源
- [ ] docker 构建方式
- [ ] deubg配置
