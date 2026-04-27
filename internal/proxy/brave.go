package proxy

import "net/http"

func NewBrave(braveKey string) (http.Handler, error) {
	return newReverseProxy("https://api.search.brave.com", "/brave", nil, func(req *http.Request) {
		if braveKey != "" {
			req.Header.Set("X-Subscription-Token", braveKey)
		}
		req.Header.Set("Accept", "application/json")
	})
}
