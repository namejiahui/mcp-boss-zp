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
}

// GetDefaultUserDataDir 获取跨平台默认的数据持久化目录
func GetDefaultUserDataDir() string {
	if custom := os.Getenv("BOSS_USER_DATA_DIR"); custom != "" {
		return custom
	}
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
	}
}
