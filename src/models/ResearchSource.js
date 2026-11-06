'use strict';

/**
 * ResearchSource — MongoDB model
 *
 * Stores individual source items (web pages, books, YouTube videos) discovered
 * during a research session.  One source document per URL/videoId/ISBN.
 */

const mongoose = require('mongoose');

const researchSourceSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ResearchSession',
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['web', 'book', 'youtube'],
      required: true,
    },

    // ── Identity ────────────────────────────────────────────────────────────
    url:   { type: String, default: '' },      // canonical URL / watch URL
    title: { type: String, default: '' },
    
    // ── Web-specific ────────────────────────────────────────────────────────
    snippet:    { type: String, default: '' }, // search engine snippet
    domain:     { type: String, default: '' },
    extractedContent: { type: String, default: '' }, // scraped body text

    // ── Book-specific ────────────────────────────────────────────────────────
    authors:     { type: [String], default: [] },
    publisher:   { type: String,   default: '' },
    publishedDate:{ type: String,  default: '' },
    isbn:        { type: String,   default: '' },
    description: { type: String,   default: '' },
    pageCount:   { type: Number,   default: 0  },
    coverUrl:    { type: String,   default: '' },
    infoLink:    { type: String,   default: '' },

    // ── YouTube-specific ─────────────────────────────────────────────────────
    videoId:      { type: String, default: '' },
    channelTitle: { type: String, default: '' },
    publishedAt:  { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    transcript:   { type: String, default: '' }, // extracted transcript text

    // ── Shared quality fields ─────────────────────────────────────────────────
    relevanceScore: { type: Number, min: 0, max: 1, default: 0.5 },
    isDuplicate:    { type: Boolean, default: false },
    query:          { type: String,  default: '' }, // which query produced this result
  },
  { timestamps: true }
);

researchSourceSchema.index({ sessionId: 1, sourceType: 1 });
researchSourceSchema.index({ sessionId: 1, url: 1 }, { unique: false });

const ResearchSource = mongoose.model('ResearchSource', researchSourceSchema);
module.exports = ResearchSource;

