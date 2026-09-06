const TOKEN_KEY = "auth_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore (private browsing etc.) — session just won't persist across reloads
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function logout() {
  clearToken();
  window.location.hash = "#/login";
  window.location.reload();
}
