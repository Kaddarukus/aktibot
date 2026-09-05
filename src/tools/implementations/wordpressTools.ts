import { sanitizeAndValidateDomain } from './websiteHealthTools';

export async function runComprehensiveWordPressCheck(rawDomain: string) {
  const cleanDomain = sanitizeAndValidateDomain(rawDomain);

  let isWordPress = false;
  let hasRestApi = false;
  let restApiData: any = null;
  let loginPageAccessible = false;
  let detectedThemesOrPlugins: string[] = [];
  let errorSignatures: string[] = [];

  // Public Probe 1: WP REST API endpoint
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://${cleanDomain}/wp-json/`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'HospesAi-WP-Probe/1.0' }
    });
    clearTimeout(to);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.name || data.namespaces)) {
        isWordPress = true;
        hasRestApi = true;
        restApiData = {
          name: data.name,
          description: data.description,
          url: data.url,
          namespaces: data.namespaces?.slice(0, 8)
        };
      }
    }
  } catch (e) {}

  // Public Probe 2: wp-login.php endpoint
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://${cleanDomain}/wp-login.php`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'HospesAi-WP-Probe/1.0' }
    });
    clearTimeout(to);

    if (res.status === 200 || res.status === 302) {
      const text = await res.text().catch(() => '');
      if (text.includes('wp-login') || text.includes('wordpress')) {
        isWordPress = true;
        loginPageAccessible = true;
      }
    } else if (res.status === 500) {
      errorSignatures.push('wp-login.php returns HTTP 500 Internal Server Error');
      isWordPress = true;
    }
  } catch (e) {}

  // Public Probe 3: Inspect HTML body for generator / wp-content
  if (!isWordPress) {
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://${cleanDomain}`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'HospesAi-WP-Probe/1.0' }
      });
      clearTimeout(to);

      const html = await res.text().catch(() => '');
      if (html.includes('/wp-content/') || html.includes('/wp-includes/') || html.includes('name="generator" content="WordPress')) {
        isWordPress = true;
      }
    } catch (e) {}
  }

  return {
    domain: cleanDomain,
    checkedAt: new Date().toISOString(),
    isWordPress,
    publicCheck: {
      hasRestApi,
      restApiData,
      loginPageAccessible,
      detectedThemesOrPlugins,
      errorSignatures
    },
    authenticatedAccess: {
      connected: false,
      message: 'No authenticated WordPress application credentials connected for this domain.'
    }
  };
}
