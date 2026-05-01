package proxy

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"strings"
	"testing"
)

// roundTripFunc lets a plain function satisfy http.RoundTripper.
type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func okResponse() *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader("")),
		Header:     make(http.Header),
	}
}

// injectTransport replaces the transport on a handler returned by newReverseProxy
// so we can inspect outbound requests without making real network calls.
func injectTransport(t *testing.T, h http.Handler, rt http.RoundTripper) {
	t.Helper()
	rp, ok := h.(*httputil.ReverseProxy)
	if !ok {
		t.Fatal("handler is not *httputil.ReverseProxy")
	}
	rp.Transport = rt
}

func TestNewBrave_InjectsSubscriptionToken(t *testing.T) {
	const key = "test-brave-key-abc"
	h, err := NewBrave(key)
	if err != nil {
		t.Fatal(err)
	}

	var capturedToken string
	injectTransport(t, h, roundTripFunc(func(req *http.Request) (*http.Response, error) {
		capturedToken = req.Header.Get("X-Subscription-Token")
		return okResponse(), nil
	}))

	r := httptest.NewRequest(http.MethodGet, "/brave/res/v1/web/search?q=test", nil)
	h.ServeHTTP(httptest.NewRecorder(), r)

	if capturedToken != key {
		t.Errorf("X-Subscription-Token = %q, want %q", capturedToken, key)
	}
}

func TestNewBrave_NoTokenWhenKeyEmpty(t *testing.T) {
	h, err := NewBrave("")
	if err != nil {
		t.Fatal(err)
	}

	var capturedToken string
	injectTransport(t, h, roundTripFunc(func(req *http.Request) (*http.Response, error) {
		capturedToken = req.Header.Get("X-Subscription-Token")
		return okResponse(), nil
	}))

	r := httptest.NewRequest(http.MethodGet, "/brave/res/v1/web/search?q=test", nil)
	h.ServeHTTP(httptest.NewRecorder(), r)

	if capturedToken != "" {
		t.Errorf("X-Subscription-Token = %q, want empty when no key configured", capturedToken)
	}
}

func TestNewBrave_SetsAcceptHeader(t *testing.T) {
	h, err := NewBrave("any-key")
	if err != nil {
		t.Fatal(err)
	}

	var capturedAccept string
	injectTransport(t, h, roundTripFunc(func(req *http.Request) (*http.Response, error) {
		capturedAccept = req.Header.Get("Accept")
		return okResponse(), nil
	}))

	r := httptest.NewRequest(http.MethodGet, "/brave/res/v1/web/search?q=test", nil)
	h.ServeHTTP(httptest.NewRecorder(), r)

	if capturedAccept != "application/json" {
		t.Errorf("Accept = %q, want application/json", capturedAccept)
	}
}
