#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const platform = os.platform(); // darwin | linux | win32
const arch = os.arch();         // x64 | arm64
const ext = platform === 'win32' ? '.exe' : '';
const binFileName = `mcp-boss-zp${ext}`;
const pkgName = `mcp-boss-zp-${platform}-${arch}`;

function run(binPath) {
    const child = spawn(binPath, process.argv.slice(2), {
        stdio: 'inherit'
    });

    child.on('error', (err) => {
        console.error(`[mcp-boss-zp] 启动服务失败: ${err.message}`);
        process.exit(1);
    });

    child.on('exit', (code, signal) => {
        if (code !== null) {
            process.exit(code);
        } else if (signal) {
            process.kill(process.pid, signal);
        }
    });

    for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
        process.on(sig, () => {
            if (!child.killed) {
                child.kill(sig);
            }
        });
    }
}

let binaryPath = null;

try {
    const pkgJsonUrl = import.meta.resolve(`${pkgName}/package.json`);
    const subPkgDir = path.dirname(fileURLToPath(pkgJsonUrl));
    const candidate = path.join(subPkgDir, 'bin', binFileName);
    if (fs.existsSync(candidate)) {
        binaryPath = candidate;
    }
} catch {
    const fallback = path.join(import.meta.dirname, 'node_modules', pkgName, 'bin', binFileName);
    if (fs.existsSync(fallback)) {
        binaryPath = fallback;
    }
}

if (!binaryPath) {
    console.error(`[mcp-boss-zp] 错误: 未在环境中找到适用的原生平台包: ${pkgName}`);
    console.error(`[mcp-boss-zp] 当前系统架构: ${platform} (${arch})`);
    console.error(`[mcp-boss-zp] 请尝试重新安装: npm install -f mcp-boss-zp`);
    process.exit(1);
}

run(binaryPath);
