import { Actor, log } from 'apify';
import { CheerioCrawler, PlaywrightCrawler } from 'crawlee';
import { launchOptions as camoufoxLaunchOptions } from 'camoufox-js';
import { firefox } from 'playwright';
import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';

// ============================================================================
// COMPUTRABAJO JOBS SCRAPER - PRODUCTION READY
// Strategy: HTTP First → HTML Parsing → JSON-LD → Browser Fallback
// ============================================================================

await Actor.init();

/**
 * Parse job listing from HTML element
 */
function parseJobFromElement($, $el) {
    try {
        // Title and URL
        const titleSelectors = ['h2 a', 'h3 a', '.js-o-link', 'a[data-title]'];
        let title = '';
        let url = '';

        for (const selector of titleSelectors) {
            const el = $el.find(selector).first();
            if (el.length && el.text().trim()) {
                title = el.text().trim();
                url = el.attr('href') || '';
                break;
            }
        }

        if (!title) {
            title = $el.attr('data-title') || '';
        }

        if (!title) return null;

        // Company
        let company = '';
        const companySelectors = ['.fs16.fc_base.mt5', '.company', 'p.fs16.fc_base'];
        for (const selector of companySelectors) {
            const el = $el.find(selector).first();
            if (el.length && el.text().trim()) {
                company = el.text().trim();
                break;
            }
        }

        // Location
        let location = '';
        const locationSelectors = ['.fs13.fc_base', '.location', 'p.fs13'];
        for (const selector of locationSelectors) {
            const el = $el.find(selector).first();
            if (el.length && el.text().trim()) {
                location = el.text().trim();
                break;
            }
        }

        // Salary
        let salary = 'Not specified';
        const salarySelectors = ['.fs16.fc_base', '.salary', 'p.fs16:not(.mt5)'];
        for (const selector of salarySelectors) {
            const el = $el.find(selector).first();
            const text = el.text().trim();
            if (el.length && text && text.length > 2 && text !== company && text !== location) {
                salary = text;
                break;
            }
        }

        // Description
        let description = '';
        const descSelectors = ['.fs13.fc_base.mt10', '.description', 'p.fs13.fc_base'];
        for (const selector of descSelectors) {
            const el = $el.find(selector).first();
            if (el.length && el.text().trim()) {
                description = el.text().trim();
                break;
            }
        }

        // Posted date
        let postedDate = '';
        const dateSelectors = ['.fs13.fc_aux', '.date', 'p.fs13.fc_aux'];
        for (const selector of dateSelectors) {
            const el = $el.find(selector).first();
            if (el.length && el.text().trim()) {
                postedDate = el.text().trim();
                break;
            }
        }

        return {
            title,
            company,
            location,
            salary,
            jobType: 'Not specified',
            postedDate,
            descriptionHtml: description,
            descriptionText: description,
            url: url.startsWith('http') ? url : url.startsWith('/') ? url : `/${url}`,
            scrapedAt: new Date().toISOString()
        };
    } catch (err) {
        log.debug(`Error parsing job element: ${err.message}`);
        return null;
    }
}

/**
 * STRATEGY 1: Extract jobs via internal API (HTTP + JSON)
 * Most efficient - no browser needed, pure JSON parsing
 */
async function extractJobsViaAPI(url, proxyUrl) {
    log.info('Strategy 1: Attempting to extract jobs via internal API (HTTP + JSON)');

    try {
        // Try common API endpoints
        const apiEndpoints = [
            url.replace('/empleos-de-', '/api/search?q=') + '&limit=100',
            url + '?format=json',
            new URL(url).origin + '/api/jobs',
        ];

        for (const endpoint of apiEndpoints) {
            try {
                const response = await gotScraping({
                    url: endpoint,
                    proxyUrl,
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    },
                    timeout: { request: 10000 },
                    retry: { limit: 1 },
                });

                if (response.statusCode === 200) {
                    try {
                        const data = JSON.parse(response.body);
                        const jobs = extractJobsFromAPIResponse(data);

                        if (jobs.length > 0) {
                            log.info(`✓ API extraction successful: ${jobs.length} jobs from ${endpoint}`);
                            return { jobs, method: 'API' };
                        }
                    } catch (parseErr) {
                        log.debug(`Failed to parse JSON from ${endpoint}: ${parseErr.message}`);
                    }
                }
            } catch (err) {
                log.debug(`API endpoint failed: ${endpoint} - ${err.message}`);
            }
        }

        return { jobs: [], method: 'API' };
    } catch (error) {
        log.warning(`API extraction failed: ${error.message}`);
        return { jobs: [], method: 'API' };
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
    log.info('Strategy 2: Extracting jobs via pure HTML parsing (HTTP + Cheerio)');

    try {
        const $ = cheerio.load(html);
        const jobs = [];

        // Find job elements
        const selectors = ['article.box_offer', 'div.bRS.bClick', 'article[data-id]', 'article.offer', '.job-item'];
        let jobElements = $([]);

        for (const selector of selectors) {
            jobElements = $(selector);
            if (jobElements.length > 0) {
                log.info(`✓ Found ${jobElements.length} job cards using selector: ${selector}`);
                break;
            }
        }

        jobElements.each((_, el) => {
            const job = parseJobFromElement($, $(el));
            if (job) {
                // Complete URL
                if (job.url && !job.url.startsWith('http')) {
                    job.url = job.url.startsWith('/') ? `${baseUrl}${job.url}` : `${baseUrl}/${job.url}`;
                }
                jobs.push(job);
            }
        });

        if (jobs.length > 0) {
            log.info(`✓ HTML extraction successful: ${jobs.length} jobs`);
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
    log.info('Strategy 3: Attempting to extract jobs from JSON-LD structured data');

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
            log.info(`✓ JSON-LD extraction successful: ${jobs.length} jobs`);
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

/**
 * STRATEGY 4: Browser fallback (LAST RESORT)
 * Only used if HTTP methods fail
 */
async function extractJobsViaBrowser(searchUrl, proxyConfiguration) {
    log.warning('Strategy 4: All HTTP methods failed. Using browser fallback (slower)...');

    try {
        const proxyUrl = await proxyConfiguration.newUrl();
        let totalJobs = [];
        let extractionMethod = 'Browser';

        const crawler = new PlaywrightCrawler({
            proxyConfiguration,
            maxRequestsPerCrawl: 10,
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

                try {
                    await page.goto(request.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

                    const html = await page.content();
                    const baseUrl = new URL(request.url).origin;

                    // Try extraction methods
                    let result = await extractJobsViaHTML(html, baseUrl);
                    if (result.jobs.length === 0) {
                        result = extractJobsViaJsonLD(html);
                    }

                    totalJobs.push(...result.jobs);
                    log.info(`Browser: Extracted ${result.jobs.length} jobs`);

                } catch (error) {
                    log.error(`Browser request failed: ${error.message}`);
                }
            },

            async failedRequestHandler({ request }, error) {
                log.error(`Browser request failed: ${request.url} - ${error.message}`);
            }
        });

        await crawler.run([searchUrl]);
        return { jobs: totalJobs, method: extractionMethod };

    } catch (error) {
        log.error(`Browser fallback failed: ${error.message}`);
        return { jobs: [], method: 'Browser' };
    }
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

    return url;
}

/**
 * Handle pagination
 */
async function fetchNextPages(baseUrl, proxyUrl, currentPageNum, maxPages) {
    const pages = [];

    for (let page = currentPageNum + 1; page <= maxPages && page <= currentPageNum + 5; page++) {
        const url = `${baseUrl}?p=${page}`;

        try {
            const response = await gotScraping({
                url,
                proxyUrl,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: { request: 10000 },
                retry: { limit: 1 },
            });

            if (response.statusCode === 200) {
                const $ = cheerio.load(response.body);
                const jobElements = $('article.box_offer, div.bRS.bClick, article[data-id]');

                if (jobElements.length > 0) {
                    pages.push({ url, html: response.body });
                } else {
                    log.info(`No jobs on page ${page}, stopping pagination`);
                    break;
                }
            } else {
                log.info(`Page ${page} returned ${response.statusCode}, stopping pagination`);
                break;
            }
        } catch (err) {
            log.debug(`Failed to fetch page ${page}: ${err.message}`);
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

    log.info('🚀 Starting Computrabajo Jobs Scraper (Production Ready)', {
        country: input.country,
        searchQuery: input.searchQuery,
        maxJobs: input.maxJobs
    });

    // Validation
    const maxJobs = Math.min(input.maxJobs ?? 50, 10000);
    if (maxJobs < 0) throw new Error('maxJobs must be non-negative');

    const searchUrl = buildSearchUrl(input);
    const baseUrl = new URL(searchUrl).origin;

    log.info(`Search URL: ${searchUrl}`);

    // Proxy configuration
    const proxyConfiguration = await Actor.createProxyConfiguration(
        input.proxyConfiguration || {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL']
        }
    );

    const proxyUrl = await proxyConfiguration.newUrl();

    // Statistics
    const stats = {
        totalJobs: 0,
        extractionMethod: 'None',
        pagesProcessed: 0,
        startTime: Date.now(),
        timestamp: new Date().toISOString()
    };

    const seenUrls = new Set();
    let allJobs = [];

    // ========================================================================
    // PRIORITY 1: Try HTTP + JSON API extraction
    // ========================================================================
    log.info('=== STARTING EXTRACTION STRATEGY ===');
    let result = await extractJobsViaAPI(searchUrl, proxyUrl);

    if (result.jobs.length > 0) {
        stats.extractionMethod = result.method;
        stats.pagesProcessed = 1;
        log.info(`✓ Success with ${result.method}: ${result.jobs.length} jobs`);
        allJobs = result.jobs;
    } else {
        // ====================================================================
        // PRIORITY 2: Try HTTP + HTML parsing with got-scraping
        // ====================================================================
        log.info('API extraction failed, trying HTML extraction...');

        try {
            const response = await gotScraping({
                url: searchUrl,
                proxyUrl,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: { request: 15000 },
                retry: { limit: 2 },
            });

            if (response.statusCode === 200) {
                result = await extractJobsViaHTML(response.body, baseUrl);

                if (result.jobs.length === 0) {
                    result = extractJobsViaJsonLD(response.body);
                }

                stats.extractionMethod = result.method;
                stats.pagesProcessed = 1;
                allJobs = result.jobs;
                log.info(`✓ Success with ${result.method}: ${result.jobs.length} jobs`);
            } else {
                log.warning(`HTTP request failed with status ${response.statusCode}`);
                throw new Error(`HTTP ${response.statusCode}`);
            }
        } catch (httpErr) {
            log.warning(`HTTP extraction failed: ${httpErr.message}`);

            // ================================================================
            // PRIORITY 4: Browser fallback (last resort)
            // ================================================================
            result = await extractJobsViaBrowser(searchUrl, proxyConfiguration);
            stats.extractionMethod = result.method;
            allJobs = result.jobs;
        }
    }

    // Handle pagination
    if (allJobs.length < maxJobs && stats.extractionMethod !== 'Browser') {
        log.info(`Attempting pagination... (have ${allJobs.length}/${maxJobs} jobs)`);

        const paginatedPages = await fetchNextPages(searchUrl, proxyUrl, 1, Math.ceil(maxJobs / 20));

        for (const page of paginatedPages) {
            if (allJobs.length >= maxJobs) break;

            const result = await extractJobsViaHTML(page.html, baseUrl);
            allJobs.push(...result.jobs);
            stats.pagesProcessed++;
            log.info(`Pagination: Page ${stats.pagesProcessed} - ${result.jobs.length} jobs`);
        }
    }

    // Deduplicate
    const uniqueJobs = [];
    for (const job of allJobs) {
        if (!seenUrls.has(job.url)) {
            seenUrls.add(job.url);
            uniqueJobs.push(job);
            if (uniqueJobs.length >= maxJobs) break;
        }
    }

    // Save jobs
    if (uniqueJobs.length > 0) {
        await Actor.pushData(uniqueJobs);
        stats.totalJobs = uniqueJobs.length;
        log.info(`✓ Saved ${uniqueJobs.length} jobs to dataset`);
    }

    // Statistics
    stats.duration = `${Math.round((Date.now() - stats.startTime) / 1000)}s`;
    await Actor.setValue('statistics', stats);

    log.info('✓ Scraping completed successfully!', stats);

} catch (error) {
    log.exception(error, 'Fatal error');
    throw error;
}

await Actor.exit();
