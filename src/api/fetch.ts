
import { ofetch } from "ofetch";
export const apiFetch = ofetch.create({
    baseURL: 'https://www.zhipin.com',
    headers: {
        Cookie: process.env.Cookie ?? ''
    }
});
