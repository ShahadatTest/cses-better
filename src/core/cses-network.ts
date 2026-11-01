import https from 'https';
import { URL } from 'url';

export const CSES_BASE_URL = 'https://cses.fi';
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface CsesHttpResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  location?: string;
  cookies: string;
}

/**
 * Universal HTTPS request with IPv4 forced ({ family: 4 }) for CSES.fi compatibility
 */
export function csesRequest(
  urlStr: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
    timeout?: number;
    followRedirects?: boolean;
    cookie?: string;
    redirectCount?: number;
  } = {}
): Promise<CsesHttpResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...options.headers,
    };

    if (options.cookie) {
      headers['Cookie'] = options.cookie;
    }

    const reqOptions: https.RequestOptions = {
      family: 4, // Critical for cses.fi
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers,
    };

    const req = https.request(reqOptions, (res) => {
      // Collect set-cookies
      const setCookies = res.headers['set-cookie'] || [];
      const cookieStr = setCookies.map((c) => c.split(';')[0]).join('; ');
      const combinedCookie = options.cookie
        ? cookieStr
          ? `${options.cookie}; ${cookieStr}`
          : options.cookie
        : cookieStr;

      const location = res.headers.location;

      // Handle redirect if requested
      if (
        options.followRedirects &&
        [301, 302, 303, 307, 308].includes(res.statusCode || 0) &&
        location
      ) {
        const currentRedirects = options.redirectCount || 0;
        if (currentRedirects >= 5) {
          return reject(new Error(`Too many redirects fetching ${urlStr}`));
        }
        const nextUrl = new URL(location, urlStr).toString();
        // Prevent forwarding sensitive cookies if redirected off-site
        const nextHost = new URL(nextUrl).hostname;
        const forwardCookie = nextHost.endsWith('cses.fi') ? combinedCookie : undefined;

        return csesRequest(nextUrl, {
          ...options,
          redirectCount: currentRedirects + 1,
          cookie: forwardCookie,
        })
          .then(resolve)
          .catch(reject);
      }

      let dataChunks: Buffer[] = [];
      res.on('data', (chunk) => {
        dataChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      res.on('end', () => {
        const bodyBuffer = Buffer.concat(dataChunks);
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: bodyBuffer.toString('utf-8'),
          location: location || undefined,
          cookies: combinedCookie,
        });
      });
    });

    req.on('error', (err) => reject(err));

    req.setTimeout(options.timeout || 15000, () => {
      req.destroy(new Error(`Timeout fetching ${urlStr}`));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Extracts csrf_token from HTML page
 */
export function extractCsrfToken(html: string): string | null {
  const match =
    html.match(/name="csrf_token"\s+value="([^"]+)"/i) ||
    html.match(/value="([^"]+)"\s+name="csrf_token"/i);
  return match ? match[1] : null;
}

/**
 * Maps standard language IDs to CSES language form values
 */
export function mapLanguageToCsesOption(language: string): string {
  switch (language.toLowerCase()) {
    case 'cpp':
    case 'c++':
      return 'C++';
    case 'python':
    case 'py':
      return 'Python3';
    case 'java':
      return 'Java';
    case 'rust':
    case 'rs':
      return 'Rust';
    case 'go':
      return 'Go';
    case 'c':
      return 'C';
    case 'javascript':
    case 'js':
      return 'JavaScript';
    case 'typescript':
    case 'ts':
      return 'TypeScript';
    default:
      return 'C++';
  }
}
