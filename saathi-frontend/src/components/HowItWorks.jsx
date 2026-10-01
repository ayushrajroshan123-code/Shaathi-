import React from 'react';

export default function HowItWorks() {
  return (
    <section className="section how-section" id="how-it-works">
      <div className="section-container">
        <div className="how-section-header">
          <div className="section-eyebrow">HOW SAATHI WORKS</div>
        </div>

        <div className="editorial-workflow" aria-label="How SAATHI works">
          <div className="workflow-step">
            <div className="workflow-step-num">01</div>
            <h3 className="workflow-step-title">ASK</h3>
            <p className="workflow-step-desc">Tell your community what you need.</p>
          </div>
          
          <div className="workflow-step">
            <div className="workflow-step-num">02</div>
            <h3 className="workflow-step-title">FIND</h3>
            <p className="workflow-step-desc">Surface people or resources nearby who can help.</p>
          </div>
          
          <div className="workflow-step">
            <div className="workflow-step-num">03</div>
            <h3 className="workflow-step-title">COORDINATE</h3>
            <p className="workflow-step-desc">Connect people and get it done.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
