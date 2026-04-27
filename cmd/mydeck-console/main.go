package main

import (
	"embed"
	"flag"
	"io/fs"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"mydeck-console/internal/config"
	"mydeck-console/internal/server"
)

//go:embed all:web
var embeddedWeb embed.FS

// version can be overridden at build time:
// go build -ldflags "-X main.version=v0.0.0"
var version = "dev"

func main() {
	cfgFlags := config.Bind(flag.CommandLine, os.Environ())
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println(version)
		return
	}

	cfg, err := cfgFlags.Resolve()
	if err != nil {
		log.Fatal(err)
	}

	webFS, err := fs.Sub(embeddedWeb, "web")
	if err != nil {
		log.Fatalf("embedded web assets not found: %v", err)
	}

	srv, err := server.New(cfg, webFS, version)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("mydeck-console %s listening on %s (upstream=%s)", version, cfg.Listen, cfg.ReadeckUpstream)
	go func() {
		if err := srv.ListenAndServe(); err != nil {
			log.Fatal(err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	log.Println("shutdown signal received")
	if err := srv.Shutdown(); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
}
