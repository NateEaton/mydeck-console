package config

import (
	"flag"
	"testing"
)

func TestResolve_MissingUpstream(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	flags := Bind(fs, nil)
	_ = fs.Parse([]string{})

	_, err := flags.Resolve()
	if err == nil {
		t.Fatal("expected error for missing upstream, got nil")
	}
}

func TestResolve_ValidUpstream(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	flags := Bind(fs, nil)
	_ = fs.Parse([]string{"--readeck-upstream", "http://readeck:8000"})

	cfg, err := flags.Resolve()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.ReadeckUpstream != "http://readeck:8000" {
		t.Errorf("ReadeckUpstream = %q, want %q", cfg.ReadeckUpstream, "http://readeck:8000")
	}
}

func TestResolve_InvalidURL(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	flags := Bind(fs, nil)
	_ = fs.Parse([]string{"--readeck-upstream", "not-a-url"})

	_, err := flags.Resolve()
	if err == nil {
		t.Fatal("expected error for invalid URL, got nil")
	}
}

func TestResolve_EnvFallback(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	flags := Bind(fs, []string{"READECK_UPSTREAM=http://from-env:8000"})
	_ = fs.Parse([]string{})

	cfg, err := flags.Resolve()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.ReadeckUpstream != "http://from-env:8000" {
		t.Errorf("ReadeckUpstream = %q, want %q", cfg.ReadeckUpstream, "http://from-env:8000")
	}
}

func TestResolve_FlagOverridesEnv(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	flags := Bind(fs, []string{"READECK_UPSTREAM=http://from-env:8000"})
	_ = fs.Parse([]string{"--readeck-upstream", "http://from-flag:9000"})

	cfg, err := flags.Resolve()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.ReadeckUpstream != "http://from-flag:9000" {
		t.Errorf("ReadeckUpstream = %q, want %q", cfg.ReadeckUpstream, "http://from-flag:9000")
	}
}

func TestResolve_DefaultListen(t *testing.T) {
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	flags := Bind(fs, []string{"READECK_UPSTREAM=http://readeck:8000"})
	_ = fs.Parse([]string{})

	cfg, err := flags.Resolve()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Listen != ":8080" {
		t.Errorf("Listen = %q, want :8080", cfg.Listen)
	}
}
