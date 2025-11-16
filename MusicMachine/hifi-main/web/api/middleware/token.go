package middleware

import (
	"api/config"
	"api/types"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

func startLogin(ctx context.Context, client *http.Client, loginDoURL, user, pass string) <-chan types.LoginResult {
	token := make(chan types.LoginResult, 1)

	go func() {
		defer close(token)

		form := url.Values{}
		form.Set("username", user)
		form.Set("password", pass)

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, loginDoURL, strings.NewReader(form.Encode()))
		if err != nil {
			token <- types.LoginResult{OK: false, Err: err}
			return
		}
		req.Header.Set(config.HeaderContentType, config.ContentTypeForm)

		resp, err := client.Do(req)

		if err != nil {
			token <- types.LoginResult{OK: false, Err: err}
			return
		}
		defer resp.Body.Close()

		base := fmt.Sprintf("%s://%s", config.SubsonicScheme, config.SubsonicHost)

		login := startLoginUser(ctx, client, base+"/rest/ping.view", user, pass)

		res := <-login

		if res.Err != nil {
			token <- types.LoginResult{OK: false, Err: fmt.Errorf("invalid login: %d", res.Status)}
			return
		}

		if res.Status >= 400 {
			token <- types.LoginResult{OK: false, Err: fmt.Errorf("login failed: %d", res.Status)}
			return
		}

		token <- types.LoginResult{OK: true, Err: nil}
	}()
	return token
}
