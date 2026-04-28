const STORAGE_KEY = 'excel_clone_basic_auth';

function buildToken(username: string, password: string) {
  return btoa(`${username}:${password}`);
}

export function setBasicAuthCredentials(username: string, password: string) {
  const token = buildToken(username, password);
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearBasicAuthCredentials() {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasBasicAuthCredentials() {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}

export function getAuthHeader() {
  const token = localStorage.getItem(STORAGE_KEY);
  if (!token) return null;
  return `Basic ${token}`;
}
