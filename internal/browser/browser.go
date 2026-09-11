package browser

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
	"github.com/go-rod/stealth"
	"github.com/namejiahui/mcp-boss-zp/internal/config"
)

// BrowserManager 管理底层 Chrome/Edge 浏览器进程及连接
type BrowserManager struct {
	cfg     *config.AppConfig
	browser *rod.Browser
	mu      sync.Mutex
}

// NewBrowserManager 创建通用浏览器管理器
func NewBrowserManager(cfg *config.AppConfig) *BrowserManager {
	return &BrowserManager{
		cfg: cfg,
	}
}

// cleanStaleLocks 清理崩溃残留的 Chrome 锁文件
func cleanStaleLocks(userDataDir string) {
	for _, f := range []string{"SingletonLock", "SingletonSocket", "SingletonCookie"} {
		_ = os.Remove(filepath.Join(userDataDir, f))
	}
}

// EnsureBrowser 确保底层浏览器已启动并建立连接
func (bm *BrowserManager) EnsureBrowser() (*rod.Browser, error) {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	if bm.browser != nil {
		return bm.browser, nil
	}

	if err := os.MkdirAll(bm.cfg.UserDataDir, 0755); err != nil {
		return nil, fmt.Errorf("创建用户数据目录失败: %w", err)
	}

	cleanStaleLocks(bm.cfg.UserDataDir)

	l := launcher.New().
		UserDataDir(bm.cfg.UserDataDir).
		Headless(bm.cfg.Headless).
		Leakless(false).
		Set("disable-blink-features", "AutomationControlled").
		Set("no-default-browser-check").
		Set("no-first-run")

	if bm.cfg.ChromeBin != "" {
		l.Bin(bm.cfg.ChromeBin)
	} else if bin, has := launcher.LookPath(); has {
		log.Printf("[Browser] 检测到系统浏览器: %s", bin)
		l.Bin(bin)
	} else {
		log.Println("[Browser] 未在系统标准路径找到 Chrome/Edge，将自动下载便携版 Chromium...")
	}

	u, err := l.Launch()
	if err != nil {
		return nil, fmt.Errorf("启动 Chrome 失败 (请确认本机已安装 Chrome/Edge): %w", err)
	}

	b := rod.New().ControlURL(u)
	if err := b.Connect(); err != nil {
		return nil, fmt.Errorf("连接浏览器失败: %w", err)
	}

	bm.browser = b
	return bm.browser, nil
}

// NewStealthPage 创建一个开启了 Stealth 反指纹对抗的全新页面
func (bm *BrowserManager) NewStealthPage() (*rod.Page, error) {
	b, err := bm.EnsureBrowser()
	if err != nil {
		return nil, err
	}

	p, err := stealth.Page(b)
	if err != nil {
		return nil, fmt.Errorf("创建 stealth 页面失败: %w", err)
	}

	return p, nil
}

// Close 优雅关闭浏览器进程
func (bm *BrowserManager) Close() error {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	if bm.browser != nil {
		err := bm.browser.Close()
		bm.browser = nil
		return err
	}
	return nil
}
