'use strict';

/**
 * Book Research Module
 *
 * Searches Google Books API and Open Library for books relevant to the
 * lesson topic.  Returns a common ResearchResult shape compatible with
 * the ResearchSource model.
 *
 * APIs:
 *  - Google Books:  https://www.googleapis.com/books/v1/volumes?q=<query>
 *    (key optional – free tier w/ lower quota)
 *  - Open Library: https://openlibrary.org/search.json?q=<query>
 *
 * Env: GOOGLE_BOOKS_API_KEY (optional)
 */

const axios = require('axios');

// ── Common result shape ───────────────────────────────────────────────────────

/**
 * @typedef {object} BookResult
 * @property {string}   sourceType  – always 'book'
 * @property {string}   url         – Google Books info link or Open Library URL
 * @property {string}   title
 * @property {string[]} authors
 * @property {string}   publisher
 * @property {string}   publishedDate
 * @property {string}   isbn
 * @property {string}   description
 * @property {number}   pageCount
 * @property {string}   coverUrl
 * @property {string}   infoLink
 * @property {string}   query
 * @property {boolean}  hallucinated
 */

// ── Google Books ──────────────────────────────────────────────────────────────

async function googleBooksSearch(query) {
  try {
    const params = {
      q:          query,
      maxResults: 5,
      printType:  'books',
      langRestrict: 'en',
    };
    if (process.env.GOOGLE_BOOKS_API_KEY) {
      params.key = process.env.GOOGLE_BOOKS_API_KEY;
    }

    const res = await axios.get('https://www.googleapis.com/books/v1/volumes', {
      params,
      timeout: 10000,
    });

    const items = res.data?.items || [];
    return items.map((item) => {
      const info    = item.volumeInfo || {};
      const imgLinks = info.imageLinks || {};
      return {
        sourceType:    'book',
        url:           info.infoLink || `https://books.google.com/books?id=${item.id}`,
        title:         info.title || '',
        authors:       info.authors || [],
        publisher:     info.publisher || '',
        publishedDate: info.publishedDate || '',
        isbn:          (info.industryIdentifiers || []).find((x) => x.type === 'ISBN_13')?.identifier || '',
        description:   (info.description || '').slice(0, 1000),
        pageCount:     info.pageCount || 0,
        coverUrl:      imgLinks.thumbnail || imgLinks.smallThumbnail || '',
        infoLink:      info.infoLink || '',
        query,
        hallucinated:  false,
      };
    });
  } catch (err) {
    console.warn(`[BookResearch] Google Books failed for "${query}": ${err.message}`);
    return null; // signal caller to try Open Library
  }
}

// ── Open Library ──────────────────────────────────────────────────────────────

async function openLibrarySearch(query) {
  try {
    const res = await axios.get('https://openlibrary.org/search.json', {
      params: { q: query, limit: 5, language: 'eng' },
      timeout: 10000,
    });

    const docs = res.data?.docs || [];
    return docs.slice(0, 5).map((doc) => {
      const coverId = doc.cover_i;
      const coverUrl = coverId
        ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
        : '';
      const isbn = (doc.isbn || [])[0] || '';
      const url  = doc.key
        ? `https://openlibrary.org${doc.key}`
        : `https://openlibrary.org/search?q=${encodeURIComponent(query)}`;

      return {
        sourceType:    'book',
        url,
        title:         doc.title || '',
        authors:       doc.author_name || [],
        publisher:     (doc.publisher || [])[0] || '',
        publishedDate: String(doc.first_publish_year || ''),
        isbn,
        description:   (doc.first_sentence?.value || doc.subtitle || ''),
        pageCount:     doc.number_of_pages_median || 0,
        coverUrl,
        infoLink:      url,
        query,
        hallucinated:  false,
      };
    });
  } catch (err) {
    console.warn(`[BookResearch] Open Library failed for "${query}": ${err.message}`);
    return null;
  }
}

// ── Hallucinated fallback ─────────────────────────────────────────────────────

function hallucinatedResults(query) {
  console.warn('[BookResearch] Using hallucinated book results for query:', query);
  const hash = Buffer.from(query).toString('hex').slice(0, 8);
  return [
    {
      sourceType:    'book',
      url:           `https://openlibrary.org/works/OL${hash}W`,
      title:         `Foundations of ${query}`,
      authors:       ['Dr. Jane Smith', 'Prof. Alan Johnson'],
      publisher:     'Academic Press',
      publishedDate: '2022',
      isbn:          `978${hash.slice(0, 9).padEnd(9, '0')}`,
      description:   `A comprehensive introduction to ${query}, covering theoretical foundations, real-world applications, and best practices for educators and students. Widely used in universities and professional training programs.`,
      pageCount:     320,
      coverUrl:      '',
      infoLink:      `https://openlibrary.org/works/OL${hash}W`,
      query,
      hallucinated:  true,
    },
    {
      sourceType:    'book',
      url:           `https://books.google.com/books?id=bk_${hash}`,
      title:         `${query}: A Practical Guide`,
      authors:       ['Maria Chen'],
      publisher:     'O\'Reilly Media',
      publishedDate: '2021',
      isbn:          `978${(hash + '99').slice(0, 9).padEnd(9, '1')}`,
      description:   `Practical approaches to mastering ${query} with hands-on examples and exercises. Perfect for self-learners and classroom instruction.`,
      pageCount:     256,
      coverUrl:      '',
      infoLink:      `https://books.google.com/books?id=bk_${hash}`,
      query,
      hallucinated:  true,
    },
  ];
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicateBooks(books) {
  const seenTitles = new Set();
  const seenISBNs  = new Set();
  return books.filter((b) => {
    const titleKey = (b.title || '').toLowerCase().trim();
    if (seenTitles.has(titleKey)) return false;
    if (b.isbn && seenISBNs.has(b.isbn)) return false;
    seenTitles.add(titleKey);
    if (b.isbn) seenISBNs.add(b.isbn);
    return true;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Research book sources for a list of queries.
 * Tries Google Books first, then Open Library, then hallucinated data.
 *
 * @param {string[]} queries
 * @returns {Promise<{ results: BookResult[], status: string, error: string|null }>}
 */
async function researchBooks(queries) {
  const allResults = [];
  let   hadError   = false;

  for (const query of queries) {
    let items = await googleBooksSearch(query);
    if (!items || items.length === 0) {
      items = await openLibrarySearch(query);
    }
    if (!items || items.length === 0) {
      items    = hallucinatedResults(query);
      hadError = true;
    }
    allResults.push(...items);
  }

  const deduped = deduplicateBooks(allResults);

  return {
    results: deduped,
    status:  hadError ? 'partial' : 'success',
    error:   hadError ? 'Some queries used hallucinated data (APIs unavailable)' : null,
  };
}

module.exports = { researchBooks };

