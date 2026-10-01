import React, { useState, useEffect } from 'react';
import { HelpingHand, Wrench, TriangleAlert, Users, X, Check, ShieldCheck } from 'lucide-react';
import { RESIDENTIAL_LOTS } from './dashboardData';

/**
 * AskModal
 * The primary action flow: ASK → FIND → COORDINATE → COMPLETE
 * Restrained, focused, architectural coordination modal with Lucide React icons.
 * Extended with Section 3 & 4: NEIGHBORHOOD QUERIES ("See if other homes have the same need").
 */
export default function AskModal({ isOpen, onClose, initialCategory = 'coverage', onAskCreated }) {
  const [category, setCategory] = useState(initialCategory); // 'coverage' | 'resource' | 'issue' | 'query'
  const [title, setTitle] = useState('');
  const [timeWindow, setTimeWindow] = useState('Today (within 4 hours)');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (category === 'query') {
      setSubmitted(true);
      if (onAskCreated) {
        onAskCreated({
          category: 'query',
          title: title.trim(),
          timeWindow: timeWindow || 'This week',
          details: details.trim(),
        });
      }
      return;
    }

    // Intelligent context matching against real pilot hub neighbors for individual asks
    let matches = [];
    if (category === 'coverage') {
      matches = RESIDENTIAL_LOTS.filter((l) => l.id !== 1).slice(0, 2);
    } else if (category === 'resource') {
      matches = RESIDENTIAL_LOTS.filter((l) => l.resources.length > 0 && l.id !== 1).slice(0, 2);
    } else {
      matches = RESIDENTIAL_LOTS.slice(1, 3);
    }

    setMatchedNeighbors(matches);
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
                  : 'Relevant Neighbors Located'
                : category === 'query'
                ? 'Start a Neighborhood Query'
                : 'Create an Ask'}
            </h3>
            <span className="ask-subtitle">
              {submitted
                ? category === 'query'
                  ? 'Shared demand published to Greenwood Commons. Aggregate interest updates automatically.'
                  : 'Oakridge Circle Pilot Hub matched your request to verified neighbors.'
                : category === 'query'
                ? 'Discover whether multiple homes share the same practical, non-urgent need.'
                : 'ASK → FIND → COORDINATE → COMPLETE'}
            </span>
          </div>
          <button type="button" className="ask-close-btn" onClick={handleReset} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="ask-form">
            {/* Category Selector (Section 3: 4 Matching Options) */}
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
                    : 'Add context for your neighbors (location specifics, access codes, or duration)...'
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
                {category === 'query' ? 'Raise query' : 'Find Matching Neighbors →'}
              </button>
            </div>
          </form>
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
        ) : (
          /* Step 2: FIND → COORDINATE (Individual Ask) */
          <div className="ask-success-view">
            <div className="matched-banner">
              <span className="matched-check"><Check size={18} /></span>
              <div>
                <strong>Ask Published to Oakridge Circle</strong>
                <p>"{title}" ({timeWindow})</p>
              </div>
            </div>

            <h4 className="matched-section-title">VERIFIED NEIGHBORS AVAILABLE TO HELP</h4>
            <div className="matched-neighbors-list">
              {matchedNeighbors.map((neighbor) => (
                <div key={neighbor.id} className="matched-neighbor-card">
                  <div className="matched-avatar">{neighbor.avatar}</div>
                  <div className="matched-info">
                    <span className="matched-name">{neighbor.residentName}</span>
                    <span className="matched-lot">{neighbor.name}</span>
                    <span className="matched-relation">{neighbor.relation}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-primary matched-coord-btn"
                    onClick={() => {
                      alert(`Direct coordination link created with ${neighbor.residentName}.`);
                      handleReset();
                    }}
                  >
                    Coordinate
                  </button>
                </div>
              ))}
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
