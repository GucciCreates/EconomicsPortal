/**
 * Leaders' "Scores" tab: who needs support, team averages, the marks ledger
 * (grouped by unit, newest first, older units folded away) and mark entry.
 */

import { apiAddMark, apiEditMark, apiDeleteMark } from '../../api.js';
import { esc } from '../../utils.js';
import { timeHtml } from '../../dates.js';
import { getScoreBand } from '../metricsPanel.js';
import { openEditMarkModal } from '../editModals.js';
import { openReportCardModal } from '../reportCardModal.js';
import { bindActions, runAction, alertHtml, emptyState, teamChip, rosterList, enterMovesToNextField, sameName, TEAMS } from '../ui.js';

const LAST_UNIT_KEY = 'economics_portal_last_unit_v1';

/** Units, newest first (by the latest mark recorded for each). */
export function unitsNewestFirst(marks) {
  const latest = new Map();
  marks.forEach((m) => {
    const unit = String(m.cycle || 'No unit');
    const t = new Date(m.timestamp || 0).getTime() || 0;
    if (!latest.has(unit) || latest.get(unit) < t) latest.set(unit, t);
  });
  return [...latest.entries()].sort((a, b) => b[1] - a[1]).map(([unit]) => unit);
}

function lastUnit(fallback) {
  try {
    return localStorage.getItem(LAST_UNIT_KEY) || fallback || '';
  } catch (e) {
    return fallback || '';
  }
}

export function renderScoresTab(panel, ctx) {
  const { user, data, onRefresh, canEdit, isInstructor } = ctx;
  const marks = data.marks || [];
  const teamAverages = data.teamAverages || {};
  const memberMetrics = data.memberMetrics || {};
  const atRisk = data.atRiskMembers || [];
  const roster = rosterList(data);
  const units = unitsNewestFirst(marks);
  const filters = { team: '', unit: '', q: '' };

  panel.innerHTML = `
    ${
      atRisk.length
        ? `<div class="at-risk-panel">
        <h3 class="at-risk-title">${esc(atRisk.length)} ${atRisk.length === 1 ? 'student needs' : 'students need'} support</h3>
        <p>Their last two tests were below 50 or their work wasn't submitted. Select a name to see their marks.</p>
        <div class="chip-row">
          ${atRisk
            .map((m) => {
              const name = m.member || m.name;
              return `<button type="button" class="badge badge-support badge-button" data-action="show-student" data-name="${esc(name)}">${esc(name)} · Team ${esc(m.team)}</button>`;
            })
            .join('')}
        </div>
      </div>`
        : ''
    }

    <section class="section">
      <div class="section-head">
        <h3 class="section-title">Teams</h3>
        <span class="card-note">Select a team to show only its marks</span>
      </div>
      <div class="grid-4">
        ${TEAMS.map((t) => {
          const avg = teamAverages[t] !== undefined ? teamAverages[t] : null;
          const band = avg !== null ? getScoreBand(avg) : null;
          const count = roster.filter((r) => r.team === t).length;
          return `
          <button type="button" class="stat-tile team-filter-card" data-action="filter-team" data-team="${esc(t)}" aria-pressed="false">
            <span class="stat-title">Team ${esc(t)}</span>
            <span class="stat-val num">${esc(avg !== null ? avg : '—')}</span>
            <span class="stat-foot">${band ? `<span class="badge ${esc(band.cls)}">${esc(band.label)}</span>` : '<span class="muted small">No scores yet</span>'} <span class="muted small">${esc(count)} students</span></span>
          </button>`;
        }).join('')}
      </div>
    </section>

    <section class="card" id="ledger-card">
      <div class="card-header">
        <h3 class="card-title" id="marks-panel-title">Marks</h3>
        <div class="filter-bar">
          <label class="sr-only" for="gl-filter-team">Team</label>
          <select id="gl-filter-team" class="form-control form-control-sm" data-action="filter-team-select">
            <option value="">All teams</option>
            ${TEAMS.map((t) => `<option value="${esc(t)}">Team ${esc(t)}</option>`).join('')}
          </select>
          <label class="sr-only" for="gl-filter-unit">Unit</label>
          <select id="gl-filter-unit" class="form-control form-control-sm" data-action="filter-unit">
            <option value="">All units</option>
            ${units.map((u) => `<option value="${esc(u)}">${esc(u)}</option>`).join('')}
          </select>
          <label class="sr-only" for="gl-search-member">Search</label>
          <input type="search" id="gl-search-member" class="form-control form-control-sm" placeholder="Search name or note" data-action="search" />
        </div>
      </div>
      <div id="gl-ledger"></div>
    </section>

    ${canEdit ? markEntryHtml(roster, units) : ''}
  `;

  const ledger = panel.querySelector('#gl-ledger');

  function filtered() {
    const q = filters.q.toLowerCase();
    return marks.filter(
      (m) =>
        (!filters.team || m.team === filters.team) &&
        (!filters.unit || String(m.cycle) === filters.unit) &&
        (!q || [m.member, m.team, m.cycle, m.notes].some((v) => String(v || '').toLowerCase().includes(q))),
    );
  }

  function drawLedger() {
    const list = filtered();
    if (!marks.length) {
      ledger.innerHTML = emptyState('No marks recorded yet.', canEdit ? 'Enter the first one in the form below.' : '');
      return;
    }
    if (!list.length) {
      ledger.innerHTML = emptyState('No marks match these filters.', 'Change the team, unit or search to see more.');
      return;
    }
    const narrowed = Boolean(filters.team || filters.unit || filters.q);
    const groups = unitsNewestFirst(list).map((unit) => ({
      unit,
      rows: list.filter((m) => String(m.cycle || 'No unit') === unit).sort((a, b) => String(a.member).localeCompare(String(b.member))),
    }));
    ledger.innerHTML = groups
      .map((g, i) => {
        const scored = g.rows.map((m) => Number(m.quizScore)).filter((n) => !isNaN(n));
        const avg = scored.length ? (scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(1) : '—';
        return `
        <details class="unit-group" ${i === 0 || narrowed ? 'open' : ''}>
          <summary>
            <span class="unit-name">${esc(g.unit)}</span>
            <span class="muted small">${esc(g.rows.length)} marks · average ${esc(avg)}</span>
          </summary>
          <div class="table-responsive">
            <table class="data-table data-table-cards">
              <thead>
                <tr>
                  <th>Student</th><th>Team</th><th>Score</th><th>Submitted</th><th>Attendance</th>
                  <th>Preview</th><th>Peer</th><th>On time</th><th>Band</th><th>Notes</th>${canEdit ? '<th><span class="sr-only">Actions</span></th>' : ''}
                </tr>
              </thead>
              <tbody>${g.rows.map(rowHtml).join('')}</tbody>
            </table>
          </div>
        </details>`;
      })
      .join('');
  }

  function rowHtml(m) {
    const band = getScoreBand(m.quizScore);
    return `
      <tr id="mark-row-${esc(m.id)}" data-member="${esc(m.member)}">
        <td data-label="Student"><strong>${esc(m.member)}</strong></td>
        <td data-label="Team">${teamChip(m.team)}</td>
        <td data-label="Score"><strong class="num score-cell">${esc(m.quizScore)}</strong></td>
        <td data-label="Submitted" class="cell-minor">${esc(m.submission || '—')}</td>
        <td data-label="Attendance" class="cell-minor">${esc(m.attendance || '—')}</td>
        <td data-label="Preview" class="cell-minor">${esc(m.previewDone || '—')}</td>
        <td data-label="Peer" class="cell-minor">${esc(m.peerRating || '—')}</td>
        <td data-label="On time" class="cell-minor">${esc(m.punctual || '—')}</td>
        <td data-label="Band"><span class="badge ${esc(band.cls)}">${esc(band.label)}</span></td>
        <td data-label="Notes" class="notes-cell">
          ${esc(m.notes || '—')}
          ${m.editedBy ? `<span class="by-line">by ${esc(m.editedBy)}${m.timestamp ? ', ' + timeHtml(m.timestamp) : ''}</span>` : ''}
        </td>
        ${
          canEdit
            ? `<td data-label="" class="actions-cell">
          <div class="btn-group">
            <button type="button" class="btn btn-secondary btn-sm" data-action="report" data-member="${esc(m.member)}" data-team="${esc(m.team)}" aria-label="Report card for ${esc(m.member)}">Report</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit-mark" data-id="${esc(m.id)}" aria-label="Edit ${esc(m.member)}'s mark">Edit</button>
            ${isInstructor ? `<button type="button" class="btn btn-danger btn-sm" data-action="delete-mark" data-id="${esc(m.id)}" data-member="${esc(m.member)}" aria-label="Delete ${esc(m.member)}'s mark">Delete</button>` : ''}
          </div>
        </td>`
            : ''
        }
      </tr>`;
  }

  function setTeam(team) {
    filters.team = team;
    panel.querySelector('#gl-filter-team').value = team;
    panel.querySelectorAll('.team-filter-card').forEach((c) => {
      const on = c.dataset.team === team;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', String(on));
    });
    panel.querySelector('#marks-panel-title').textContent = team ? `Marks: Team ${team}` : 'Marks';
    drawLedger();
  }

  bindActions(panel, {
    click: {
      'filter-team': (el) => setTeam(filters.team === el.dataset.team ? '' : el.dataset.team),
      'show-student': (el) => {
        const search = panel.querySelector('#gl-search-member');
        search.value = el.dataset.name;
        filters.q = el.dataset.name;
        drawLedger();
        panel.querySelector('#ledger-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      report: (el) => {
        const name = el.dataset.member;
        openReportCardModal(
          { name, team: el.dataset.team },
          marks.filter((m) => sameName(m.member, name)),
          memberMetrics[name] || {},
        );
      },
      'edit-mark': (el) => {
        const mark = marks.find((m) => String(m.id) === el.dataset.id);
        if (!mark) return;
        openEditMarkModal(mark, (fields) =>
          runAction(null, '', () => apiEditMark({ id: mark.id, fields }), { success: 'Mark updated.', onDone: onRefresh }),
        );
      },
      'delete-mark': (el) => {
        if (!window.confirmEconomicsAction(`Delete this mark for ${el.dataset.member}? This can't be undone.`)) return;
        runAction(el, '', () => apiDeleteMark({ id: el.dataset.id }), { success: 'Mark deleted.', onDone: onRefresh });
      },
    },
    change: {
      'filter-team-select': (el) => setTeam(el.value),
      'filter-unit': (el) => {
        filters.unit = el.value;
        drawLedger();
      },
    },
    input: {
      search: (el) => {
        filters.q = el.value.trim();
        drawLedger();
      },
    },
    submit: {
      'add-mark': (form, e) => saveMark(form, e.submitter && e.submitter.value === 'again'),
    },
  });

  drawLedger();

  if (!canEdit) return;
  const form = panel.querySelector('#form-gl-add-mark');
  enterMovesToNextField(form);

  function saveMark(form, addAnother) {
    const feedback = panel.querySelector('#gl-mark-feedback');
    const val = (id) => form.querySelector(id).value;
    const member = val('#gl-mark-member');
    const cycle = val('#gl-mark-cycle').trim();
    feedback.innerHTML = '';
    runAction(
      form.querySelector(addAnother ? 'button[value="again"]' : 'button[value="done"]'),
      'Saving…',
      () =>
        apiAddMark({
          member,
          cycle,
          mockNumber: val('#gl-mark-mock'),
          quizScore: Number(val('#gl-mark-quiz')),
          submission: val('#gl-mark-sub'),
          attendance: val('#gl-mark-att'),
          previewDone: val('#gl-mark-prev'),
          peerRating: val('#gl-mark-peer'),
          punctual: val('#gl-mark-punctual'),
          notes: val('#gl-mark-notes'),
        }),
      {
        success: `Mark saved for ${member}.`,
        onDone: () => {
          try {
            localStorage.setItem(LAST_UNIT_KEY, cycle);
          } catch (e) {
            /* ignore */
          }
          if (addAnother) {
            sessionStorage.setItem('economics_portal_add_another', '1');
          }
          onRefresh();
        },
        onError: (m) => (feedback.innerHTML = alertHtml(m)),
      },
    );
  }

  // After "Save and add another", come back to the form with the student field focused.
  if (sessionStorage.getItem('economics_portal_add_another')) {
    sessionStorage.removeItem('economics_portal_add_another');
    form.scrollIntoView({ block: 'center' });
    form.querySelector('#gl-mark-member').focus();
  }
}

function markEntryHtml(roster, units) {
  const unit = lastUnit(units[0]);
  const teams = [...new Set(roster.map((r) => r.team))];
  return `
    <section class="card" id="mark-entry">
      <div class="card-header">
        <h3 class="card-title">Enter a mark</h3>
        <span class="card-note">Enter moves to the next field</span>
      </div>
      <div id="gl-mark-feedback" aria-live="polite"></div>
      <form id="form-gl-add-mark" data-form="add-mark">
        <div class="form-grid form-grid-3">
          <div class="form-group">
            <label class="form-label" for="gl-mark-member">Student</label>
            <select id="gl-mark-member" class="form-control" required>
              <option value="">Choose a student</option>
              ${teams
                .map(
                  (team) => `<optgroup label="Team ${esc(team)}">${roster
                    .filter((r) => r.team === team)
                    .map((r) => `<option value="${esc(r.name)}">${esc(r.name)}</option>`)
                    .join('')}</optgroup>`,
                )
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="gl-mark-cycle">Topic or unit</label>
            <input type="text" id="gl-mark-cycle" class="form-control" maxlength="100" list="gl-unit-options" value="${esc(unit)}" placeholder="e.g. Unit 3: Trade" required />
            <datalist id="gl-unit-options">${units.map((u) => `<option value="${esc(u)}"></option>`).join('')}</datalist>
          </div>
          <div class="form-group">
            <label class="form-label" for="gl-mark-quiz">Score (0–100)</label>
            <input type="number" id="gl-mark-quiz" class="form-control" min="0" max="100" inputmode="numeric" required />
          </div>
        </div>
        <details class="more-fields">
          <summary>More details: submission, attendance, peer rating, notes</summary>
          <div class="form-grid form-grid-4">
            <div class="form-group">
              <label class="form-label" for="gl-mark-sub">Work submitted</label>
              <select id="gl-mark-sub" class="form-control"><option value="Yes">Yes</option><option value="No">No</option></select>
            </div>
            <div class="form-group">
              <label class="form-label" for="gl-mark-att">Attendance</label>
              <input type="text" id="gl-mark-att" class="form-control" maxlength="20" value="100%" />
            </div>
            <div class="form-group">
              <label class="form-label" for="gl-mark-prev">Preview done</label>
              <select id="gl-mark-prev" class="form-control"><option value="Yes">Yes</option><option value="No">No</option><option value="">Not recorded</option></select>
            </div>
            <div class="form-group">
              <label class="form-label" for="gl-mark-punctual">On time</label>
              <select id="gl-mark-punctual" class="form-control"><option value="Yes">Yes</option><option value="No">No</option><option value="">Not recorded</option></select>
            </div>
            <div class="form-group">
              <label class="form-label" for="gl-mark-mock">Mock number <span class="optional">optional</span></label>
              <input type="number" id="gl-mark-mock" class="form-control" min="0" max="99" />
            </div>
            <div class="form-group">
              <label class="form-label" for="gl-mark-peer">Peer rating (1–5) <span class="optional">optional</span></label>
              <input type="number" step="0.1" min="1" max="5" id="gl-mark-peer" class="form-control" />
            </div>
            <div class="form-group form-span-2">
              <label class="form-label" for="gl-mark-notes">Notes <span class="optional">optional</span></label>
              <input type="text" id="gl-mark-notes" class="form-control" maxlength="1000" placeholder="Strengths, what to work on" />
            </div>
          </div>
        </details>
        <div class="form-actions">
          <button type="submit" class="btn btn-secondary" value="again">Save and add another</button>
          <button type="submit" class="btn btn-primary" value="done">Save mark</button>
        </div>
      </form>
    </section>`;
}
