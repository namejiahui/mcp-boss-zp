# mcp-boss-zp

基于 **Go + `go-rod/rod` (CDP) + `mark3labs/mcp-go`** 的 BOSS 直聘大模型自动化辅助 MCP 服务。

---

## 🌟 核心特性与优势

- **🎯 模拟人类真实交互**：提供必要的工具让大模型直接与真实页面交互（如浏览岗位、模拟点击沟通），完全避免逆向私有 API，具备更高的抗反爬能力。
- **🛡 零抓包与深度防风控**：无需抓包或手动复制 Cookie，首次弹窗扫码后自动持久化会话；基于 `rod/stealth` 抹除自动化指纹。
- **⚡ 原生单二进制（零环境依赖）**：基于 Go 静态编译，跨平台原生运行，无需安装 Node.js、Python 等任何运行时环境。
- **🥷 灵活运行（支持 Headless）**：既支持有界面模式方便首次扫码登录，也支持无头静默模式（添加 `-headless` 参数或环境变量 `BOSS_HEADLESS=true`）在后台免打扰运行。

---

## 🛠 提供的 MCP 工具 (Tools)

1. **`get_current_jobs`**：
   - 读取当前 BOSS 直聘浏览器窗口中正在展示的真实职位列表；
   - 返回每个职位的序号 (`index`: 1, 2, 3...)、名称、薪资、公司、技能标签、HR 身份以及是否此前已沟通过。
2. **`greet_job`**(测试中...)：
   - 入参：`cardIndex` (number, 必填)：要沟通的职位序号（如 `1` 代表第 1 个职位）；
   - 动作：自动在页面上找到该卡片的【立即沟通】按钮并模拟真实点击。若此前已沟通过，会自动识别并提示。

---

## 🚀 快速使用 (MCP 客户端配置)

你可以根据你的环境，选择最适合的一种启动方式：

### 方式一：通过 `npx` 启动（推荐：适合已安装 Node.js 的用户）

如果你的电脑**已安装了 Node.js (带有 npx)**，无需手动下载管理文件，配置后客户端会自动拉取当前系统架构匹配的原生二进制并启动：

```json
{
  "mcpServers": {
    "boss-zp": {
      "command": "npx",
      "args": ["-y", "mcp-boss-zp"]
    }
  }
}
```

---

### 方式二：独立预编译二进制（真正零依赖：完全无需 Node.js 或任何运行环境）

如果你的电脑**未安装 Node.js**，或追求极简的原生单文件运行：

1. **手动下载**：前往 [GitHub Releases](https://github.com/namejiahui/mcp-boss-zp/releases) 下载适配你系统架构的单文件二进制（如 Windows 下载 `.exe`，macOS 下载对应 `arm64`/`amd64`）。
2. **包管理器（规划支持中）**：后续将支持通过 Homebrew / Scoop 等系统级包管理器一键安装与全局升级。
3. 在 MCP 配置文件中直接指定下载文件的本地存放路径：

```json
{
  "mcpServers": {
    "boss-zp": {
      "command": "/本地存放路径/mcp-boss-zp"
    }
  }
}
```

---

## 💻 本地开发常用命令

本项目使用 [just](https://github.com/casey/just) 进行本地开发编排：

```bash
# 查看所有支持的命令
just

# 构建当前平台可执行文件至 bin/
just build

# 本地直接运行开发模式
just run

# 代码静态检查 (staticcheck & go vet)
just lint

# 清理构建产物与下载缓存
just clean
```

---

## 📄 License
[MIT](LICENSE)
