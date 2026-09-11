package boss

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/namejiahui/mcp-boss-zp/internal/browser"
	"github.com/go-rod/rod"
)

var (
	//go:embed scripts/boss.js
	bossScript string
)

const (
	bossJobURL = "https://www.zhipin.com/web/geek/job"
)

type BossService struct {
	bm   *browser.BrowserManager
	page *rod.Page
	mu   sync.Mutex
}

func NewBossService(bm *browser.BrowserManager) *BossService {
	return &BossService{bm: bm}
}

// ensurePageValid 确保 BOSS 直聘页面有效且处于可用状态
func (s *BossService) ensurePageValid() (*rod.Page, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.page != nil {
		if _, err := s.page.Info(); err == nil {
			return s.page, nil
		}
		log.Println("[BossService] 检测到 BOSS 标签页已关闭或失联，正在重新打开...")
	}

	p, err := s.bm.NewStealthPage()
	if err != nil {
		return nil, fmt.Errorf("初始化 BOSS 页面失败: %w", err)
	}
	s.page = p

	log.Printf("[BossService] 正在打开 BOSS 直聘推荐页: %s", bossJobURL)
	if err := s.page.Navigate(bossJobURL); err != nil {
		return nil, fmt.Errorf("页面导航失败: %w", err)
	}

	_ = s.page.WaitLoad()

	info, err := s.page.Info()
	if err != nil {
		return nil, fmt.Errorf("获取页面信息失败: %w", err)
	}

	if strings.Contains(info.URL, "/web/user") || strings.Contains(info.URL, "login") {
		log.Println("==================================================================")
		log.Println("【BOSS直聘 MCP】检测到您尚未登录或登录已失效！")
		log.Println("【BOSS直聘 MCP】请在弹出的浏览器窗口中扫码登录 BOSS 直聘。")
		log.Println("【BOSS直聘 MCP】登录成功后，系统将自动保持会话并就绪...")
		log.Println("==================================================================")

		timeout := time.After(3 * time.Minute)
		ticker := time.NewTicker(1500 * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-timeout:
				return nil, fmt.Errorf("等待扫码登录超时 (3分钟)，请重启服务重新扫码")
			case <-ticker.C:
				currentInfo, err := s.page.Info()
				if err == nil && !strings.Contains(currentInfo.URL, "/web/user") && !strings.Contains(currentInfo.URL, "login") {
					log.Println("【BOSS直聘 MCP】检测到登录成功！会话已自动持久化。")
					return s.page, nil
				}
			}
		}
	}

	log.Println("[BossService] BOSS 直聘已处于有效登录状态。")
	return s.page, nil
}

// executeInPage 在 BOSS 页面上下文中执行脚本
func (s *BossService) executeInPage(jsFn string, args ...any) (string, error) {
	page, err := s.ensurePageValid()
	if err != nil {
		return "", err
	}

	val, err := page.Eval(jsFn, args...)
	if err != nil {
		return "", err
	}

	return val.Value.Str(), nil
}

// GetVisibleJobs 读取当前页面上渲染的可见职位列表
func (s *BossService) GetVisibleJobs(ctx context.Context) ([]VisibleJob, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	rawJSON, err := s.executeInPage(bossScript, "getJobs")
	if err != nil {
		return nil, fmt.Errorf("读取页面职位列表失败: %w", err)
	}

	var jobs []VisibleJob
	if err := json.Unmarshal([]byte(rawJSON), &jobs); err != nil {
		return nil, fmt.Errorf("解析职位列表失败: %w, 原始内容: %s", err, rawJSON)
	}

	return jobs, nil
}
