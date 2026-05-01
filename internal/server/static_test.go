package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

func makeTestFS() fstest.MapFS {
	return fstest.MapFS{
		"index.html":          {Data: []byte("<html>app</html>")},
		"assets/app.abc.js":   {Data: []byte("console.log('hi')")},
		"assets/app.abc.css":  {Data: []byte("body{}")},
		"favicon.ico":         {Data: []byte("icon")},
	}
}

func TestStaticHandler_RootServesIndex(t *testing.T) {
	h := newStaticHandler(makeTestFS())
	for _, p := range []string{"/", ""} {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.URL.Path = p
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)

		if w.Code != http.StatusOK {
			t.Errorf("path %q: got %d, want 200", p, w.Code)
		}
		if ct := w.Header().Get("Content-Type"); ct != "text/html; charset=utf-8" {
			t.Errorf("path %q: Content-Type = %q, want text/html; charset=utf-8", p, ct)
		}
	}
}

func TestStaticHandler_UnknownPathFallsBackToIndex(t *testing.T) {
	const indexContent = "<html>app</html>"
	h := newStaticHandler(makeTestFS())

	for _, p := range []string{
		"/unknown-route",
		"/some/deep/spa/route",
		"/bookmarks/123",
		"/settings",
	} {
		r := httptest.NewRequest(http.MethodGet, p, nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)

		if w.Code != http.StatusOK {
			t.Errorf("path %q: got %d, want 200", p, w.Code)
		}
		if body := w.Body.String(); body != indexContent {
			t.Errorf("path %q: body = %q, want index content", p, body)
		}
	}
}

func TestStaticHandler_ServesExistingAssets(t *testing.T) {
	h := newStaticHandler(makeTestFS())

	for _, p := range []string{
		"/assets/app.abc.js",
		"/assets/app.abc.css",
		"/favicon.ico",
	} {
		r := httptest.NewRequest(http.MethodGet, p, nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)

		if w.Code != http.StatusOK {
			t.Errorf("path %q: got %d, want 200", p, w.Code)
		}
	}
}

func TestStaticHandler_MissingIndexReturns500(t *testing.T) {
	// FS with no index.html — serveIndex should return 500.
	h := newStaticHandler(fstest.MapFS{
		"assets/app.js": {Data: []byte("js")},
	})

	r := httptest.NewRequest(http.MethodGet, "/unknown", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("got %d, want 500", w.Code)
	}
}
