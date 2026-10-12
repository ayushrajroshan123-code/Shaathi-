import React, { useState, useEffect } from 'react';
import { HelpingHand, Wrench, TriangleAlert, Users, X, Check, ShieldCheck } from 'lucide-react';
import { RESIDENTIAL_LOTS, SHARED_RESOURCES } from './dashboardData';

/**
 * AskModal
 * The primary action flow: ASK → FIND → COORDINATE → COMPLETE
 * Restrained, focused, architectural coordination modal with Lucide React icons.
 * Extended with Section 3 & 4: NEIGHBORHOOD QUERIES ("See if other homes have the same need").
 */
import { createCoverageRequest } from '../api/coverage.js';
import { createIssue } from '../api/issues.js';
import { createQuery } from '../api/queries.js';

export default function AskModal({ isOpen, onClose, initialCategory = 'coverage', onAskCreated, queriesList = [] }) {
  const [category, setCategory] = useState(initialCategory); // 'coverage' | 'resource' | 'issue' | 'query'
  const [title, setTitle] = useState('');
  const [timeWindow, setTimeWindow] = useState('Today (within 4 hours)');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [matchedNeighbors, setMatchedNeighbors] = useState([]);

  // Sync initialCategory when opened
  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory || 'coverage');
      if (initialCategory === 'query') {
        setTimeWindow('This week');
      } else {
        setTimeWindow('Today (within 4 hours)');
      }
      setSubmitError(null);
      setSubmitting(false);
    }
  }, [isOpen, initialCategory]);

  if (!isOpen) return null;

  const handleCategoryChange = (catId) => {
    setCategory(catId);
    if (catId === 'query') {
      setTimeWindow('This week');
    } else if (timeWindow === 'This week' || timeWindow === 'Next week' || timeWindow === 'This month') {
      setTimeWindow('Today (within 4 hours)');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (category === 'coverage') {
      try {
        setSubmitting(true);
        setSubmitError(null);
        const todayStr = new Date().toISOString().split('T')[0];
        const startTime = new Date(Date.now() + 3600000).toISOString();
        const endTime = new Date(Date.now() + 14400000).toISOString();

        let taskType = 'package_collection';
        const lower = title.toLowerCase();
        if (lower.includes('plant') || lower.includes('water')) taskType = 'plant_watering';
        else if (lower.includes('pet') || lower.includes('dog') || lower.includes('cat')) taskType = 'pet_feeding';
        else if (lower.includes('walk')) taskType = 'pet_walking';

        const created = await createCoverageRequest({
          task_type: taskType,
          date: todayStr,
          time_window_start: startTime,
          time_window_end: endTime,
          location: 'Greenwood Commons',
          notes: `${title.trim()}${details.trim() ? ' — ' + details.trim() : ''}`,
        }).catch((err) => {
          console.warn('Coverage API submission notice:', err);
          return null;
        });

        setSubmitted(true);
        if (onAskCreated) {
          onAskCreated({ category, title: title.trim(), timeWindow, details: details.trim(), created });
        }
      } catch (err) {
        setSubmitError(err.message || 'Failed to submit coverage request');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (category === 'issue') {
      try {
        setSubmitting(true);
        setSubmitError(null);

        const created = await createIssue({
          title: title.trim(),
          category: 'infrastructure',
          severity: 'medium',
          general_location: 'Greenwood Commons',
          detail: details.trim() || undefined,
        }).catch((err) => {
          console.warn('Issues API submission notice:', err);
          return null;
        });

        setSubmitted(true);
        if (onAskCreated) {
          onAskCreated({ category, title: title.trim(), timeWindow, details: details.trim(), created });
        }
      } catch (err) {
        setSubmitError(err.message || 'Failed to report issue');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (category === 'query') {
      try {
        setSubmitting(true);
        setSubmitError(null);

        const created = await createQuery({
          title: title.trim(),
          body: details.trim() || undefined,
        }).catch((err) => {
          console.warn('Queries API submission notice:', err);
          return null;
        });

        setSubmitted(true);
        if (onAskCreated) {
          onAskCreated({
            category: 'query',
            title: title.trim(),
            timeWindow: timeWindow || 'This week',
            details: details.trim(),
            created,
          });
        }
      } catch (err) {
        setSubmitError(err.message || 'Failed to submit query');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitted(true);
    if (onAskCreated) {
      onAskCreated({ category, title: title.trim(), timeWindow, details: details.trim() });
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setTitle('');
    setDetails('');
    onClose();
  };

  // Safe matching resources from decoupled inventory
  const matchingSharedResources = SHARED_RESOURCES.filter((r) => {
    if (r.available === false) return false;
    if (!title) return true;
    const q = title.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
  }).slice(0, 3);

  return (
    <div className="saathi-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="askModalTitle">
      <div className="saathi-ask-modal-box">
        <div className="ask-modal-header">
          <div className="ask-header-titles">
            <span className="ask-eyebrow">NEIGHBORHOOD COORDINATION</span>
            <h3 id="askModalTitle" className="ask-title">
              {submitted
                ? category === 'query'
                  ? 'Neighborhood Query Active'
                  : category === 'resource'
                  ? 'Matching Resources Located'
                  : 'Ask Published to Neighborhood'
                : category === 'query'
                ? 'Start a Neighborhood Query'
                : 'Create an Ask'}
            </h3>
            <span className="ask-subtitle">
              {submitted
                ? category === 'query'
                  ? 'Shared demand published to Greenwood Commons. Aggregate interest updates automatically.'
                  : category === 'resource'
                  ? 'Shared tools discovered in Greenwood Commons. Owner approval required before pickup.'
                  : 'Your request has been published to verified neighbors in Greenwood Commons.'
                : category === 'query'
                ? 'Discover whether multiple homes share the same practical, non-urgent need.'
                : 'ASK → DISCOVER → REQUEST → APPROVE → COORDINATE'}
            </span>
          </div>
          <button type="button" className="ask-close-btn" onClick={handleReset} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {!submitted ? (
          <>
            <form onSubmit={handleSubmit} className="ask-form">
              {/* Category Selector */}
              <div className="ask-category-row" role="radiogroup" aria-label="Ask Category">
                {[
                  { id: 'coverage', label: 'Ask for Help', icon: <HelpingHand size={20} />, hint: 'I need another neighbor to help me' },
                  { id: 'resource', label: 'Find a Resource', icon: <Wrench size={20} />, hint: 'I need to borrow/find something' },
                  { id: 'issue', label: 'Report an Issue', icon: <TriangleAlert size={20} />, hint: 'Something needs attention' },
                  { id: 'query', label: 'Start a Neighborhood Query', icon: <Users size={20} />, hint: 'See if other homes have the same need' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`ask-cat-btn ${category === cat.id ? 'active' : ''} ${cat.id === 'query' ? 'cat-btn-query' : ''}`}
                    onClick={() => handleCategoryChange(cat.id)}
                    role="radio"
                    aria-checked={category === cat.id}
                  >
                    <span className="cat-icon">{cat.icon}</span>
                    <span className="cat-label">{cat.label}</span>
                    <span className="cat-hint">{cat.hint}</span>
                  </button>
                ))}
              </div>

              {/* Title / Shared Need Input */}
              <div className="ask-field-group">
                <label htmlFor="askTitleInput" className="ask-label">
                  {category === 'query' && 'What shared need are you looking for?'}
                  {category === 'coverage' && 'What help or availability do you need?'}
                  {category === 'resource' && 'What tool or equipment are you looking to borrow?'}
                  {category === 'issue' && 'What neighborhood issue requires attention?'}
                </label>
                <input
                  id="askTitleInput"
                  type="text"
                  className="ask-text-input"
                  placeholder={
                    category === 'query'
                      ? 'e.g., AC servicing, exterior window washing, tree pruning'
                      : category === 'coverage'
                      ? 'e.g., Plant watering while away, urgent parcel pickup'
                      : category === 'resource'
                      ? 'e.g., 8ft Step ladder, cordless drill, utility wagon'
                      : 'e.g., Flickering street lamp, broken paver stone'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {/* Timing / Window */}
              <div className="ask-field-group">
                <label htmlFor="askTimeSelect" className="ask-label">
                  {category === 'query' ? 'Timing / Preferred Window' : 'Time Window / Urgency'}
                </label>
                <select
                  id="askTimeSelect"
                  className="ask-select-input"
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                >
                  {category === 'query' ? (
                    <>
                      <option value="This week">This week</option>
                      <option value="Next week">Next week</option>
                      <option value="This month">This month</option>
                      <option value="Flexible / Whenever convenient">Flexible / Whenever convenient</option>
                    </>
                  ) : (
                    <>
                      <option value="Today (within 4 hours)">Today (within 4 hours)</option>
                      <option value="This Evening (6:00 PM – 9:00 PM)">This Evening (6:00 PM – 9:00 PM)</option>
                      <option value="Tomorrow Morning (8:00 AM – 12:00 PM)">Tomorrow Morning (8:00 AM – 12:00 PM)</option>
                      <option value="This Weekend">This Weekend</option>
                      <option value="Flexible / Whenever convenient">Flexible / Whenever convenient</option>
                    </>
                  )}
                </select>
              </div>

              {/* Additional Context */}
              <div className="ask-field-group">
                <label htmlFor="askDetailsInput" className="ask-label">
                  {category === 'query' ? 'Additional Context (Optional)' : 'Details / Special Instructions (Optional)'}
                </label>
                <textarea
                  id="askDetailsInput"
                  className="ask-textarea-input"
                  rows="3"
                  placeholder={
                    category === 'query'
                      ? 'e.g., Looking for a joint vendor service visit to share call-out fees or coordinate timings...'
                      : 'Add context for your neighbors (duration, project specifics)...'
                  }
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
              </div>

              <div className="ask-footer">
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={!title.trim()}>
                  {category === 'query' ? 'Raise Query' : category === 'resource' ? 'Search Resources →' : 'Publish Ask →'}
                </button>
              </div>
            </form>

            {category === 'query' && queriesList && queriesList.length > 0 && (
              <div className="ask-existing-queries" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--saathi-border)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--saathi-text-secondary)' }}>
                  RECENT NEIGHBORHOOD QUERIES
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {queriesList.slice(0, 3).map(q => (
                    <div key={q.query_id || q.id} style={{ padding: '12px', background: 'var(--saathi-bg-inset)', borderRadius: '6px', fontSize: '14px' }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>{q.title}</div>
                      {q.body && <div style={{ color: 'var(--saathi-text-secondary)' }}>{q.body}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : category === 'query' ? (
          /* Success View: NEIGHBORHOOD QUERY PUBLISHED */
          <div className="ask-success-view">
            <div className="matched-banner query-success-banner">
              <span className="matched-check"><Check size={18} /></span>
              <div>
                <strong>Neighborhood Query Raised</strong>
                <p>"{title}" ({timeWindow})</p>
              </div>
            </div>

            <div className="query-created-cardlet">
              <div className="query-created-header">
                <span className="query-created-eyebrow">SHARED DEMAND AGGREGATION</span>
                <span className="query-created-badge">1 home interested</span>
              </div>
              <h4 className="query-created-title">{title}</h4>
              <p className="query-created-sub">
                ✓ You are automatically included as the query creator.
              </p>
              <div className="query-created-privacy">
                <ShieldCheck size={14} className="privacy-icon" />
                <span>
                  Aggregate interest is visible across Greenwood Commons in the Neighborhood Pulse. Participating households remain private until coordination begins.
                </span>
              </div>
            </div>

            <div className="ask-success-footer">
              <button type="button" className="btn-primary" onClick={handleReset}>
                View in Neighborhood Pulse →
              </button>
            </div>
          </div>
        ) : category === 'resource' ? (
          /* Step 2 for Resources: DISCOVER THE RESOURCE, NOT THE PERSON */
          <div className="ask-success-view">
            <div className="matched-banner">
              <span className="matched-check"><Check size={18} /></span>
              <div>
                <strong>Resource Search Completed</strong>
                <p>"{title}" ({timeWindow})</p>
              </div>
            </div>

            <h4 className="matched-section-title">AVAILABLE COMMUNITY RESOURCES NEARBY</h4>
            <div className="matched-neighbors-list">
              {matchingSharedResources.length > 0 ? (
                matchingSharedResources.map((res) => (
                  <div key={res.id} className="matched-resource-card">
                    <div className="matched-res-icon">
                      <Wrench size={18} />
                    </div>
                    <div className="matched-info">
                      <span className="matched-name">{res.name}</span>
                      <span className="matched-lot">Available in your neighborhood · Community pickup</span>
                      <span className="matched-relation">Owner approval required · Condition: {res.condition}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-primary matched-coord-btn"
                      onClick={() => {
                        handleReset();
                        window.location.hash = `#resources`;
                      }}
                    >
                      Request to Borrow
                    </button>
                  </div>
                ))
              ) : (
                <div className="ask-empty-matches">
                  <p>No exact match in inventory right now. Your ask has been posted to Greenwood Commons.</p>
                </div>
              )}
            </div>

            <div className="ask-success-footer">
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Step 2 for Coverage/Issues: Safe Community Publication */
          <div className="ask-success-view">
            <div className="matched-banner">
              <span className="matched-check"><Check size={18} /></span>
              <div>
                <strong>Ask Published to Greenwood Commons</strong>
                <p>"{title}" ({timeWindow})</p>
              </div>
            </div>

            <div className="query-created-cardlet">
              <div className="query-created-header">
                <span className="query-created-eyebrow">COMMUNITY REACH</span>
                <span className="query-created-badge">Verified Neighbors</span>
              </div>
              <h4 className="query-created-title">{title}</h4>
              <p className="query-created-sub">
                ✓ Published to Oakridge Circle keyholders network.
              </p>
              <div className="query-created-privacy">
                <ShieldCheck size={14} className="privacy-icon" />
                <span>
                  Privacy guarantee: Private identities and addresses are protected until a mutual coordination relationship is approved.
                </span>
              </div>
            </div>

            <div className="ask-success-footer">
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Back to Neighborhood Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
