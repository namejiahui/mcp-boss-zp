package boss

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/proto"
	"github.com/namejiahui/mcp-boss-zp/internal/browser"
)

var (
	//go:embed scripts/boss.js
	bossScript string

	jobIdRegexp = regexp.MustCompile(`/job_detail/([a-zA-Z0-9~_-]+)\.html`)
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

// executeInPage 在 BOSS 页面上下文中执行脚本并返回字符串
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

// extractJobIdFromCard 从职位卡片节点中提取唯一 targetJobId (使用 Guard Clause 卫语句扁平化)
func extractJobIdFromCard(card *rod.Element) string {
	link, err := card.Element("a[href*='/job_detail/']")
	if err != nil || link == nil {
		return ""
	}

	href, err := link.Attribute("href")
	if err != nil || href == nil {
		return ""
	}

	m := jobIdRegexp.FindStringSubmatch(*href)
	if len(m) <= 1 {
		return ""
	}

	return m[1]
}

// GreetJob 使用事件驱动 (MutationObserver) + Rod 原生仿真硬件点击 (极简通信、通知式响应、无轮询)
func (s *BossService) GreetJob(ctx context.Context, cardIndex int) (*GreetResult, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	if cardIndex <= 0 {
		return nil, fmt.Errorf("卡片序号必须从 1 开始")
	}

	page, err := s.ensurePageValid()
	if err != nil {
		return nil, err
	}

	// 1. 调用 bossScript 的 getCardElement 获取第 N 个卡片句柄
	targetCard, err := page.ElementByJS(rod.Eval(bossScript, "getCardElement", cardIndex).ByObject().ByPromise())
	if err != nil || targetCard == nil {
		return nil, fmt.Errorf("未找到序号为 %d 的职位卡片: %v", cardIndex, err)
	}

	// 提取该卡片的 targetJobId (用于右侧详情对齐校验)
	targetJobId := extractJobIdFromCard(targetCard)

	// 2. 真实硬件鼠标点击左侧卡片，触发右侧详情栏加载
	if err := targetCard.Click(proto.InputMouseButtonLeft, 1); err != nil {
		return nil, fmt.Errorf("点击第 %d 个职位卡片失败: %w", cardIndex, err)
	}

	// 3. 【通知式等待】：由浏览器内核的 MutationObserver 事件直接驱动决议 Promise！
	// 将 targetJobId 纯字符串传给 JS，JS 纯粹做事件通知与 jobId 对齐核验
	btn, err := page.ElementByJS(rod.Eval(bossScript, "waitForChatButton", targetJobId, 8000).ByObject().ByPromise())
	if err != nil || btn == nil {
		return nil, fmt.Errorf("在序号 %d 的职位上未找到沟通按钮 (可能已被抢先沟通或加载超时)", cardIndex)
	}

	// 4. 检查按钮文案，若已沟通过则不再重复打招呼 (可打断点看 btnText)
	btnText, _ := btn.Text()
	btnText = strings.TrimSpace(btnText)
	if strings.Contains(btnText, "继续") || strings.Contains(btnText, "已沟通") || strings.Contains(btnText, "聊过") {
		return &GreetResult{
			Success: true,
			Message: "该职位此前已发送过沟通邀请，无需重复打招呼",
		}, nil
	}

	// 5. 真实物理鼠标点击【立即沟通】
	// 通过 Shape 计算物理中心坐标并直接触发鼠标事件，跳过 Rod 默认的 WaitInteractable 遮挡死循环
	if shape, err := btn.Shape(); err == nil && shape != nil {
		box := shape.Box()
		centerPt := proto.NewPoint(box.X+box.Width/2, box.Y+box.Height/2)
		_ = page.Mouse.MoveTo(centerPt)
		if err := page.Mouse.Click(proto.InputMouseButtonLeft, 1); err != nil {
			log.Printf("[BossService] 物理鼠标点击异常 (%v)，使用 DOM 兜底触发", err)
			_, _ = page.Eval(`(el) => el.click()`, btn)
		}
	} else {
		// 兜底方案：直接通过 DOM click 触发
		if _, err := page.Eval(`(el) => el.click()`, btn); err != nil {
			return nil, fmt.Errorf("点击【立即沟通】按钮失败: %w", err)
		}
	}

	return &GreetResult{
		Success: true,
		Message: "已在页面上成功点击【立即沟通】按钮！",
	}, nil
}
