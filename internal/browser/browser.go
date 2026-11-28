package browser

import (
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
	"github.com/go-rod/rod/lib/proto"
	"github.com/go-rod/stealth"
	"github.com/namejiahui/mcp-boss-zp/internal/config"
)

const (
	defaultWindowWidth  = 1440
	defaultWindowHeight = 900
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

// EnsureBrowser 确保底层浏览器已启动并建立连接
func (bm *BrowserManager) EnsureBrowser() (*rod.Browser, error) {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	if bm.browser != nil {
		return bm.browser, nil
	}

	if bm.cfg.CDPURL != "" {
		log.Printf("[Browser] 正在通过 CDP 接入现有浏览器: %s", bm.cfg.CDPURL)
		u, err := launcher.ResolveURL(bm.cfg.CDPURL)
		if err != nil {
			return nil, fmt.Errorf("解析 CDP 调试地址失败 (%s): %w", bm.cfg.CDPURL, err)
		}
		// NoDefaultDevice：attach 场景危害最大——rod 默认会把每个可枚举标签页锁到
		// 1280x800 视口并注入 macOS UA（UA 覆盖不会被 SetViewport 清除），用户正在用的浏览器会被改坏
		b := rod.New().ControlURL(u).NoDefaultDevice()
		if err := b.Connect(); err != nil {
			return nil, fmt.Errorf("连接现有 Chrome 失败 (%s): %w", bm.cfg.CDPURL, err)
		}
		bm.browser = b
		log.Printf("[Browser] 成功连接至现有浏览器 (%s)", bm.cfg.CDPURL)
		return bm.browser, nil
	}

	if err := os.MkdirAll(bm.cfg.UserDataDir, 0755); err != nil {
		return nil, fmt.Errorf("创建用户数据目录失败: %w", err)
	}

	l := launcher.New().
		UserDataDir(bm.cfg.UserDataDir).
		Headless(bm.cfg.Headless).
		Leakless(false).
		Set("window-size", fmt.Sprintf("%d,%d", defaultWindowWidth, defaultWindowHeight)).
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

	// NoDefaultDevice：rod 默认会给每个创建/附着的页面应用 LaptopWithMDPIScreen 设备仿真，
	// 其中 setUserAgentOverride（macOS UA + Accept-Language "en"）不会被下方 SetViewport 清除，
	// Windows 启动的浏览器报 Mac UA 是风控可交叉校验的指纹矛盾，禁用后页面保留真实 UA/视口
	b := rod.New().ControlURL(u).NoDefaultDevice()
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

	// 锁定页面视口为标准 1440x900 宽屏，确保无论在何种操作系统或分辨率下，页面 DOM 布局均完全一致且不折叠
	_ = p.SetViewport(&proto.EmulationSetDeviceMetricsOverride{
		Width:             defaultWindowWidth,
		Height:            defaultWindowHeight,
		DeviceScaleFactor: 1,
	})

	return p, nil
}

// Close 优雅关闭浏览器进程
func (bm *BrowserManager) Close() error {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	if bm.browser != nil {
		var err error
		// 若是通过外部 CDP 接入的浏览器，仅断开连接，避免误杀宿主机用户正在使用的浏览器
		if bm.cfg.CDPURL == "" {
			err = bm.browser.Close()
		}
		bm.browser = nil
		return err
	}
	return nil
}
