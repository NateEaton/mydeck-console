package server

import (
	"encoding/json"
	"io/fs"
	"net/http"

	"mydeck-console/internal/config"
	"mydeck-console/internal/proxy"
)

func routes(cfg config.Config, webFS fs.FS, appVersion string) (http.Handler, error) {
	mux := http.NewServeMux()

	readeckProxy, err := proxy.NewReadeck(cfg.ReadeckUpstream)
	if err != nil {
		return nil, err
	}
	archiveProxy, err := proxy.NewArchive()
	if err != nil {
		return nil, err
	}
	braveProxy, err := proxy.NewBrave(cfg.BraveKey)
	if err != nil {
		return nil, err
	}

	mux.Handle("/api/", readeckProxy)
	mux.Handle("/api", readeckProxy)
	mux.Handle("/cdx/", archiveProxy)
	mux.Handle("/cdx", archiveProxy)
	mux.Handle("/brave/", braveProxy)
	mux.Handle("/brave", braveProxy)
	mux.HandleFunc("/__mydeck/meta", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"runtime": "go-binary",
			"version": appVersion,
		})
	})
	mux.Handle("/", newStaticHandler(webFS))
	return mux, nil
}
