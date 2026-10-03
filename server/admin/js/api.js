/* Talks to the backend. All mutating calls carry X-Requested-With so the server accepts them. */

const BASE = '/api/admin';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function friendly(status, body) {
  if (body?.error) return body.error;
  if (status === 413) return 'That file is too big (15 MB max).';
  if (status >= 500) return 'The server had a problem. Please try again.';
  return 'Something went wrong. Please try again.';
}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-Requested-With'] = 'rosier-admin';
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your internet connection.", 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (res.status === 401 && path !== '/login') {
    window.dispatchEvent(new CustomEvent('rosier:logged-out'));
  }
  if (!res.ok) throw new ApiError(friendly(res.status, data), res.status);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, body = {}) => request('POST', p, body),
  put: (p, body = {}) => request('PUT', p, body),
  del: (p) => request('DELETE', p),

  /** Upload image files. onProgress gets 0..1. Resolves with {images, errors}. */
  upload(files, onProgress) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/images`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-Requested-With', 'rosier-admin');
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onerror = () => reject(new ApiError("Upload failed. Check your internet connection.", 0));
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* ignore */
        }
        if (xhr.status === 401) window.dispatchEvent(new CustomEvent('rosier:logged-out'));
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiError(friendly(xhr.status, data), xhr.status));
      };
      xhr.send(fd);
    });
  },
};
