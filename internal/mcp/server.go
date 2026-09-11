package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/namejiahui/mcp-boss-zp/internal/boss"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type Server struct {
	mcpServer   *server.MCPServer
	bossService *boss.BossService
}

func NewServer(bossService *boss.BossService, version string) *Server {
	s := server.NewMCPServer(
		"mcp-boss-zp",
		version,
		server.WithDescription("BOSS 直聘大模型辅助工具（所见即所得：直接读取当前浏览器屏幕岗位，真实点击打招呼）"),
	)

	srv := &Server{
		mcpServer:   s,
		bossService: bossService,
	}

	srv.registerTools()
	srv.registerPrompts()

	return srv
}

func (s *Server) GetMCPServer() *server.MCPServer {
	return s.mcpServer
}

func (s *Server) registerTools() {
	getJobsTool := mcp.NewTool("get_current_jobs",
		mcp.WithDescription("读取当前 BOSS 直聘浏览器窗口中正在展示的真实职位列表。所见即所得，包含每个职位的序号、名称、薪资、公司、技能标签以及是否已沟通过"),
	)

	s.mcpServer.AddTool(getJobsTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		jobs, err := s.bossService.GetVisibleJobs(ctx)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("读取页面职位失败: %v", err)), nil
		}

		if len(jobs) == 0 {
			return mcp.NewToolResultText("当前页面暂未检测到职位卡片，请确认页面是否已加载完毕。"), nil
		}

		bytes, err := json.MarshalIndent(jobs, "", "  ")
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("格式化结果失败: %v", err)), nil
		}

		return mcp.NewToolResultText(string(bytes)), nil
	})

	greetTool := mcp.NewTool("greet_job",
		mcp.WithDescription("根据 get_current_jobs 返回的职位序号 (index)，在浏览器页面上真实点击该职位的【立即沟通】按钮"),
		mcp.WithNumber("cardIndex", mcp.Description("要沟通的职位序号 (例如：1 代表第 1 个职位)"), mcp.Required()),
	)

	s.mcpServer.AddTool(greetTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		cardIndex, err := req.RequireInt("cardIndex")
		if err != nil {
			return mcp.NewToolResultError("缺少必填参数 cardIndex: " + err.Error()), nil
		}

		res, err := s.bossService.GreetJob(ctx, cardIndex)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("打招呼失败: %v", err)), nil
		}

		return mcp.NewToolResultText(fmt.Sprintf("✅ %s", res.Message)), nil
	})
}

func (s *Server) registerPrompts() {
	matchPrompt := mcp.NewPrompt(
		"recommend-and-greet",
		mcp.WithPromptDescription("读取当前屏幕上的职位卡片，智能挑选最匹配的岗位，在用户确认后点击沟通"),
		mcp.WithArgument("profile", mcp.ArgumentDescription("个人技能、经验与求职期望简要描述"), mcp.RequiredArgument()),
	)

	s.mcpServer.AddPrompt(matchPrompt, func(ctx context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
		profile := req.Params.Arguments["profile"]
		promptText := fmt.Sprintf(`你是一个专业的智能求职助手。当前用户的背景与诉求如下：
"%s"

请按照以下真实页面协同流程进行操作：
1. 首先调用 get_current_jobs 工具，获取用户当前浏览器屏幕上肉眼可见的岗位列表。
2. 仔细分析每个岗位的职位名称、薪资、公司信息和技能标签，挑出与用户最匹配的 2~3 个岗位。
3. 清晰向用户展示这几个岗位的序号 (cardIndex)、名称、薪资及匹配理由，并询问用户是否需要向它们打招呼。
4. 在得到用户确认后，调用 greet_job(cardIndex) 在页面上逐一触发真实沟通。`, profile)

		return &mcp.GetPromptResult{
			Description: "真实页面职位匹配与沟通流程",
			Messages: []mcp.PromptMessage{
				{
					Role: mcp.RoleUser,
					Content: mcp.TextContent{
						Type: "text",
						Text: promptText,
					},
				},
			},
		}, nil
	})
}
