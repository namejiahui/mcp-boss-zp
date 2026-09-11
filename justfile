binary_name := "mcp-boss-zp"
version := "0.3.0"
build_dir := "bin"

# 默认列出所有支持的任务
default:
    @just --list

# 构建当前平台可执行二进制（本地开发与测试）
build:
    @echo "==> 构建当前平台二进制..."
    @mkdir -p {{build_dir}}
    go build -buildvcs=false -ldflags="-s -w -X 'main.Version={{version}}'" -o {{build_dir}}/{{binary_name}} ./cmd/mcp-boss-zp
    @echo "==> 构建完成: {{build_dir}}/{{binary_name}}"

# 直接运行（本地开发调试模式）
run *args:
    go run -buildvcs=false ./cmd/mcp-boss-zp {{args}}

# 代码静态检查 (staticcheck & go vet)
lint:
    go tool staticcheck ./...
    go vet ./...

# 清理本地构建产物及临时浏览器缓存
clean:
    rm -rf {{build_dir}}
    rm -rf ~/.cache/rod
    @echo "==> 清理完成"
