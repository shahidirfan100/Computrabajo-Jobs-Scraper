# Computrabajo Jobs Scraper

<p align="center">
  <strong>Extract comprehensive job listings from Computrabajo across 14 Latin American countries</strong>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#features">Features</a> •
  <a href="#usage">Usage</a> •
  <a href="#input">Input</a> •
  <a href="#output">Output</a> •
  <a href="#examples">Examples</a>
</p>

---

## Overview

**Computrabajo Jobs Scraper** is a powerful extraction tool designed for the leading job search platform in Latin America. Extract structured job data from Argentina, Mexico, Colombia, Peru, Chile, and 9 other countries with comprehensive filtering and enrichment capabilities.

<h3>Perfect For</h3>

<ul>
  <li><strong>Recruitment Agencies</strong> - Automate candidate sourcing across Latin American markets</li>
  <li><strong>Job Aggregators</strong> - Build comprehensive employment databases for LATAM</li>
  <li><strong>Market Research</strong> - Analyze regional employment trends and salary data</li>
  <li><strong>HR Analytics</strong> - Track hiring patterns across industries and locations</li>
  <li><strong>Career Platforms</strong> - Integrate fresh job listings automatically</li>
  <li><strong>Competitive Intelligence</strong> - Monitor competitor hiring activities</li>
</ul>

---

## Features

<table>
<tr>
<td width="50%">

### 🌎 Multi-Country Support
<ul>
  <li>14 Latin American countries</li>
  <li>Argentina, Mexico, Colombia, Peru</li>
  <li>Chile, Ecuador, Venezuela, Panama</li>
  <li>Costa Rica, Guatemala, Bolivia</li>
  <li>Uruguay, Dominican Republic, Nicaragua</li>
</ul>

### 🔍 Advanced Extraction
<ul>
  <li>JSON-LD structured data parsing</li>
  <li>HTML parsing with multiple fallbacks</li>
  <li>Full job description enrichment</li>
  <li>Automatic pagination handling</li>
</ul>

</td>
<td width="50%">

### 📊 Rich Data Output
<ul>
  <li>Job titles and descriptions</li>
  <li>Company names</li>
  <li>Location information</li>
  <li>Salary ranges (when available)</li>
  <li>Employment types</li>
  <li>Posted dates</li>
  <li>Direct application URLs</li>
</ul>

### ⚡ High Performance
<ul>
  <li>Smart deduplication</li>
  <li>Concurrent processing</li>
  <li>Residential proxy support</li>
  <li>Anti-bot bypass</li>
</ul>

</td>
</tr>
</table>

---

## Usage

### Basic Configuration

<h4>Quick Start</h4>

```json
{
  "country": "ar",
  "searchQuery": "administracion-y-oficina",
  "maxJobs": 50
}
```

<h4>Advanced Configuration</h4>

```json
{
  "country": "mx",
  "searchQuery": "tecnologia-sistemas",
  "location": "ciudad-de-mexico",
  "maxJobs": 100,
  "includeFullDescription": true,
  "jobType": "tiempo-completo",
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

<h4>Using Direct URL</h4>

```json
{
  "searchUrl": "https://ar.computrabajo.com/empleos-de-ventas",
  "maxJobs": 50
}
```

---

## Input

<h3>Configuration Parameters</h3>

<table>
<thead>
<tr>
<th>Parameter</th>
<th>Type</th>
<th>Required</th>
<th>Description</th>
</tr>
</thead>
<tbody>

<tr>
<td><code>searchUrl</code></td>
<td>string</td>
<td>No</td>
<td>
Direct Computrabajo search URL. If provided, other search parameters are ignored.<br>
<strong>Example:</strong> <code>https://ar.computrabajo.com/empleos-de-administracion-y-oficina</code>
</td>
</tr>

<tr>
<td><code>country</code></td>
<td>string</td>
<td>No</td>
<td>
Country code for Computrabajo domain.<br>
<strong>Default:</strong> <code>ar</code> (Argentina)<br>
<strong>Options:</strong> ar, mx, co, pe, cl, ec, ve, pa, cr, gt, bo, uy, do, ni
</td>
</tr>

<tr>
<td><code>searchQuery</code></td>
<td>string</td>
<td>No</td>
<td>
Job category or keywords in URL-friendly format.<br>
<strong>Default:</strong> <code>administracion-y-oficina</code><br>
<strong>Examples:</strong> tecnologia-sistemas, ventas, marketing
</td>
</tr>

<tr>
<td><code>location</code></td>
<td>string</td>
<td>No</td>
<td>
Specific city or location within country (optional).<br>
<strong>Example:</strong> <code>buenos-aires</code>, <code>ciudad-de-mexico</code>
</td>
</tr>

<tr>
<td><code>maxJobs</code></td>
<td>integer</td>
<td>No</td>
<td>
Maximum number of jobs to scrape. Set to <code>0</code> for unlimited.<br>
<strong>Default:</strong> <code>50</code><br>
<strong>Range:</strong> 0-10000
</td>
</tr>

<tr>
<td><code>includeFullDescription</code></td>
<td>boolean</td>
<td>No</td>
<td>
Fetch complete job descriptions from detail pages (slower but comprehensive).<br>
<strong>Default:</strong> <code>true</code>
</td>
</tr>

<tr>
<td><code>jobType</code></td>
<td>string</td>
<td>No</td>
<td>
Filter by employment type.<br>
<strong>Default:</strong> <code>all</code><br>
<strong>Options:</strong> all, tiempo-completo, medio-tiempo, temporal, freelance, practicas
</td>
</tr>

<tr>
<td><code>proxyConfiguration</code></td>
<td>object</td>
<td>No</td>
<td>
Proxy settings for anti-bot protection. Residential proxies strongly recommended.<br>
<strong>Default:</strong> Uses Apify Residential Proxy
</td>
</tr>

</tbody>
</table>

---

## Output

<h3>Data Structure</h3>

Each job listing returns the following structured data:

```json
{
  "title": "Administrador de Oficina",
  "company": "Empresa ABC S.A.",
  "location": "Buenos Aires, Capital Federal",
  "salary": "$50,000 - $70,000 ARS",
  "jobType": "Tiempo completo",
  "postedDate": "Hace 2 días",
  "descriptionHtml": "<p>Descripción completa del puesto...</p>",
  "descriptionText": "Descripción completa del puesto...",
  "url": "https://ar.computrabajo.com/trabajo-de-administrador-123456",
  "scrapedAt": "2025-12-27T10:30:00.000Z"
}
```

<h3>Output Formats</h3>

<ul>
  <li><strong>JSON</strong> - Structured data for API integration</li>
  <li><strong>CSV</strong> - Spreadsheet-compatible format</li>
  <li><strong>Excel</strong> - Business-ready reports</li>
  <li><strong>HTML Table</strong> - Visual presentation</li>
</ul>

<h3>Field Descriptions</h3>

<table>
<thead>
<tr>
<th>Field</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>

<tr>
<td><code>title</code></td>
<td>string</td>
<td>Job title or position name</td>
</tr>

<tr>
<td><code>company</code></td>
<td>string</td>
<td>Hiring company name</td>
</tr>

<tr>
<td><code>location</code></td>
<td>string</td>
<td>Geographic location of the job</td>
</tr>

<tr>
<td><code>salary</code></td>
<td>string</td>
<td>Salary range or compensation (when available)</td>
</tr>

<tr>
<td><code>jobType</code></td>
<td>string</td>
<td>Employment type (full-time, part-time, etc.)</td>
</tr>

<tr>
<td><code>postedDate</code></td>
<td>string</td>
<td>When the job was posted</td>
</tr>

<tr>
<td><code>descriptionHtml</code></td>
<td>string</td>
<td>Full job description with HTML formatting</td>
</tr>

<tr>
<td><code>descriptionText</code></td>
<td>string</td>
<td>Plain text version of job description</td>
</tr>

<tr>
<td><code>url</code></td>
<td>string</td>
<td>Direct link to job posting</td>
</tr>

<tr>
<td><code>scrapedAt</code></td>
<td>string</td>
<td>Timestamp when data was extracted (ISO 8601)</td>
</tr>

</tbody>
</table>

---

## Examples

<h3>Example 1: Argentina Administration Jobs</h3>

<details>
<summary><strong>Click to expand configuration</strong></summary>

```json
{
  "country": "ar",
  "searchQuery": "administracion-y-oficina",
  "location": "buenos-aires",
  "maxJobs": 100,
  "includeFullDescription": true
}
```

**Use Case:** Extract administration and office jobs in Buenos Aires for recruitment database.

</details>

<h3>Example 2: Mexico Technology Jobs</h3>

<details>
<summary><strong>Click to expand configuration</strong></summary>

```json
{
  "country": "mx",
  "searchQuery": "tecnologia-sistemas",
  "maxJobs": 50,
  "jobType": "tiempo-completo"
}
```

**Use Case:** Monitor full-time technology positions across Mexico.

</details>

<h3>Example 3: Colombia Sales Jobs</h3>

<details>
<summary><strong>Click to expand configuration</strong></summary>

```json
{
  "country": "co",
  "searchQuery": "ventas",
  "location": "bogota",
  "maxJobs": 75,
  "includeFullDescription": true
}
```

**Use Case:** Build a sales job database for Bogotá market analysis.

</details>

<h3>Example 4: Direct URL Scraping</h3>

<details>
<summary><strong>Click to expand configuration</strong></summary>

```json
{
  "searchUrl": "https://pe.computrabajo.com/empleos-de-ingenieria",
  "maxJobs": 100,
  "includeFullDescription": true
}
```

**Use Case:** Extract engineering jobs from Peru using a specific search URL.

</details>

<h3>Example 5: Quick Snippet Extraction</h3>

<details>
<summary><strong>Click to expand configuration</strong></summary>

```json
{
  "country": "cl",
  "searchQuery": "marketing",
  "maxJobs": 30,
  "includeFullDescription": false
}
```

**Use Case:** Quick extraction of marketing job snippets without full descriptions (faster).

</details>

---

## Best Practices

<h3>✅ Optimization Tips</h3>

<ol>
  <li><strong>Use Residential Proxies:</strong> Essential for reliable scraping and avoiding blocks</li>
  <li><strong>Set Reasonable Limits:</strong> Start with <code>maxJobs: 50</code> for testing</li>
  <li><strong>Enable Full Descriptions:</strong> Set <code>includeFullDescription: true</code> for comprehensive data</li>
  <li><strong>Country-Specific Searches:</strong> Use appropriate country codes for regional targeting</li>
  <li><strong>URL Format:</strong> Use hyphens for multi-word search queries (e.g., <code>recursos-humanos</code>)</li>
</ol>

<h3>⚠️ Important Notes</h3>

<ul>
  <li>Residential proxies are strongly recommended for Computrabajo</li>
  <li>Extraction speed depends on <code>includeFullDescription</code> setting</li>
  <li>Some job listings may not include salary information</li>
  <li>Automatic deduplication prevents duplicate job entries</li>
  <li>Pagination is handled automatically up to <code>maxJobs</code> limit</li>
</ul>

---

## Technical Details

<h3>Extraction Methods</h3>

<p>The scraper uses a multi-strategy approach for maximum reliability:</p>

<ol>
  <li><strong>JSON-LD Parsing:</strong> Extracts structured data from schema.org markup (fastest and most reliable)</li>
  <li><strong>HTML Parsing:</strong> Fallback method using CSS selectors for job cards and details</li>
  <li><strong>Full Description Enrichment:</strong> Optional detailed scraping from individual job pages</li>
</ol>

<h3>Anti-Bot Protection</h3>

<p>Built-in features to ensure successful scraping:</p>

<ul>
  <li>Residential proxy support with GeoIP matching</li>
  <li>Cloudflare challenge handling</li>
  <li>Realistic browser fingerprinting</li>
  <li>Smart request timing and delays</li>
</ul>

<h3>Performance</h3>

<table>
<tr>
<td><strong>Concurrency:</strong></td>
<td>2 parallel requests</td>
</tr>
<tr>
<td><strong>Speed:</strong></td>
<td>~50 jobs in 60-90 seconds (with full descriptions)</td>
</tr>
<tr>
<td><strong>Reliability:</strong></td>
<td>Built-in retries and error handling</td>
</tr>
<tr>
<td><strong>Pagination:</strong></td>
<td>Automatic until maxJobs reached</td>
</tr>
</table>

---

## Supported Countries

<table>
<thead>
<tr>
<th>Country</th>
<th>Code</th>
<th>Domain</th>
</tr>
</thead>
<tbody>
<tr><td>🇦🇷 Argentina</td><td><code>ar</code></td><td>ar.computrabajo.com</td></tr>
<tr><td>🇲🇽 Mexico</td><td><code>mx</code></td><td>mx.computrabajo.com</td></tr>
<tr><td>🇨🇴 Colombia</td><td><code>co</code></td><td>co.computrabajo.com</td></tr>
<tr><td>🇵🇪 Peru</td><td><code>pe</code></td><td>pe.computrabajo.com</td></tr>
<tr><td>🇨🇱 Chile</td><td><code>cl</code></td><td>cl.computrabajo.com</td></tr>
<tr><td>🇪🇨 Ecuador</td><td><code>ec</code></td><td>ec.computrabajo.com</td></tr>
<tr><td>🇻🇪 Venezuela</td><td><code>ve</code></td><td>ve.computrabajo.com</td></tr>
<tr><td>🇵🇦 Panama</td><td><code>pa</code></td><td>pa.computrabajo.com</td></tr>
<tr><td>🇨🇷 Costa Rica</td><td><code>cr</code></td><td>cr.computrabajo.com</td></tr>
<tr><td>🇬🇹 Guatemala</td><td><code>gt</code></td><td>gt.computrabajo.com</td></tr>
<tr><td>🇧🇴 Bolivia</td><td><code>bo</code></td><td>bo.computrabajo.com</td></tr>
<tr><td>🇺🇾 Uruguay</td><td><code>uy</code></td><td>uy.computrabajo.com</td></tr>
<tr><td>🇩🇴 Dominican Republic</td><td><code>do</code></td><td>do.computrabajo.com</td></tr>
<tr><td>🇳🇮 Nicaragua</td><td><code>ni</code></td><td>ni.computrabajo.com</td></tr>
</tbody>
</table>

---

## Troubleshooting

<h3>Common Issues</h3>

<details>
<summary><strong>No jobs found</strong></summary>

<ul>
  <li>Verify the search query format (use hyphens, not spaces)</li>
  <li>Check if the country code is correct</li>
  <li>Try using a direct <code>searchUrl</code> instead</li>
  <li>Ensure residential proxies are enabled</li>
</ul>
</details>

<details>
<summary><strong>Slow extraction</strong></summary>

<ul>
  <li>Set <code>includeFullDescription: false</code> for faster results</li>
  <li>Reduce <code>maxJobs</code> for testing</li>
  <li>Check proxy performance</li>
</ul>
</details>

<details>
<summary><strong>Blocked requests</strong></summary>

<ul>
  <li>Enable residential proxies in <code>proxyConfiguration</code></li>
  <li>Reduce concurrency if hitting rate limits</li>
  <li>Verify Apify proxy credits are available</li>
</ul>
</details>

---

## FAQ

<details>
<summary><strong>How many jobs can I scrape?</strong></summary>
<p>You can set <code>maxJobs</code> from 0 (unlimited) to 10,000. For most use cases, 50-100 jobs per run is recommended.</p>
</details>

<details>
<summary><strong>Do I need proxies?</strong></summary>
<p>Yes, residential proxies are strongly recommended for Computrabajo to avoid blocks and ensure reliable scraping.</p>
</details>

<details>
<summary><strong>How long does scraping take?</strong></summary>
<p>Approximately 60-90 seconds for 50 jobs with full descriptions. Without full descriptions, it's much faster (~30 seconds).</p>
</details>

<details>
<summary><strong>Can I scrape multiple countries at once?</strong></summary>
<p>Run separate Actor instances for each country for optimal performance and organization.</p>
</details>

<details>
<summary><strong>What if salary information is missing?</strong></summary>
<p>Not all job listings include salary data. The field will show "Not specified" when unavailable.</p>
</details>

---

## License

<p>Apache-2.0</p>

---

## Support

<p>For issues, questions, or feature requests:</p>

<ul>
  <li>Check the <a href="#troubleshooting">Troubleshooting</a> section</li>
  <li>Review <a href="#examples">Examples</a> for common use cases</li>
  <li>Contact Apify support for technical assistance</li>
</ul>

---

<p align="center">
  <strong>Built for the Apify platform | Optimized for Latin American job markets</strong>
</p>
