const styleEl = document.createElement('style');
styleEl.innerHTML = `
.related-chain-wrap { margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.12); }
.related-chain-label { font-size: 0.78rem; color: #9ca3af; margin-bottom: 6px; }
.related-chips-row { display: flex; flex-wrap: wrap; gap: 6px; }
.source-chip-btn {
  background: #1e293b; color: #38bdf8; border: 1px solid #334155;
  border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; cursor: pointer; transition: 0.15s;
}
.source-chip-btn:hover { background: #0284c7; color: #ffffff; }
.source-expand-box {
  background: #0f172a; border: 1px solid #0284c7; border-radius: 8px;
  padding: 10px; margin-top: 8px; font-size: 0.85rem; color: #f1f5f9; display: none;
}
.source-box-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 4px; }
.source-box-title { font-weight: 600; color: #38bdf8; }
.source-direct-link { color: #f59e0b; text-decoration: none; font-size: 0.8rem; font-weight: 500; }
.source-direct-link:hover { text-decoration: underline; }
.source-box-body { line-height: 1.45; color: #cbd5e1; font-size: 0.82rem; white-space: pre-wrap; }
`;
document.head.appendChild(styleEl);

window.toggleSourceAccordion = function(artId, idx, evt) {
  if (evt) {
    evt.preventDefault();
    evt.stopPropagation();
  }
  const boxId = 'src-box-' + artId + '-' + idx;
  const target = document.getElementById(boxId);
  if (!target) return;

  const isClosed = target.style.display === 'none' || target.style.display === '';
  document.querySelectorAll('[id^="src-box-' + artId + '-"]').forEach(el => el.style.display = 'none');

  if (isClosed) {
    target.style.display = 'block';
  }
};