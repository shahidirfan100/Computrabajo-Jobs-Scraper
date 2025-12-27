import { Actor, log } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { launchOptions as camoufoxLaunchOptions } from 'camoufox-js';
import { firefox } from 'playwright';
import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { CookieJar } from 'tough-cookie';

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function pushJobsInBatches(jobs, batchSize = 10) {
    for (let i = 0; i < jobs.length; i += batchSize) {
        const slice = jobs.slice(i, i + batchSize);
        if (slice.length) await Actor.pushData(slice);
    }
}

function formatDescription(descHtml, descText) {
    const html = (descHtml || '').trim();
    if (html) return html;
    const text = (descText || '').trim();
    if (!text) return '<p>Not specified</p>';
    return `<p>${text.replace(/\n+/g, '<br>')}</p>`;
}

function buildStealthHeaders({ baseUrl, referer, userAgent }) {
    return {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        Referer: referer || baseUrl,
        Origin: baseUrl,
    };
}

function normalizeUrl(url, baseUrl) {
    if (!url) return '';
    try {
        return new URL(url, baseUrl).toString();
    } catch {
        return url;
    }
}

function createHttpClient(proxyUrl, baseUrl) {
    const cookieJar = new CookieJar();
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const defaultHeaders = buildStealthHeaders({ baseUrl, userAgent });

    const request = async (options = {}) => {
        const jitter = 200 + Math.random() * 400;
        await sleep(jitter);

        const timeout =
            typeof options.timeout === 'number'
                ? { request: options.timeout }
                : { request: 12000, ...(options.timeout || {}) };

        return gotScraping({
            http2: true,
            proxyUrl,
            cookieJar,
            throwHttpErrors: false,
            timeout,
            retry: { limit: 1 },
            headers: { ...defaultHeaders, ...(options.headers || {}) },
            ...options,
        });
    };

    return { request, cookieJar, userAgent };
}

// ============================================================================
// COMPUTRABAJO JOBS SCRAPER - PRODUCTION READY
// Hybrid: Playwright for listing (bypass) + Cheerio/got for fast detail pages
// ============================================================================

await Actor.init();

/**
 * Parse job listing from HTML element
 */
function parseJobFromElement($, $el, baseUrl) {
    try {
        // Title and URL
        const titleSelectors = ['h2 a', 'h3 a', '.js-o-link', 'a[data-title]', '.jtitle', 'a[href*="/ofertas-"]'];
        let title = '';
        let url = '';

        for (const selector of titleSelectors) {
            const el = $el.find(selector).first();
            if (el.length && el.text().trim()) {
                title = el.text().trim();
                url = normalizeUrl(el.attr('href') || '', baseUrl);
                break;
            }
        }

        if (!title) {
            title = $el.attr('data-title') || $el.attr('title') || '';
        }

        if (!title) return null;

        // Company
        let company = '';
        const companySelectors = [
            '.fs16.fc_base.mt5',
            '.company',
            'p.fs16.fc_base',
            '.fs16.fc_base a',
            '.js-o-link[data-company]',
            '[data-company]',
            '[itemprop="hiringOrganization"]',
            '[data-cy="company"]',
        ];
        for (const selector of companySelectors) {
            const el = $el.find(selector).first();
            if (el.length && el.text().trim()) {
                company = el.text().trim();
                break;
            }
        }
        if (!company) {
            company = $el.attr('data-company') || '';
        }

        // Location
        let location = '';
        const locationSelectors = [
            '.fs13.fc_base',
            '.location',
            'p.fs13',
            '.tag_base',
            '.fs13.fc_aux:not(.t_date)',
            '[data-cy="location"]',
            '[itemprop="addressLocality"]',
        ];
        for (const selector of locationSelectors) {
            const el = $el.find(selector).first();
            if (el.length && el.text().trim()) {
                location = el.text().trim();
                break;
            }
        }

        // Salary
        let salary = 'Not specified';
        const salarySelectors = [
            '.fs16.fc_base',
            '.salary',
            'p.fs16:not(.mt5)',
            '.bCS.b-salary',
            '[data-salary]',
            '[data-cy="salary"]',
            '.fs13.fc_aux.salary',
        ];
        for (const selector of salarySelectors) {
            const el = $el.find(selector).first();
            const text = el.text().trim();
            if (el.length && text && text.length > 2 && text !== company && text !== location) {
                salary = text;
                break;
            }
        }
        if (salary === 'Not specified') {
            const attrSalary = $el.attr('data-salary');
            if (attrSalary && attrSalary.trim()) salary = attrSalary.trim();
        }

        // Description
        let description = '';
        let descriptionHtml = '';
        const descSelectors = ['.fs13.fc_base.mt10', '.description', 'p.fs13.fc_base', 'p.fs13.fc_base.mt5'];
        for (const selector of descSelectors) {
            const el = $el.find(selector).first();
            if (el.length && el.text().trim()) {
                description = el.text().trim();
                descriptionHtml = el.html() || '';
                break;
            }
        }

        // Posted date
        let postedDate = '';
        const dateSelectors = [
            '.fs13.fc_aux',
            '.date',
            'p.fs13.fc_aux',
            '.fs13.fc_aux.t_date',
            'time[datetime]',
            '[data-cy="postedDate"]',
        ];
        for (const selector of dateSelectors) {
            const el = $el.find(selector).first();
            if (el.length && el.text().trim()) {
                postedDate = el.attr('datetime')?.trim() || el.text().trim();
                break;
            }
        }
        if (!postedDate) {
            postedDate = $el.attr('data-date') || '';
        }

        return {
            title,
            company,
            location,
            salary,
            jobType: 'Not specified',
            postedDate,
            descriptionHtml: formatDescription(descriptionHtml, description),
            descriptionText: description,
            url,
            scrapedAt: new Date().toISOString()
        };
    } catch (err) {
        log.debug(`Error parsing job element: ${err.message}`);
        return null;
    }
}

/**
 * Extract jobs from various API response structures
 */
function extractJobsFromAPIResponse(data) {
    const jobs = [];

    function findJobArrays(obj, depth = 0) {
        if (depth > 5) return [];
        const found = [];

        if (Array.isArray(obj) && obj.length > 0) {
            const first = obj[0];
            if (typeof first === 'object' && first !== null) {
                const keys = Object.keys(first);
                if (keys.some(k => ['title', 'titulo', 'empresa', 'company'].includes(k.toLowerCase()))) {
                    found.push(obj);
                }
            }
        } else if (typeof obj === 'object' && obj !== null) {
            for (const [key, val] of Object.entries(obj)) {
                if (['jobs', 'ofertas', 'results', 'data', 'items', 'listings'].includes(key.toLowerCase())) {
                    found.push(...findJobArrays(val, depth + 1));
                }
            }
        }

        return found;
    }

    const jobArrays = findJobArrays(data);

    for (const arr of jobArrays) {
        for (const item of arr) {
            jobs.push({
                title: item.title || item.titulo || item.name || '',
                company: item.company || item.empresa || item.nombreEmpresa || '',
                location: item.location || item.ubicacion || item.city || item.ciudad || '',
                salary: item.salary || item.salario || item.sueldo || 'Not specified',
                jobType: item.type || item.tipo || item.employmentType || 'Not specified',
                postedDate: item.date || item.fecha || item.postedDate || item.fechaPublicacion || '',
                descriptionHtml: item.descriptionHtml || item.description || item.descripcion || '',
                descriptionText: item.description ? stripHtml(item.description) : '',
                url: item.url || item.link || item.enlace || '',
                scrapedAt: new Date().toISOString()
            });
        }
    }

    return jobs;
}

/**
 * STRATEGY 2: Extract jobs via pure HTML parsing (HTTP + HTML)
 * Fast and reliable - uses Cheerio, no browser needed
 */
async function extractJobsViaHTML(html, baseUrl) {
    log.debug('Parsing listing HTML with Cheerio');

    try {
        const $ = cheerio.load(html);
        const jobs = [];

        // Find job elements
        const selectors = ['article.box_offer', 'div.bRS.bClick', 'article[data-id]', 'article.offer', '.job-item'];
        let jobElements = $([]);

        for (const selector of selectors) {
            jobElements = $(selector);
            if (jobElements.length > 0) {
                log.debug(`Found ${jobElements.length} job cards using selector: ${selector}`);
                break;
            }
        }

        jobElements.each((_, el) => {
            const job = parseJobFromElement($, $(el), baseUrl);
            if (job) jobs.push(job);
        });

        if (jobs.length > 0) {
            log.debug(`HTML extraction successful: ${jobs.length} jobs`);
        }

        return { jobs, method: 'HTML' };
    } catch (error) {
        log.warning(`HTML extraction failed: ${error.message}`);
        return { jobs: [], method: 'HTML' };
    }
}

/**
 * STRATEGY 3: Extract jobs from JSON-LD structured data
 * Fallback - structured data from HTML
 */
function extractJobsViaJsonLD(html) {
    log.debug('Parsing JSON-LD structured data');

    try {
        const $ = cheerio.load(html);
        const jobs = [];

        $('script[type="application/ld+json"]').each((_, script) => {
            try {
                const data = JSON.parse($(script).html());

                function processData(obj) {
                    if (Array.isArray(obj)) {
                        for (const item of obj) {
                            if (item['@type'] === 'JobPosting') {
                                jobs.push(parseJobPosting(item));
                            }
                        }
                    } else if (obj['@type'] === 'JobPosting') {
                        jobs.push(parseJobPosting(obj));
                    } else if (obj['@graph']) {
                        processData(obj['@graph']);
                    } else if (obj['@type'] === 'ItemList' && obj.itemListElement) {
                        for (const item of obj.itemListElement) {
                            const job = item.item || item;
                            if (job['@type'] === 'JobPosting') {
                                jobs.push(parseJobPosting(job));
                            }
                        }
                    }
                }

                processData(data);
            } catch (err) {
                log.debug(`Failed to parse JSON-LD: ${err.message}`);
            }
        });

        if (jobs.length > 0) {
            log.debug(`OK JSON-LD extraction successful: ${jobs.length} jobs`);
        }

        return { jobs, method: 'JSON-LD' };
    } catch (error) {
        log.warning(`JSON-LD extraction failed: ${error.message}`);
        return { jobs: [], method: 'JSON-LD' };
    }
}

/**
 * Parse JobPosting schema
 */
function parseJobPosting(jobData) {
    const hiringOrg = jobData.hiringOrganization || {};
    const jobLocation = jobData.jobLocation || {};
    const address = jobLocation.address || {};

    let location = '';
    if (typeof address === 'string') {
        location = address;
    } else {
        location = [address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean).join(', ');
    }

    let salary = 'Not specified';
    if (jobData.baseSalary?.value) {
        const value = jobData.baseSalary.value;
        const min = typeof value === 'object' ? value.minValue : value;
        const max = typeof value === 'object' ? value.maxValue : '';
        salary = max ? `${min} - ${max}` : min;
        if (jobData.baseSalary.currency) salary += ` ${jobData.baseSalary.currency}`;
    }

    return {
        title: jobData.title || '',
        company: hiringOrg.name || '',
        location,
        salary,
        jobType: jobData.employmentType || 'Not specified',
        postedDate: jobData.datePosted || '',
        descriptionHtml: jobData.description || '',
        descriptionText: stripHtml(jobData.description || ''),
        url: jobData.url || '',
        scrapedAt: new Date().toISOString()
    };
}

/**
 * Strip HTML tags
 */
function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function findFirstJobPosting($) {
    let found = null;

    $('script[type="application/ld+json"]').each((_, script) => {
        if (found) return;
        try {
            const data = JSON.parse($(script).html() || '{}');

            function scan(obj) {
                if (!obj || found) return;

                if (Array.isArray(obj)) {
                    for (const item of obj) scan(item);
                    return;
                }

                if (obj['@type'] === 'JobPosting') {
                    found = obj;
                    return;
                }

                if (obj['@graph']) {
                    scan(obj['@graph']);
                }

                if (obj['@type'] === 'ItemList' && obj.itemListElement) {
                    scan(obj.itemListElement);
                }
            }

            scan(data);
        } catch {
            // Ignore JSON-LD parse issues on detail pages
        }
    });

    return found;
}

function parseJobDetail(html, baseUrl) {
    const $ = cheerio.load(html);
    const jsonJob = findFirstJobPosting($);
    const fromJson = jsonJob ? parseJobPosting(jsonJob) : {};

    const descEl = $(
        '[itemprop="description"], .bVj, .box_detail, .description, .fs16.fc_base.mt20, #descripcion-oferta, .bWord, div.description_offer',
    ).first();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const descriptionHtml = formatDescription(fromJson.descriptionHtml || descEl.html(), fromJson.descriptionText || descEl.text().trim() || metaDesc);
    const descriptionText = fromJson.descriptionText || stripHtml(descriptionHtml) || metaDesc;

    const company =
        fromJson.company ||
        $('.fc_base.fs20, .fc_base.mt5.fs16, a[data-company], a[data-accion*="Company"]').first().text().trim();

    const location =
        fromJson.location ||
        $('.fc_base.fs13, .fs13.fc_aux:not(.t_date), .tag_base, [data-qa="location"]').first().text().trim();

    const postedDate =
        fromJson.postedDate ||
        $('.fs13.fc_aux.t_date, .t_date, time, [data-qa="postedDate"]').first().text().trim();
    const salary =
        fromJson.salary ||
        $('.bCS.b-salary, .fs16.fc_base:not(.mt5), [data-qa="salary"], .tag_base.salary').first().text().trim();

    return {
        descriptionHtml,
        descriptionText,
        company: company || fromJson.company || '',
        location: location || fromJson.location || '',
        salary: salary || fromJson.salary || 'Not specified',
        jobType: fromJson.jobType || 'Not specified',
        postedDate,
        url: normalizeUrl(fromJson.url || '', baseUrl),
    };
}

async function enrichJobWithDetail(job, httpClient, baseUrl) {
    const detailUrl = normalizeUrl(job.url, baseUrl);
    if (!detailUrl) return job;

    try {
        const response = await httpClient.request({
            url: detailUrl,
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                Referer: baseUrl,
            },
        });

        if (response.statusCode >= 400 || !response.body) return job;

        const detail = parseJobDetail(response.body, baseUrl);
        return {
            ...job,
            url: detailUrl,
            descriptionHtml: formatDescription(detail.descriptionHtml, detail.descriptionText || job.descriptionText),
            descriptionText: detail.descriptionText || job.descriptionText || stripHtml(detail.descriptionHtml),
            company: detail.company || job.company,
            location: detail.location || job.location,
            salary: detail.salary || job.salary,
            jobType: detail.jobType || job.jobType,
            postedDate: detail.postedDate || job.postedDate,
        };
    } catch (err) {
        log.debug(`Failed to enrich job ${detailUrl}: ${err.message}`);
        return job;
    }
}

async function enrichJobsWithDetails(jobs, httpClient, baseUrl, maxConcurrency = 8) {
    const enriched = [];
    let index = 0;

    const worker = async () => {
        while (index < jobs.length) {
            const current = jobs[index];
            index += 1;
            const result = await enrichJobWithDetail(current, httpClient, baseUrl);
            enriched.push(result);
        }
    };

    const workers = Array.from({ length: Math.min(maxConcurrency, jobs.length) }, () => worker());
    await Promise.all(workers);

    return enriched;
}

function findNextPageUrl(html, baseUrl) {
    const $ = cheerio.load(html);
    const selectors = [
        'a[aria-label*="Siguiente"]',
        'a[rel="next"]',
        'a[href*="?p="].page-link',
        'a.bpagSig',
        '.pagination a.next',
        'a[title*="Siguiente"]',
    ];

    for (const selector of selectors) {
        const href = $(selector).attr('href');
        if (href) {
            return normalizeUrl(href, baseUrl);
        }
    }

    return '';
}

/**
 * Playwright listing fetch (bypass blocking), then parse HTML or captured JSON.
 */
async function fetchListingWithBrowser(searchUrl, proxyConfiguration, maxJobs, maxPages) {
    const proxyUrl = await proxyConfiguration.newUrl();
    const baseUrl = new URL(searchUrl).origin;
    let networkPayloads = [];
    const result = { jobs: [], html: '', cookies: [], method: 'Browser-HTML', baseUrl };

    const crawler = new PlaywrightCrawler({
        proxyConfiguration,
        maxRequestsPerCrawl: 1,
        maxConcurrency: 1,
        navigationTimeoutSecs: 45,
        requestHandlerTimeoutSecs: 120,
        launchContext: {
            launcher: firefox,
            launchOptions: await camoufoxLaunchOptions({
                headless: true,
                proxy: proxyUrl,
                geoip: true,
                os: 'windows',
                locale: 'es-ES',
                screen: {
                    minWidth: 1024,
                    maxWidth: 1920,
                    minHeight: 768,
                    maxHeight: 1080,
                },
            }),
        },

        async requestHandler({ page, request }) {
            log.info(`Browser: Processing ${request.url}`);

            await page.addStyleTag({ content: '#pop-up-webpush-background, #pop-up-webpush { display: none !important; pointer-events: none !important; }' }).catch(() => {});
            page.on('response', async (response) => {
                try {
                    const ct = response.headers()['content-type'] || '';
                    const isJson = ct.includes('application/json');
                    const url = response.url();
                    if (!isJson) return;
                    if (!/api|search|ofertas|jobs|empleos/i.test(url)) return;
                    const data = await response.json().catch(() => null);
                    if (data) networkPayloads.push(data);
                } catch {
                    // ignore capture errors
                }
            });

            await page.goto(request.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

            let pageCount = 0;
            let collected = [];

            const processPayloads = () => {
                let added = 0;
                for (const payload of networkPayloads) {
                    const fromApi = extractJobsFromAPIResponse(payload);
                    if (fromApi.length > 0) {
                        collected.push(...fromApi.map(j => ({ ...j, url: normalizeUrl(j.url, baseUrl) })));
                        added += fromApi.length;
                    }
                }
                if (added > 0) result.method = 'Browser-API';
                networkPayloads = [];
            };

            const processHtml = async () => {
                const html = await page.content();
                result.html = html;
                const ldResult = extractJobsViaJsonLD(html);
                if (ldResult.jobs.length > 0) {
                    result.method = 'Browser-JSONLD';
                    collected.push(...ldResult.jobs);
                    return;
                }
                const htmlResult = await extractJobsViaHTML(html, baseUrl);
                if (htmlResult.jobs.length > 0) {
                    result.method = 'Browser-HTML';
                    collected.push(...htmlResult.jobs);
                }
            };

            // First page
            await processPayloads();
            await processHtml();
            pageCount += 1;

            // Paginate via "Next" button (ajax/LinkedIn style)
            while (collected.length < maxJobs && pageCount < maxPages) {
                await page.evaluate(() => {
                    const blocker = document.getElementById('pop-up-webpush-background');
                    if (blocker) blocker.remove();
                }).catch(() => {});

                const nextButton =
                    (await page.$('span.b_primary.w48.buildLink.cp')) ||
                    (await page.$('span.b_primary.w48.buildLink.cp:not([disabled])'));
                if (!nextButton) break;

                await nextButton.click();
                await page.waitForTimeout(800);
                await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

                await processPayloads();
                await processHtml();
                pageCount += 1;
            }

            result.jobs = collected;
            result.cookies = await page.context().cookies();
            log.info(`Browser: Extracted ${result.jobs.length} jobs across ${pageCount} page(s)`);
        },

        async failedRequestHandler({ request }, error) {
            log.error(`Browser request failed: ${request.url} - ${error.message}`);
        }
    });

    await crawler.run([searchUrl]);
    return result;
}

/**
 * Build Computrabajo URL
 */
function buildSearchUrl(input) {
    if (input.searchUrl?.trim()) {
        return input.searchUrl.trim();
    }

    const country = input.country || 'ar';
    const searchQuery = input.searchQuery || 'administracion-y-oficina';
    let url = `https://${country}.computrabajo.com/empleos-de-${searchQuery}`;

    if (input.location?.trim()) {
        const locationSlug = input.location.trim().toLowerCase().replace(/\s+/g, '-');
        url += `-en-${locationSlug}`;
    }

    const params = new URLSearchParams();
    if (input.jobType && input.jobType !== 'all') {
        params.set('trabajo', input.jobType);
    }

    const query = params.toString();
    if (query) {
        url += url.includes('?') ? `&${query}` : `?${query}`;
    }

    return url;
}

/**
 * Handle pagination by following "next" links
 */
function buildPageUrlWithParam(url, pageNum) {
    const u = new URL(url);
    u.searchParams.set('p', String(pageNum));
    return u.toString();
}

async function fetchNextPages({ firstHtml, startUrl, baseUrl, httpClient, maxPages, maxJobs, currentCount }) {
    const pages = [];
    const visited = new Set([startUrl]);
    let currentHtml = firstHtml;
    let currentUrl = startUrl;

    for (let i = 2; i <= maxPages; i++) {
        if (currentCount >= maxJobs) break;

        let nextUrl = findNextPageUrl(currentHtml, baseUrl);
        if (!nextUrl) {
            nextUrl = buildPageUrlWithParam(startUrl, i);
        }

        if (!nextUrl || visited.has(nextUrl)) break;
        visited.add(nextUrl);

        try {
            const response = await httpClient.request({ url: nextUrl });
            if (response.statusCode !== 200 || !response.body) break;

            pages.push({ url: nextUrl, html: response.body });
            currentHtml = response.body;
            currentUrl = nextUrl;
        } catch (err) {
            log.debug(`Failed to fetch page ${nextUrl}: ${err.message}`);
            break;
        }
    }

    return pages;
}

/**
 * Main execution
 */
try {
    const input = await Actor.getInput() || {};

    const maxJobsInput = input.maxJobs ?? 50;
    if (maxJobsInput < 0) throw new Error('maxJobs must be non-negative');
    const maxJobs = maxJobsInput === 0 ? 10000 : Math.min(maxJobsInput, 10000);
    const includeFullDescription = input.includeFullDescription !== false;

    const searchUrl = buildSearchUrl(input);
    const baseUrl = new URL(searchUrl).origin;

    log.info('Starting Computrabajo Jobs Scraper (Production Ready)', {
        country: input.country,
        searchQuery: input.searchQuery,
        maxJobs,
        includeFullDescription,
    });

    const proxyConfiguration = await Actor.createProxyConfiguration(
        input.proxyConfiguration || {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL'],
        },
    );

    const proxyUrl = await proxyConfiguration.newUrl();
    const httpClient = createHttpClient(proxyUrl, baseUrl);

    const stats = {
        totalJobs: 0,
        extractionMethod: 'Browser-HTML',
        pagesProcessed: 0,
        startTime: Date.now(),
        timestamp: new Date().toISOString(),
    };

    const seenUrls = new Set();
    let allJobs = [];

    log.info('=== STARTING PLAYWRIGHT LISTING FETCH ===');
    const listingResult = await fetchListingWithBrowser(searchUrl, proxyConfiguration, maxJobs, Math.ceil(maxJobs / 20) + 2);
    stats.extractionMethod = listingResult.method;
    stats.pagesProcessed = 1;
    allJobs = listingResult.jobs;
    const initialHtml = listingResult.html;

    if (listingResult.cookies?.length) {
        for (const cookie of listingResult.cookies) {
            try {
                const domain = cookie.domain || new URL(baseUrl).hostname;
                const path = cookie.path || '/';
                const value = `${cookie.name}=${cookie.value}; Domain=${domain}; Path=${path}`;
                httpClient.cookieJar.setCookieSync(value, baseUrl);
            } catch {
                // ignore cookie sync issues
            }
        }
    }

    log.info(`Browser listing yielded ${allJobs.length} jobs with method ${listingResult.method}`);

    if (allJobs.length < maxJobs && initialHtml) {
        log.info(`Attempting pagination... (have ${allJobs.length}/${maxJobs} jobs)`);

        const paginatedPages = await fetchNextPages({
            firstHtml: initialHtml,
            startUrl: searchUrl,
            baseUrl,
            httpClient,
            maxPages: Math.ceil(maxJobs / 20) + 2,
            maxJobs,
            currentCount: allJobs.length,
        });

        for (const page of paginatedPages) {
            if (allJobs.length >= maxJobs) break;

            const pageResult = await extractJobsViaHTML(page.html, baseUrl);
            allJobs.push(...pageResult.jobs);
            stats.pagesProcessed += 1;
            log.info(`Pagination: Page ${stats.pagesProcessed} - ${pageResult.jobs.length} jobs`);
        }
    }

    const uniqueJobs = [];
    for (const job of allJobs) {
        const normalizedUrl = normalizeUrl(job.url, baseUrl);
        if (!normalizedUrl) continue;
        if (seenUrls.has(normalizedUrl)) continue;

        seenUrls.add(normalizedUrl);
        uniqueJobs.push({ ...job, url: normalizedUrl });
        if (uniqueJobs.length >= maxJobs) break;
    }

    const chunkSize = 20;
    let totalPushed = 0;
    for (let i = 0; i < uniqueJobs.length; i += chunkSize) {
        let chunk = uniqueJobs.slice(i, i + chunkSize);
        if (includeFullDescription) {
            log.info(`Fetching detail pages for chunk ${i / chunkSize + 1} (${chunk.length} jobs)...`);
            chunk = await enrichJobsWithDetails(chunk, httpClient, baseUrl, Math.min(10, chunk.length));
        }

        const normalizedChunk = chunk.map(job => {
            const descriptionHtml = formatDescription(job.descriptionHtml, job.descriptionText);
            const descriptionText = job.descriptionText || stripHtml(descriptionHtml);
            return {
                title: job.title || 'Not specified',
                company: job.company || 'Not specified',
                location: job.location || 'Not specified',
                salary: job.salary || 'Not specified',
                jobType: job.jobType || 'Not specified',
                postedDate: job.postedDate || '',
                descriptionHtml,
                descriptionText,
                url: job.url,
                scrapedAt: job.scrapedAt || new Date().toISOString(),
            };
        });

        await pushJobsInBatches(normalizedChunk, 10);
        totalPushed += normalizedChunk.length;
        stats.totalJobs = totalPushed;
        log.info(`Pushed ${totalPushed}/${uniqueJobs.length} jobs so far`);
    }

    stats.duration = `${Math.round((Date.now() - stats.startTime) / 1000)}s`;
    stats.detailPagesFetched = includeFullDescription && stats.totalJobs > 0;
    await Actor.setValue('statistics', stats);

    log.info('Scraping completed', stats);

} catch (error) {
    log.exception(error, 'Fatal error');
    throw error;
}

await Actor.exit();


