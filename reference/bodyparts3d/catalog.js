'use strict';

(function () {
  const catalog = window.BP3D_CATALOG;
  const searchInput = document.getElementById('catalog-search');
  const typeSelect = document.getElementById('catalog-type');
  const availabilitySelect = document.getElementById('catalog-availability');
  const resultsBody = document.getElementById('catalog-results');
  const summary = document.getElementById('catalog-summary');
  const emptyState = document.getElementById('catalog-empty');
  const coverage = document.getElementById('catalog-coverage');
  const maximumRows = 200;

  function normalized(value) {
    return String(value || '').toLocaleLowerCase('en');
  }

  const searchableRecords = catalog.records.map(record => ({
    record,
    search: normalized(record.slice(0, 7).join(' '))
  }));

  function addCell(row, text, className) {
    const cell = document.createElement('td');
    cell.textContent = text || '—';
    if (className) cell.className = className;
    row.appendChild(cell);
  }

  function render() {
    const query = normalized(searchInput.value.trim());
    const type = typeSelect.value;
    const availability = availabilitySelect.value;
    const matches = searchableRecords.filter(item => {
      const primitive = item.record[7] === true;
      const present = item.record[15] === true;
      const typeMatches =
        type === 'all' ||
        (type === 'primitive' && primitive) ||
        (type === 'compound' && !primitive);
      const availabilityMatches =
        availability === 'all' ||
        (availability === 'present' && present) ||
        (availability === 'missing' && !present);
      return typeMatches && availabilityMatches && (!query || item.search.includes(query));
    });

    resultsBody.replaceChildren();
    const visibleMatches = matches.slice(0, maximumRows);

    visibleMatches.forEach(({ record }) => {
      const row = document.createElement('tr');
      const volume = Number.isFinite(record[8])
        ? `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(record[8])} cm³`
        : '—';
      addCell(row, record[2]);
      addCell(row, record[3], 'catalog-muted');
      addCell(row, record[1], 'catalog-id');
      addCell(row, record[0], 'catalog-id');
      addCell(row, record[15] ? record[16] : 'Behöver laddas ned', record[15] ? '' : 'catalog-muted');
      addCell(row, record[7] ? 'Element' : 'Sammansatt');
      addCell(row, volume);
      resultsBody.appendChild(row);
    });

    emptyState.hidden = matches.length !== 0;
    summary.textContent = matches.length > maximumRows
      ? `${matches.length.toLocaleString('sv-SE')} träffar · de första ${maximumRows} visas`
      : `${matches.length.toLocaleString('sv-SE')} träffar`;
  }

  searchInput.addEventListener('input', render);
  typeSelect.addEventListener('change', render);
  availabilitySelect.addEventListener('change', render);
  coverage.textContent =
    `${catalog.inventory.present.toLocaleString('sv-SE')} säkert matchade i Resus · ` +
    `${catalog.inventory.needsDownload.toLocaleString('sv-SE')} tillgängliga att ladda ned`;
  render();
})();
