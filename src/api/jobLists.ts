import { apiFetch } from "./fetch.js"

//todo 添加公司规模参数，学历
export type JobListParams = {
    encryptExpectId?: string,
    experience?: string,
    salary?: string,
    jobType?: string,
    page?: number,
    pageSize?: 15,
    _?: number
}

interface Root {
    code: number
    message: string
    zpData: ZpData
}

interface ZpData {
    hasMore: boolean
    jobList: JobList[]
    type: number
}

interface JobList {
    securityId: string
    bossAvatar: string
    bossCert: number
    encryptBossId: string
    bossName: string
    bossTitle: string
    goldHunter: number
    bossOnline: boolean
    encryptJobId: string
    expectId: number
    jobName: string
    lid: string
    salaryDesc: string
    jobLabels: string[]
    jobValidStatus: number
    iconWord: any
    skills: string[]
    jobExperience: string
    daysPerWeekDesc: string
    leastMonthDesc: string
    jobDegree: string
    cityName: string
    areaDistrict: string
    businessDistrict: string
    jobType: number
    proxyJob: number
    proxyType: number
    anonymous: number
    outland: number
    optimal: number
    iconFlagList: number[]
    itemId: number
    city: number
    isShield: number
    atsDirectPost: boolean
    gps: Gps
    afterNameIcons: any[]
    beforeNameIcons: string[]
    encryptBrandId: string
    brandName: string
    brandLogo: string
    brandStageName: string
    brandIndustry: string
    brandScaleName: string
    welfareList: any[]
    industry: number
    contact: boolean
    showTopPosition: boolean
}

interface Gps {
    longitude: number
    latitude: number
}

export const jobList = (params: JobListParams) => apiFetch<Root>('/wapi/zpgeek/pc/recommend/job/list.json', {
    params
}).then(({ zpData, code, message }) => {
    if (code !== 0) {
        throw new Error(message)
    }
    return zpData.jobList.map(({ securityId, encryptBossId, jobName, lid, salaryDesc, jobLabels, skills, jobExperience, jobDegree, cityName, areaDistrict, encryptBrandId, brandName, brandScaleName, industry, contact, showTopPosition }) => ({
        securityId,
        encryptBossId,
        jobDegree,
        jobName,
        lid,
        salaryDesc,
        jobLabels,
        skills,
        jobExperience,
        cityName,
        areaDistrict,
        encryptBrandId,
        brandName,
        brandScaleName,
        industry,
        contact,
        showTopPosition
    }))
});
