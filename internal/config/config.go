package config

import (
	"os"
	"path/filepath"
	"strings"
)

// AppConfig 保存应用运行时配置
type AppConfig struct {
	UserDataDir string // Chrome 用户数据目录
	Headless    bool   // 是否无头模式
	ChromeBin   string // 自定义 Chrome/Edge 可执行文件路径
	CDPURL      string // 自定义 CDP 远程调试地址 (如 http://127.0.0.1:9222)
}

// GetDefaultUserDataDir 获取跨平台默认的数据持久化目录
func GetDefaultUserDataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	return filepath.Join(home, ".mcp-boss-zp", "browser_profile")
}

// LoadConfig 从环境变量加载配置
func LoadConfig() *AppConfig {
	headless := false
	if v := strings.ToLower(os.Getenv("BOSS_HEADLESS")); v == "true" || v == "1" {
		headless = true
	}

	return &AppConfig{
		UserDataDir: GetDefaultUserDataDir(),
		Headless:    headless,
		ChromeBin:   strings.TrimSpace(os.Getenv("CHROME_BIN")),
		CDPURL:      strings.TrimSpace(os.Getenv("CHROME_CDP_URL")),
	}
}
