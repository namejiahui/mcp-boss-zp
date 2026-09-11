/**
 * BOSS 直聘可见职位与操作结果类型声明
 */

export interface VisibleJob {
    /** 页面卡片从 1 开始的顺序索引 */
    index: number;
    /** 职位名称 */
    jobName: string;
    /** 薪资描述，例如 20-35K·15薪 */
    salary: string;
    /** 公司名称 */
    companyName: string;
    /** 公司规模、融资阶段与行业信息 */
    companyScale: string;
    /** 技能标签与福利列表 */
    tags: string[];
    /** 招聘者/HR 称呼与身份 */
    bossInfo: string;
    /** 是否此前已经发送过沟通邀请 (按钮文案为继续沟通) */
    alreadyChatted: boolean;
}

export interface GreetResult {
    /** 是否成功执行了点击沟通 */
    success: boolean;
    /** 结果说明提示信息 */
    message: string;
}

