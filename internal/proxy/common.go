package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"strings"
)

func newReverseProxy(targetBase string, stripPrefix string, transport http.RoundTripper, mutator func(*http.Request)) (http.Handler, error) {
	target, err := url.Parse(targetBase)
	if err != nil {
		return nil, err
	}

	rp := httputil.NewSingleHostReverseProxy(target)
	baseDirector := rp.Director
	rp.Director = func(req *http.Request) {
		baseDirector(req)
		// Preserve incoming query while carefully adjusting only the path.
		incomingPath := req.URL.Path
		if stripPrefix != "" && strings.HasPrefix(incomingPath, stripPrefix) {
			incomingPath = strings.TrimPrefix(incomingPath, stripPrefix)
			if incomingPath == "" {
				incomingPath = "/"
			}
		}

		req.URL.Path = singleJoiningSlash(target.Path, incomingPath)
		req.URL.RawPath = req.URL.EscapedPath()
		req.Host = target.Host
		if mutator != nil {
			mutator(req)
		}
	}

	if transport != nil {
		rp.Transport = transport
	}

	return rp, nil
}

func singleJoiningSlash(a, b string) string {
	if a == "" {
		return b
	}
	if b == "" {
		return a
	}
	return path.Clean(strings.TrimSuffix(a, "/") + "/" + strings.TrimPrefix(b, "/"))
}
