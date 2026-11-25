document.addEventListener('DOMContentLoaded', () => {
  const tablist = document.querySelector('.phase-tabs');
  if (!tablist) return;
  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
  const panels = document.querySelectorAll('.phase-panel');

  const selectPhase = (phase, focus = false) => {
    const selected = tabs.find(tab => tab.dataset.phase === phase);
    if (!selected) return;
    panels.forEach(panel => {
      panel.hidden = panel.id !== selected.getAttribute('aria-controls');
      if (panel.hidden) panel.querySelectorAll('video').forEach(video => video.pause());
    });
    tabs.forEach(tab => {
      tab.setAttribute('aria-selected', String(tab === selected));
      tab.tabIndex = tab === selected ? 0 : -1;
    });
    if (focus) selected.focus({ preventScroll: true });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectPhase(tab.dataset.phase));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      selectPhase(tabs[next].dataset.phase, true);
    });
  });

  document.querySelectorAll('[data-goto-phase]').forEach(button => {
    button.addEventListener('click', () => {
      selectPhase(button.dataset.gotoPhase, true);
      document.querySelector('.phase-tabs-wrap').scrollIntoView({ block: 'start' });
    });
  });
  selectPhase(tablist.dataset.default);

  document.querySelectorAll('.fund-card[data-goal]').forEach(card => {
    const raised = Number(card.dataset.raised);
    const goal = Number(card.dataset.goal);
    if (!card.dataset.raised.trim() || !Number.isFinite(raised) || raised < 0 || !Number.isFinite(goal) || goal <= 0) return;
    card.querySelector('.fund-progress-wrap').hidden = false;
    card.querySelector('.fund-progress-fill').style.width = `${Math.min(100, raised / goal * 100)}%`;
    const label = card.querySelector('.fund-raised-label');
    const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(raised);
    label.dataset.en = `${amount} raised`;
    label.dataset.kn = `${amount} ಸಂಗ್ರಹವಾಗಿದೆ`;
    label.textContent = label.dataset[document.documentElement.lang] || label.dataset.en;
  });
});
