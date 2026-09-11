package boss

import (
	"github.com/namejiahui/mcp-boss-zp/internal/browser"
)

type BossService struct {
	bm *browser.BrowserManager
}

func NewBossService(bm *browser.BrowserManager) *BossService {
	return &BossService{bm: bm}
}
