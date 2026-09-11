package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/namejiahui/mcp-boss-zp/internal/boss"
	"github.com/namejiahui/mcp-boss-zp/internal/browser"
	"github.com/namejiahui/mcp-boss-zp/internal/config"
	mcpServer "github.com/namejiahui/mcp-boss-zp/internal/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var (
	Version   = "dev"
	showVer   = flag.Bool("version", false, "显示版本号")
	headless  = flag.Bool("headless", false, "是否以无头模式启动浏览器 (若未登录建议保持 false)")
	customDir = flag.String("profile", "", "自定义 Chrome 用户数据目录")
	chromeBin = flag.String("chrome-bin", "", "自定义 Chrome/Edge 浏览器可执行文件路径")
)

func main() {
	flag.Parse()

	if *showVer {
		fmt.Printf("mcp-boss-zp version %s\n", Version)
		return
	}

	log.SetOutput(os.Stderr)
	log.SetPrefix("[BOSS-MCP] ")
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)

	log.Printf("启动 BOSS 直聘 MCP 自动化服务 (v%s)...", Version)

	cfg := config.LoadConfig()
	if *headless {
		cfg.Headless = true
	}
	if *customDir != "" {
		cfg.UserDataDir = *customDir
	}
	if *chromeBin != "" {
		cfg.ChromeBin = *chromeBin
	}

	bm := browser.NewBrowserManager(cfg)
	defer bm.Close()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		_ = bm.Close()
		os.Exit(0)
	}()

	bossService := boss.NewBossService(bm)
	srv := mcpServer.NewServer(bossService, Version)

	stdioServer := server.NewStdioServer(srv.GetMCPServer())
	if err := stdioServer.Listen(context.Background(), os.Stdin, os.Stdout); err != nil {
		log.Printf("Stdio 监听退出: %v", err)
	}
}
