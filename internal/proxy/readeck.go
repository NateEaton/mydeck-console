package proxy

import "net/http"

func NewReadeck(upstream string) (http.Handler, error) {
	return newReverseProxy(upstream, "", nil, nil)
}
