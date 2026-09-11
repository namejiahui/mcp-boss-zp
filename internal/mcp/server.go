package mcp

import (
	"github.com/mark3labs/mcp-go/server"
	"github.com/namejiahui/mcp-boss-zp/internal/boss"
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

	return &Server{
		mcpServer:   s,
		bossService: bossService,
	}
}

func (s *Server) GetMCPServer() *server.MCPServer {
	return s.mcpServer
}
