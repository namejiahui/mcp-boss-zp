
import * as fs from 'fs';
import * as path from 'path';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { jobList, type JobListParams } from "./api/index.js";

if (!process.env.Cookie) {
    console.error("请通过环境在环境变量中设置cookie");
    process.exit(1);
}

const server = new McpServer({
    name: "mcp-boss-zp",
    version: pkg.version
});

server.resource(
    "greeting",
    new ResourceTemplate("greeting://{name}", { list: undefined }),
    async (uri, { name }) => ({
        contents: [{
            uri: uri.href,
            text: `Hello, ${name}!`
        }]
    })
);

server.resource(
    "boss-zp-recommendJobs",
    new ResourceTemplate(
        "boss-zp://recommendJobs/{page}/{encryptExpectId}/{experience}/{jobType}/{salary}",
        { list: undefined }
    ),
    async (
        uri: URL,
        { page = 1, encryptExpectId = "", experience = "", jobType = "", salary = "" }
    ) => {
        try {
            const params: JobListParams = {
                encryptExpectId: Array.isArray(encryptExpectId) ? encryptExpectId[0] : encryptExpectId,
                experience: Array.isArray(experience) ? experience[0] : experience,
                page: +(Array.isArray(page) ? page[0] : page),
                jobType: Array.isArray(jobType) ? jobType[0] : jobType,
                pageSize: 15,
                salary: Array.isArray(salary) ? salary[0] : salary,
                _: new Date().getTime()
            }
            const data = await jobList(params)
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify(data),
                    mimeType: "application/json"
                }]
            };
        } catch (error) {
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify((error as Error).message),
                    mimeType: "application/json"
                }]
            };
        }
    }
);

server.resource(
    "boss-zp-getConfig",
    new ResourceTemplate(
        "boss-zp://getConfig",
        { list: undefined }
    ),
    async (
        uri: URL
    ) => {
        const ExperienceTextCodeMap = new Map<string, number>([
            ['在校生', 108],
            ['应届生', 102],
            ['不限', 101],
            ['一年以内', 103],
            ['一到三年', 104],
            ['三到五年', 105],
            ['五到十年', 106],
            ['十年以上', 107]
        ])

        const JobTypeTextCodeMap = new Map<string, number>([
            ['全职', 1901],
            ['兼职', 1903],
        ])

        const SalaryTextCodeMap = new Map<string, number>([
            ['3k以下', 402],
            ['3-5k', 403],
            ['5-10k', 404],
            ['10-20k', 405],
            ['20-50k', 406],
            ['50以上', 407],
        ]);

        const config = {
            experience: Object.fromEntries(ExperienceTextCodeMap),
            job: Object.fromEntries(JobTypeTextCodeMap),
            salary: Object.fromEntries(SalaryTextCodeMap),
        };

        return {
            contents: [{
                uri: uri.href,
                text: JSON.stringify(config, null, 2),
                mimeType: "application/json"
            }]
        };

    }
);

const transport = new StdioServerTransport();
await server.connect(transport);
