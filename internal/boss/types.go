package boss

// VisibleJob 代表当前页面上渲染出来的可见职位卡片
type VisibleJob struct {
	Index          int      `json:"index"`          // 页面上的卡片序号 (1, 2, 3...)
	JobName        string   `json:"jobName"`        // 职位名称 (如：Go 后端开发工程师)
	Salary         string   `json:"salary"`         // 薪资范围 (如：20-35K·15薪)
	CompanyName    string   `json:"companyName"`    // 公司名称
	CompanyScale   string   `json:"companyScale"`   // 公司规模/行业信息
	Experience     string   `json:"experience"`     // 经验要求 (如：3-5年)
	Degree         string   `json:"degree"`         // 学历要求 (如：本科)
	Location       string   `json:"location"`       // 工作地点/商圈
	Tags           []string `json:"tags"`           // 技能标签/福利待遇
	BossInfo       string   `json:"bossInfo"`       // 发布者/HR 信息 (如：张女士 · 招聘专家)
	AlreadyChatted bool     `json:"alreadyChatted"` // 是否已经沟通 (按钮是否为继续沟通)
}
