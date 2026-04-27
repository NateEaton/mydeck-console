package server

import (
	"context"
	"io/fs"
	"net/http"
	"time"

	"mydeck-console/internal/config"
)

type Server struct {
	httpServer *http.Server
}

func New(cfg config.Config, webFS fs.FS, appVersion string) (*Server, error) {
	handler, err := routes(cfg, webFS, appVersion)
	if err != nil {
		return nil, err
	}

	s := &http.Server{
		Addr:              cfg.Listen,
		Handler:           handler,
		ReadTimeout:       30 * time.Second,
		ReadHeaderTimeout: 15 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	return &Server{httpServer: s}, nil
}

func (s *Server) ListenAndServe() error {
	err := s.httpServer.ListenAndServe()
	if err == http.ErrServerClosed {
		return nil
	}
	return err
}

func (s *Server) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return s.httpServer.Shutdown(ctx)
}
