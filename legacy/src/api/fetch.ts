
import { ofetch } from "ofetch";

export interface Response<T> {
    code: number
    message: string
    zpData: T
}

export const apiFetch = ofetch.create({
    baseURL: 'https://www.zhipin.com',
    headers: {
        Cookie: process.env.COOKIE ?? '',
        zp_token: process.env.BST ?? '',
    }
});
