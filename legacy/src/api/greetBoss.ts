import { apiFetch, Response } from "./fetch.js"

export type GreetBossParams = {
    securityId: string,
    jobId: string
}

interface ZpData {
    showGreeting: boolean
    securityId: string
    bossSource: number
    source: string
    encBossId: string
}

export const greetBoss = async (params: GreetBossParams) => {
    const { zpData, code, message: message_1 } = await apiFetch<Response<ZpData>>('/wapi/zpgeek/friend/add.json', {
        params
    })
    if (code !== 0) {
        throw new Error(message_1)
    }
    return zpData
}
