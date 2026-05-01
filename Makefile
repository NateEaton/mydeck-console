VERSION   := $(shell node -p "require('./package.json').version" 2>/dev/null || echo "dev")
LDFLAGS   := -s -w -X main.version=v$(VERSION)
BINARY    := mydeck-console
BUILD_DIR := build
WEB_SRC   := dist
WEB_EMBED := cmd/mydeck-console/web

.PHONY: build build-all spa clean run-dev

# Build SPA + Go binary for the current platform
build: spa
	go build -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY) ./cmd/mydeck-console

# Build SPA + all release-platform binaries with checksums (designed for Linux CI)
build-all: spa
	mkdir -p $(BUILD_DIR)
	CGO_ENABLED=0 GOOS=linux   GOARCH=amd64  go build -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY)-linux-amd64     ./cmd/mydeck-console
	CGO_ENABLED=0 GOOS=linux   GOARCH=arm64  go build -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY)-linux-arm64     ./cmd/mydeck-console
	CGO_ENABLED=0 GOOS=darwin  GOARCH=amd64  go build -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY)-darwin-amd64    ./cmd/mydeck-console
	CGO_ENABLED=0 GOOS=darwin  GOARCH=arm64  go build -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY)-darwin-arm64    ./cmd/mydeck-console
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64  go build -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY)-windows-amd64.exe ./cmd/mydeck-console
	cd $(BUILD_DIR) && sha256sum $(BINARY)-* > SHA256SUMS

# Build the Svelte SPA and sync assets into the Go embed directory
spa:
	npm ci
	npm run build
	find $(WEB_EMBED) -mindepth 1 ! -name '.keep' -delete
	cp -r $(WEB_SRC)/. $(WEB_EMBED)/

# Remove all build artifacts
clean:
	rm -rf $(BUILD_DIR) $(WEB_SRC)
	find $(WEB_EMBED) -mindepth 1 ! -name '.keep' -delete

# Build and run locally — requires READECK_UPSTREAM in the environment (or .env)
run-dev: build
	./$(BUILD_DIR)/$(BINARY) \
		--readeck-upstream "$$READECK_UPSTREAM" \
		--listen "127.0.0.1:8889" \
		--brave-key "$$BRAVE_API_KEY"
