package config

import (
	"errors"
	"flag"
	"fmt"
	"net/url"
	"strings"
)

type Config struct {
	Listen          string
	ReadeckUpstream string
	BraveKey        string
}

type Flags struct {
	Listen          *string
	ReadeckUpstream *string
	BraveKey        *string
}

func Bind(fs *flag.FlagSet, env []string) Flags {
	envMap := map[string]string{}
	for _, kv := range env {
		key, val, ok := strings.Cut(kv, "=")
		if !ok {
			continue
		}
		envMap[key] = val
	}

	listenDefault := envMap["LISTEN"]
	if listenDefault == "" {
		listenDefault = ":8080"
	}

	readeckDefault := envMap["READECK_UPSTREAM"]
	braveDefault := envMap["BRAVE_API_KEY"]

	return Flags{
		Listen:          fs.String("listen", listenDefault, "HTTP listen address (env: LISTEN)"),
		ReadeckUpstream: fs.String("readeck-upstream", readeckDefault, "Readeck upstream base URL (env: READECK_UPSTREAM)"),
		BraveKey:        fs.String("brave-key", braveDefault, "Brave API subscription token (env: BRAVE_API_KEY)"),
	}
}

func (f Flags) Resolve() (Config, error) {
	cfg := Config{
		Listen:          strings.TrimSpace(valueOrEmpty(f.Listen)),
		ReadeckUpstream: strings.TrimSpace(valueOrEmpty(f.ReadeckUpstream)),
		BraveKey:        strings.TrimSpace(valueOrEmpty(f.BraveKey)),
	}

	if cfg.ReadeckUpstream == "" {
		return Config{}, errors.New("missing required --readeck-upstream (or READECK_UPSTREAM)")
	}

	u, err := url.Parse(cfg.ReadeckUpstream)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return Config{}, fmt.Errorf("invalid readeck upstream URL: %q", cfg.ReadeckUpstream)
	}

	if cfg.Listen == "" {
		cfg.Listen = ":8080"
	}

	return cfg, nil
}

func valueOrEmpty(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
