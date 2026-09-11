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
}
