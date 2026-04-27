package server

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

type staticHandler struct {
	fileServer http.Handler
	fsys       fs.FS
}

func newStaticHandler(fsys fs.FS) http.Handler {
	return &staticHandler{
		fileServer: http.FileServer(http.FS(fsys)),
		fsys:       fsys,
	}
}

func (h *staticHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Path
	if p == "" || p == "/" {
		h.serveIndex(w)
		return
	}

	clean := strings.TrimPrefix(path.Clean(p), "/")
	if clean == "." || clean == "" {
		h.serveIndex(w)
		return
	}

	info, err := fs.Stat(h.fsys, clean)
	if err == nil && !info.IsDir() {
		h.fileServer.ServeHTTP(w, r)
		return
	}

	h.serveIndex(w)
}

func (h *staticHandler) serveIndex(w http.ResponseWriter) {
	b, err := fs.ReadFile(h.fsys, "index.html")
	if err != nil {
		http.Error(w, "embedded index.html not found", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(b)
}
